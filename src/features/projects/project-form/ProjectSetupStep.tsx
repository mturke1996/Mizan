import { clsx } from "clsx";
import { Check, Plus, Tags } from "lucide-react";
import type { Ref } from "react";
import {
  PROJECT_MODULE_KEYS,
  PROJECT_MODULE_METADATA,
  type ProjectBlueprint,
} from "../project-blueprints";
import { categoryKey } from "../project-form-schema";
import type {
  ProjectCategorySeed,
  ProjectModuleKey,
  ProjectModules,
} from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge } from "@/shared/ui/Badge";
import { EmptyState } from "@/shared/ui/EmptyState";

export interface ProjectSetupStepProps {
  blueprint: ProjectBlueprint;
  headingRef: Ref<HTMLHeadingElement>;
  modules: ProjectModules;
  selectedCategoryKeys: readonly string[];
  onToggleModule: (key: ProjectModuleKey) => void;
  onToggleCategory: (category: ProjectCategorySeed) => void;
  onContinue: () => void;
}

export function ProjectSetupStep({
  blueprint,
  headingRef,
  modules,
  selectedCategoryKeys,
  onToggleModule,
  onToggleCategory,
  onContinue,
}: ProjectSetupStepProps) {
  return (
    <section aria-labelledby="setup-step-title">
      <AppCard className="p-4 sm:p-5">
        <div className="mb-5">
          <h2
            ref={headingRef}
            id="setup-step-title"
            tabIndex={-1}
            className="text-xl font-bold text-ink"
          >
            جهّز مشروعك
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            فعّل ما تحتاجه الآن، وحدد التصنيفات التي ستُنشأ مع المشروع.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-bold text-ink">وحدات المشروع</legend>
          <div className="mt-3 grid gap-2">
            {PROJECT_MODULE_KEYS.map((key) => {
              const metadata = PROJECT_MODULE_METADATA[key];
              const isEnabled = modules[key];
              const descriptionId = `module-${key}-description`;
              return (
                <label
                  key={key}
                  className={clsx(
                    "relative block",
                    metadata.required ? "cursor-not-allowed" : "cursor-pointer",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    disabled={metadata.required}
                    onChange={() => onToggleModule(key)}
                    aria-label={`وحدة ${metadata.name}`}
                    aria-describedby={descriptionId}
                    className="peer sr-only"
                  />
                  <span
                    className={clsx(
                      "flex min-h-16 items-center gap-3 rounded-sm border px-3 py-3 transition-colors duration-150 motion-reduce:transition-none peer-focus-visible:ring-3 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                      isEnabled
                        ? "border-primary bg-primary-soft"
                        : "border-control-border bg-surface",
                      metadata.required && "opacity-80",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-150 motion-reduce:transition-none",
                        isEnabled
                          ? "border-primary bg-primary"
                          : "border-control-border bg-surface-strong",
                      )}
                    >
                      <span
                        className={clsx(
                          "absolute top-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform duration-150 motion-reduce:transition-none",
                          isEnabled
                            ? "-translate-x-6"
                            : "-translate-x-0.5",
                        )}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm text-ink">
                          {metadata.name}
                        </strong>
                        {metadata.required ? (
                          <Badge tone="neutral">مطلوبة دائمًا</Badge>
                        ) : null}
                      </span>
                      <span
                        id={descriptionId}
                        className="mt-1 block text-xs leading-5 text-muted"
                      >
                        {metadata.description}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-ink">
                      {isEnabled ? "مفعّلة" : "غير مفعّلة"}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-7 border-t border-line pt-6">
          <legend className="text-sm font-bold text-ink">
            التصنيفات المقترحة
          </legend>
          <p className="mt-1 text-xs leading-5 text-muted">
            كل تصنيف يوضح إن كان دخلًا أو مصروفًا، ويمكن حذفه أو إعادته.
          </p>

          {blueprint.suggestedCategories.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {blueprint.suggestedCategories.map((category) => {
                const key = categoryKey(category);
                const isSelected = selectedCategoryKeys.includes(key);
                const kindLabel =
                  category.kind === "income" ? "دخل" : "مصروف";
                return (
                  <label key={key} className="relative cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleCategory(category)}
                      aria-label={`تصنيف ${kindLabel}: ${category.name}`}
                      className="peer sr-only"
                    />
                    <span
                      className={clsx(
                        "flex min-h-11 items-center gap-2 rounded-sm border px-3 py-2 text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none peer-focus-visible:ring-3 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                        isSelected
                          ? "border-primary bg-primary-soft text-primary-ink"
                          : "border-control-border bg-surface text-muted",
                      )}
                    >
                      <span className="font-bold">{kindLabel}:</span>
                      <span>{category.name}</span>
                      <span className="flex items-center gap-1 border-r border-current/20 pr-2 text-[10px]">
                        {isSelected ? (
                          <Check aria-hidden="true" size={12} />
                        ) : (
                          <Plus aria-hidden="true" size={12} />
                        )}
                        {isSelected ? "مضاف" : "غير مضاف"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="mt-4"
              icon={<Tags size={22} />}
              title="لا توجد تصنيفات مقترحة"
              description="ابدأ المشروع دون تصنيفات أولية. أضف تصنيفات الدخل والمصروف من صفحة المعاملات بعد الإنشاء."
            />
          )}
        </fieldset>
      </AppCard>

      <button
        type="button"
        onClick={onContinue}
        className="pressable mt-5 flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover"
      >
        التالي: تفاصيل المشروع
      </button>
    </section>
  );
}
