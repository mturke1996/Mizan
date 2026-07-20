import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight, Save } from "lucide-react";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useDebtStore } from "@/features/debts/debt-store";
import { useCreateDebtMutation } from "@/features/workspace/use-finance-data";
import { useProjectsView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

const debtFormSchema = z.object({
  direction: z.enum(["receivable", "payable"]),
  partyName: z
    .string()
    .trim()
    .min(2, "اكتب اسمًا واضحًا للطرف")
    .max(160, "اسم الطرف أطول من اللازم"),
  partyPhone: z
    .string()
    .trim()
    .max(50, "رقم الهاتف أطول من اللازم")
    .optional(),
  amount: z.string().trim().min(1, "أدخل مبلغ الدين"),
  dueOn: z.string().optional(),
  projectId: z.string().optional(),
  note: z.string().trim().max(1000, "الملاحظة أطول من اللازم").optional(),
});

type DebtFormValues = z.infer<typeof debtFormSchema>;

interface SubmitIntent {
  fingerprint: string;
  clientId: string;
}

const inputClassName =
  "min-h-12 w-full rounded-md border border-control-border bg-surface px-4 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-surface-subtle";

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  return message ? (
    <p id={id} className="mt-1.5 text-xs font-semibold text-danger">
      {message}
    </p>
  ) : null;
}

export function DebtFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    workspaceId,
    currency,
    isLoading: workspaceLoading,
    error: workspaceError,
    refresh: refreshWorkspace,
    isDemo = false,
  } = useWorkspace();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjectsView();
  const createDemoDebt = useDebtStore((state) => state.createDebt);
  const createDebt = useCreateDebtMutation();
  const submitIntentRef = useRef<SubmitIntent | null>(null);
  const requestedDirection = searchParams.get("direction");
  const initialDirection =
    requestedDirection === "payable" ? "payable" : "receivable";
  const requestedProject = searchParams.get("project")?.trim() ?? "";
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      direction: initialDirection,
      partyName: "",
      partyPhone: "",
      amount: "",
      dueOn: "",
      projectId: requestedProject,
      note: "",
    },
  });
  const isBusy = isSubmitting || createDebt.isPending;
  const formError = (!workspaceId && !isDemo ? workspaceError : null) ??
    projectsError;

  const onSubmit = async (values: DebtFormValues) => {
    let principalMinor: bigint;
    try {
      principalMinor = parseMajorAmount(
        values.amount,
        getCurrencyScale(currency),
      );
      if (principalMinor <= 0n) {
        throw new Error("أدخل مبلغ دين أكبر من صفر");
      }
    } catch (error) {
      setError(
        "amount",
        {
          type: "manual",
          message:
            error instanceof Error
              ? error.message
              : "أدخل مبلغ دين أكبر من صفر",
        },
        { shouldFocus: true },
      );
      return;
    }

    const project = projects.find(
      (candidate) => candidate.id === values.projectId,
    );
    const payload = {
      direction: values.direction,
      partyName: values.partyName.trim(),
      partyPhone: values.partyPhone?.trim() || undefined,
      principalMinor,
      dueOn: values.dueOn || undefined,
      projectId: project?.id,
      projectName: project?.name,
      note: values.note?.trim() || undefined,
    };
    const fingerprint = JSON.stringify({
      ...payload,
      principalMinor: principalMinor.toString(),
    });
    const previousIntent = submitIntentRef.current;
    const clientId =
      previousIntent?.fingerprint === fingerprint
        ? previousIntent.clientId
        : crypto.randomUUID();
    submitIntentRef.current = { fingerprint, clientId };

    try {
      let debtId: string;
      if (workspaceId) {
        debtId = await createDebt.mutateAsync({
          direction: payload.direction,
          partyName: payload.partyName,
          partyPhone: payload.partyPhone,
          principalMinor: toSafeMinorNumber(principalMinor),
          dueOn: payload.dueOn,
          projectId: payload.projectId,
          note: payload.note,
          clientId,
        });
      } else if (isDemo) {
        debtId = createDemoDebt({
          ...payload,
          currencyCode: currency,
          clientId,
        });
      } else {
        throw new Error("مساحة العمل غير متاحة الآن. أعد المحاولة بعد التحديث.");
      }

      submitIntentRef.current = null;
      toast.success("تم إنشاء الدين");
      navigate(`/debts/${encodeURIComponent(debtId)}`, { replace: true });
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر إنشاء الدين"));
    }
  };

  if (workspaceLoading || projectsLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <PageHeader
          title="دين جديد"
          subtitle="سجّل أصل الدين والطرف وتاريخ الاستحقاق."
          backTo="/debts"
        />
        <AppCard
          aria-label="جاري تحميل نموذج الدين"
          className="h-96 animate-pulse bg-surface-subtle motion-reduce:animate-none"
          role="status"
        />
      </div>
    );
  }

  if (formError) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <PageHeader
          title="دين جديد"
          subtitle="سجّل أصل الدين والطرف وتاريخ الاستحقاق."
          backTo="/debts"
        />
        <ErrorState
          message={formError}
          onRetry={() =>
            void Promise.all([refreshWorkspace(), refreshProjects()])
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6" dir="rtl">
      <PageHeader
        title={
          initialDirection === "payable" && requestedDirection === "payable"
            ? "دين عليّ"
            : requestedDirection === "receivable"
              ? "مستحق لي"
              : "دين جديد"
        }
        subtitle="سجّل أصل الدين والطرف وتاريخ الاستحقاق."
        backTo="/debts"
      />

      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
        <AppCard className="p-4 sm:p-6">
          <fieldset>
            <legend className="text-sm font-bold text-ink">اتجاه الدين</legend>
            <p className="mt-1 text-xs leading-5 text-muted">
              اختر إن كان المبلغ مستحقًا لك أو عليك.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="relative">
                <input
                  type="radio"
                  value="receivable"
                  className="peer sr-only"
                  {...register("direction")}
                />
                <span className="pressable flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-control-border bg-surface px-4 text-sm font-bold text-ink peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  <ArrowDownLeft aria-hidden="true" size={19} />
                  مستحق لي
                </span>
              </label>
              <label className="relative">
                <input
                  type="radio"
                  value="payable"
                  className="peer sr-only"
                  {...register("direction")}
                />
                <span className="pressable flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-control-border bg-surface px-4 text-sm font-bold text-ink peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:text-primary-ink peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
                  <ArrowUpRight aria-hidden="true" size={19} />
                  مستحق عليّ
                </span>
              </label>
            </div>
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                اسم الطرف
              </span>
              <input
                className={inputClassName}
                aria-invalid={errors.partyName ? "true" : undefined}
                aria-describedby={
                  errors.partyName ? "debt-party-name-error" : undefined
                }
                autoComplete="name"
                placeholder="مثال: شركة النور"
                {...register("partyName")}
              />
              <FieldError
                id="debt-party-name-error"
                message={errors.partyName?.message}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                رقم الهاتف (اختياري)
              </span>
              <input
                className={`${inputClassName} numeric text-left`}
                aria-invalid={errors.partyPhone ? "true" : undefined}
                aria-describedby={
                  errors.partyPhone ? "debt-party-phone-error" : undefined
                }
                autoComplete="tel"
                dir="ltr"
                inputMode="tel"
                placeholder="0912345678"
                {...register("partyPhone")}
              />
              <FieldError
                id="debt-party-phone-error"
                message={errors.partyPhone?.message}
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-2 text-sm font-bold text-ink">
                <span>المبلغ</span>
                <span className="text-xs font-semibold text-muted">
                  {currency}
                </span>
              </span>
              <input
                className={`${inputClassName} numeric text-left`}
                aria-label="المبلغ"
                aria-invalid={errors.amount ? "true" : undefined}
                aria-describedby={
                  errors.amount ? "debt-amount-error" : "debt-amount-hint"
                }
                dir="ltr"
                inputMode="decimal"
                placeholder={`0.${"0".repeat(getCurrencyScale(currency))}`}
                {...register("amount")}
              />
              <p id="debt-amount-hint" className="mt-1.5 text-xs text-muted">
                أدخل أصل الدين قبل أي دفعات.
              </p>
              <FieldError
                id="debt-amount-error"
                message={errors.amount?.message}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                تاريخ الاستحقاق (اختياري)
              </span>
              <input
                type="date"
                className={`${inputClassName} numeric text-left`}
                dir="ltr"
                {...register("dueOn")}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-ink">
                المشروع (اختياري)
              </span>
              <select className={inputClassName} {...register("projectId")}>
                <option value="">دون مشروع</option>
                {projects
                  .filter((project) => project.status === "active")
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-ink">
                ملاحظة (اختياري)
              </span>
              <textarea
                className="min-h-28 w-full resize-y rounded-md border border-control-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted"
                aria-invalid={errors.note ? "true" : undefined}
                aria-describedby={errors.note ? "debt-note-error" : undefined}
                placeholder="سبب الدين أو مرجع الاتفاق"
                {...register("note")}
              />
              <FieldError
                id="debt-note-error"
                message={errors.note?.message}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="pressable mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 text-sm font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-40"
          >
            <Save aria-hidden="true" size={18} />
            {isBusy ? "جارٍ الإنشاء…" : "إنشاء الدين"}
          </button>
        </AppCard>
      </form>
    </div>
  );
}
