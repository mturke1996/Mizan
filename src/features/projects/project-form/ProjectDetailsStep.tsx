import { clsx } from "clsx";
import { Check, FolderPlus } from "lucide-react";
import type { FormEventHandler, Ref } from "react";
import {
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";
import type { ProjectBlueprint } from "../project-blueprints";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  type ProjectFormValues,
} from "../project-form-schema";
import type {
  ProjectCategorySeed,
  ProjectModules,
} from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { COLOR_CHOICES, PROJECT_FIELD_CLASS_NAME } from "./project-form-config";
import { ProjectSummary } from "./ProjectSummary";

export interface ProjectDetailsStepProps {
  blueprint: ProjectBlueprint;
  control: Control<ProjectFormValues>;
  currency: string;
  currencyScale: number;
  errors: FieldErrors<ProjectFormValues>;
  headingRef: Ref<HTMLHeadingElement>;
  isBusy: boolean;
  modules: ProjectModules;
  register: UseFormRegister<ProjectFormValues>;
  selectedCategories: readonly ProjectCategorySeed[];
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function ProjectDetailsStep({
  blueprint,
  control,
  currency,
  currencyScale,
  errors,
  headingRef,
  isBusy,
  modules,
  register,
  selectedCategories,
  onSubmit,
}: ProjectDetailsStepProps) {
  const selectedColor = useWatch({ control, name: "colorToken" });

  return (
    <section aria-labelledby="details-step-title">
      <form
        noValidate
        aria-label="إنشاء مشروع"
        aria-busy={isBusy}
        onSubmit={onSubmit}
      >
        <AppCard className="space-y-5 p-4 sm:p-5">
          <div>
            <h2
              ref={headingRef}
              id="details-step-title"
              tabIndex={-1}
              className="text-xl font-bold text-ink"
            >
              تفاصيل المشروع
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              أكمل البيانات الأساسية وراجع ما سيُنشأ قبل الحفظ.
            </p>
          </div>

          <div>
            <label
              htmlFor="project-name"
              className="text-sm font-bold text-ink"
            >
              اسم المشروع
            </label>
            <input
              id="project-name"
              type="text"
              autoComplete="off"
              maxLength={PROJECT_NAME_MAX_LENGTH}
              placeholder="مثل: مزرعة النورس"
              aria-required="true"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "project-name-error" : undefined}
              className={`mt-2 ${PROJECT_FIELD_CLASS_NAME}`}
              {...register("name")}
            />
            {errors.name ? (
              <p
                id="project-name-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="project-description"
              className="text-sm font-bold text-ink"
            >
              وصف المشروع
            </label>
            <textarea
              id="project-description"
              rows={3}
              maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
              placeholder="ما الذي تريد متابعته في هذا المشروع؟"
              aria-required="true"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={
                errors.description ? "project-description-error" : undefined
              }
              className={`mt-2 resize-none py-3 ${PROJECT_FIELD_CLASS_NAME}`}
              {...register("description")}
            />
            {errors.description ? (
              <p
                id="project-description-error"
                role="alert"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-ink">لون التمييز</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {COLOR_CHOICES.map((choice) => {
                const isSelected = selectedColor === choice.value;
                return (
                  <label
                    key={choice.value}
                    className="relative cursor-pointer"
                  >
                    <input
                      type="radio"
                      value={choice.value}
                      aria-label={choice.label}
                      className="peer sr-only"
                      {...register("colorToken")}
                    />
                    <span
                      className={clsx(
                        "flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold peer-focus-visible:ring-3 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                        isSelected
                          ? "border-primary bg-primary-soft text-primary-ink"
                          : "border-control-border bg-surface text-ink",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "size-3 rounded-full border border-line-strong",
                          choice.swatch,
                        )}
                      />
                      {choice.label}
                      {isSelected ? (
                        <Check aria-hidden="true" size={13} />
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {modules.goal ? (
            <div>
              <label
                htmlFor="project-goal"
                className="text-sm font-bold text-ink"
              >
                هدف الإيرادات
                <span className="mr-1 font-normal text-muted">(اختياري)</span>
              </label>
              <p id="project-goal-helper" className="mt-1 text-xs text-muted">
                أدخل قيمة أكبر من صفر، أو اترك الحقل فارغًا.
              </p>
              <div className="relative mt-2">
                <input
                  id="project-goal"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  aria-label="هدف الإيرادات"
                  placeholder={`0.${"0".repeat(currencyScale)}`}
                  aria-invalid={Boolean(errors.goal)}
                  aria-describedby={`project-goal-helper${
                    errors.goal ? " project-goal-error" : ""
                  }`}
                  className={`${PROJECT_FIELD_CLASS_NAME} numeric pl-16 text-left`}
                  {...register("goal")}
                />
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-xs font-bold text-muted">
                  {currency}
                </span>
              </div>
              {errors.goal ? (
                <p
                  id="project-goal-error"
                  role="alert"
                  className="mt-2 text-xs font-semibold text-danger"
                >
                  {errors.goal.message}
                </p>
              ) : null}
            </div>
          ) : null}

          {modules.capital ? (
            <div>
              <label
                htmlFor="project-opening-capital"
                className="text-sm font-bold text-ink"
              >
                رأس المال الافتتاحي
                <span className="mr-1 font-normal text-muted">(اختياري)</span>
              </label>
              <p
                id="project-opening-capital-helper"
                className="mt-1 text-xs text-muted"
              >
                سيُسجّل كرصيد افتتاحي مستقل عند إنشاء المشروع.
              </p>
              <div className="relative mt-2">
                <input
                  id="project-opening-capital"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  aria-label="رأس المال الافتتاحي"
                  placeholder={`0.${"0".repeat(currencyScale)}`}
                  aria-invalid={Boolean(errors.openingCapital)}
                  aria-describedby={`project-opening-capital-helper${
                    errors.openingCapital
                      ? " project-opening-capital-error"
                      : ""
                  }`}
                  className={`${PROJECT_FIELD_CLASS_NAME} numeric pl-16 text-left`}
                  {...register("openingCapital")}
                />
                <span className="absolute top-1/2 left-4 -translate-y-1/2 text-xs font-bold text-muted">
                  {currency}
                </span>
              </div>
              {errors.openingCapital ? (
                <p
                  id="project-opening-capital-error"
                  role="alert"
                  className="mt-2 text-xs font-semibold text-danger"
                >
                  {errors.openingCapital.message}
                </p>
              ) : null}
            </div>
          ) : null}

          <ProjectSummary
            blueprint={blueprint}
            modules={modules}
            selectedCategories={selectedCategories}
          />
        </AppCard>

        <button
          type="submit"
          disabled={isBusy}
          className="pressable mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-65"
        >
          <FolderPlus aria-hidden="true" size={19} />
          {isBusy ? "جارٍ إنشاء المشروع..." : "إنشاء المشروع"}
        </button>
      </form>
    </section>
  );
}
