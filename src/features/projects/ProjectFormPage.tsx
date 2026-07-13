import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useRef, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getCurrencyScale } from "@/domain/money/money";
import {
  ProjectAmountValidationError,
  PROJECT_FORM_DEFAULT_VALUES,
  createProjectPayloadFingerprint,
  normalizeProjectSubmission,
  projectFormSchema,
  type LiveProjectSubmitIntent,
  type ProjectFormValues,
} from "@/features/projects/project-form-schema";
import { PROJECT_TONES } from "@/features/projects/project-form/project-form-config";
import { ProjectDetailsStep } from "@/features/projects/project-form/ProjectDetailsStep";
import { ProjectSetupStep } from "@/features/projects/project-form/ProjectSetupStep";
import { ProjectTypeStep } from "@/features/projects/project-form/ProjectTypeStep";
import { WizardProgress } from "@/features/projects/project-form/WizardProgress";
import { useProjectStore } from "@/features/projects/project-store";
import { useProjectWizard } from "@/features/projects/use-project-wizard";
import { useCreateProjectMutation } from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  ProjectModuleKey,
  ProjectType,
} from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function ProjectFormPage() {
  const navigate = useNavigate();
  const {
    workspaceId,
    currency,
    isLoading,
    error: workspaceError,
    refresh,
    isDemo = false,
  } = useWorkspace();
  const addProject = useProjectStore((state) => state.addProject);
  const createProject = useCreateProjectMutation();
  const wizard = useProjectWizard();
  const submitLockRef = useRef(false);
  const liveSubmitIntentRef = useRef<LiveProjectSubmitIntent | null>(null);
  const {
    clearErrors,
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { ...PROJECT_FORM_DEFAULT_VALUES },
  });
  const currencyScale = getCurrencyScale(currency);
  const isBusy = isSubmitting || createProject.isPending;

  const chooseBlueprint = (type: ProjectType) => {
    if (type !== wizard.selectedType) {
      clearErrors(["goal", "openingCapital"]);
    }
    wizard.chooseBlueprint(type);
  };

  const toggleModule = (key: ProjectModuleKey) => {
    wizard.toggleModule(key);
    if (key === "goal") clearErrors("goal");
    if (key === "capital") clearErrors("openingCapital");
  };

  if (!isDemo && isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <PageHeader
          title="مخطط المشروع الذكي"
          subtitle="نجهّز نموذج المشروع خطوة بخطوة."
          backTo="/projects"
        />
        <AppCard
          role="status"
          aria-label="جاري تحميل مخطط المشروع"
          className="h-72 animate-pulse bg-surface-subtle motion-reduce:animate-none"
        />
      </div>
    );
  }

  if (!isDemo && workspaceError) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <PageHeader
          title="مخطط المشروع الذكي"
          subtitle="نجهّز نموذج المشروع خطوة بخطوة."
          backTo="/projects"
        />
        <ErrorState
          message={workspaceError}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }

  const onSubmit = async (values: ProjectFormValues) => {
    if (
      submitLockRef.current ||
      createProject.isPending ||
      !wizard.selectedType ||
      !wizard.selectedBlueprint ||
      !wizard.modules
    ) {
      return;
    }

    submitLockRef.current = true;
    try {
      let submission;
      try {
        submission = normalizeProjectSubmission({
          values,
          projectType: wizard.selectedType,
          modules: wizard.modules,
          selectedCategories: wizard.selectedCategories,
          currencyScale,
        });
      } catch (error) {
        if (error instanceof ProjectAmountValidationError) {
          setError(
            error.field,
            { type: "manual", message: error.message },
            { shouldFocus: true },
          );
          return;
        }
        throw error;
      }

      if (workspaceId) {
        const payloadFingerprint = createProjectPayloadFingerprint(
          submission.livePayload,
        );
        const previousIntent = liveSubmitIntentRef.current;
        const clientId =
          previousIntent?.payloadFingerprint === payloadFingerprint
            ? previousIntent.clientId
            : crypto.randomUUID();
        liveSubmitIntentRef.current = { payloadFingerprint, clientId };

        const result = await createProject.mutateAsync({
          ...submission.livePayload,
          clientId,
        });
        liveSubmitIntentRef.current = null;
        const createdId = result.id?.trim() || null;
        navigate(
          createdId
            ? `/projects/${encodeURIComponent(createdId)}`
            : "/projects",
          { replace: true },
        );
        return;
      }

      if (isDemo) {
        const projectId = crypto.randomUUID();
        const payload = submission.livePayload;
        addProject({
          id: projectId,
          name: payload.name,
          description: payload.description,
          status: "active",
          projectType: payload.projectType,
          modules: payload.modules,
          incomeMinor: 0n,
          expenseMinor: 0n,
          profitMinor: 0n,
          ...(submission.goalMinor !== undefined
            ? { goalMinor: submission.goalMinor }
            : {}),
          progress: 0,
          mark: payload.name.charAt(0),
          tone: PROJECT_TONES[payload.colorToken],
          colorToken: payload.colorToken,
          outstandingLaborMinor: 0n,
          activeWorkers: 0,
          capitalMinor: submission.openingCapitalMinor ?? 0n,
          capitalRecoveredRate: null,
          inventoryValueMinor: 0n,
          inventoryItemCount: 0,
        });
        navigate(`/projects/${encodeURIComponent(projectId)}`, {
          replace: true,
        });
        return;
      }

      throw new Error("مساحة العمل غير متاحة الآن. أعد المحاولة بعد التحديث.");
    } catch (error) {
      toast.error(
        getUserErrorMessage(
          error,
          "تعذر إنشاء المشروع. حاول مرة أخرى.",
        ),
      );
    } finally {
      submitLockRef.current = false;
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(onSubmit)(event);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6" dir="rtl">
      <PageHeader
        title="مخطط المشروع الذكي"
        subtitle={wizard.currentStep.subtitle}
        backTo={wizard.step === 1 ? "/projects" : undefined}
        action={
          wizard.step > 1 ? (
            <button
              type="button"
              aria-label="الرجوع إلى الخطوة السابقة"
              onClick={wizard.goBack}
              className="pressable grid size-11 place-items-center rounded-full border border-control-border bg-surface text-ink hover:bg-surface-subtle"
            >
              <ArrowRight aria-hidden="true" size={20} />
            </button>
          ) : undefined
        }
      />

      <p
        role="status"
        aria-label="حالة تقدم إنشاء المشروع"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        الخطوة {wizard.step} من 3: {wizard.currentStep.title}
      </p>

      <div className="grid gap-4 md:grid-cols-[11rem_minmax(0,1fr)] md:items-start">
        <WizardProgress step={wizard.step} />

        <div className="min-w-0">
          {wizard.step === 1 ? (
            <ProjectTypeStep
              headingRef={wizard.stepHeadingRef}
              selectedType={wizard.selectedType}
              onSelect={chooseBlueprint}
              onContinue={wizard.continueFromType}
            />
          ) : null}

          {wizard.step === 2 &&
          wizard.selectedBlueprint &&
          wizard.modules ? (
            <ProjectSetupStep
              blueprint={wizard.selectedBlueprint}
              headingRef={wizard.stepHeadingRef}
              modules={wizard.modules}
              selectedCategoryKeys={wizard.selectedCategoryKeys}
              onToggleModule={toggleModule}
              onToggleCategory={wizard.toggleCategory}
              onContinue={wizard.continueFromSetup}
            />
          ) : null}

          {wizard.step === 3 &&
          wizard.selectedBlueprint &&
          wizard.modules ? (
            <ProjectDetailsStep
              blueprint={wizard.selectedBlueprint}
              control={control}
              currency={currency}
              currencyScale={currencyScale}
              errors={errors}
              headingRef={wizard.stepHeadingRef}
              isBusy={isBusy}
              modules={wizard.modules}
              register={register}
              selectedCategories={wizard.selectedCategories}
              onSubmit={submitForm}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
