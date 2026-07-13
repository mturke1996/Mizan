import { clsx } from "clsx";
import { Check } from "lucide-react";
import type { Ref } from "react";
import {
  PROJECT_BLUEPRINTS,
  PROJECT_MODULE_KEYS,
  PROJECT_MODULE_METADATA,
  PROJECT_TYPES,
} from "../project-blueprints";
import type { ProjectType } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge } from "@/shared/ui/Badge";

export interface ProjectTypeStepProps {
  headingRef: Ref<HTMLHeadingElement>;
  selectedType: ProjectType | null;
  onSelect: (type: ProjectType) => void;
  onContinue: () => void;
}

export function ProjectTypeStep({
  headingRef,
  selectedType,
  onSelect,
  onContinue,
}: ProjectTypeStepProps) {
  return (
    <section aria-labelledby="blueprint-step-title">
      <AppCard className="p-4 sm:p-5">
        <div className="mb-5">
          <h2
            ref={headingRef}
            id="blueprint-step-title"
            tabIndex={-1}
            className="text-xl font-bold text-ink"
          >
            ما نوع مشروعك؟
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            اختر الأقرب لطبيعة عملك. يمكنك تعديل الوحدات في الخطوة التالية.
          </p>
        </div>

        <fieldset>
          <legend className="sr-only">نوع المشروع</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROJECT_TYPES.map((type) => {
              const blueprint = PROJECT_BLUEPRINTS[type];
              const BlueprintIcon = blueprint.icon;
              const isSelected = selectedType === type;
              const modulePreview = PROJECT_MODULE_KEYS.filter(
                (key) => blueprint.defaultModules[key],
              );
              const descriptionId = `blueprint-${type}-description`;
              return (
                <label key={type} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name="project-blueprint"
                    value={type}
                    checked={isSelected}
                    onChange={() => onSelect(type)}
                    aria-label={blueprint.name}
                    aria-describedby={descriptionId}
                    className="peer sr-only"
                  />
                  <span
                    className={clsx(
                      "block min-h-44 rounded-md border bg-surface p-4 transition-colors duration-150 motion-reduce:transition-none peer-focus-visible:ring-3 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary-soft"
                        : "border-control-border hover:border-primary",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "grid size-11 shrink-0 place-items-center rounded-sm border",
                          isSelected
                            ? "border-primary bg-primary text-primary-on"
                            : "border-line bg-surface-subtle text-primary-ink",
                        )}
                      >
                        <BlueprintIcon size={21} strokeWidth={1.8} />
                      </span>
                      {isSelected ? (
                        <Badge
                          tone="primary"
                          icon={<Check size={13} strokeWidth={2.5} />}
                        >
                          محدد
                        </Badge>
                      ) : (
                        <span className="text-[11px] font-semibold text-muted">
                          اختر هذا النوع
                        </span>
                      )}
                    </span>
                    <strong className="mt-4 block text-base font-bold text-ink">
                      {blueprint.name}
                    </strong>
                    <span
                      id={descriptionId}
                      className="mt-1.5 block text-xs leading-5 text-muted"
                    >
                      {blueprint.description}
                    </span>
                    <span className="mt-4 flex flex-wrap gap-1.5">
                      {modulePreview.map((key) => (
                        <Badge key={key} tone="neutral">
                          {PROJECT_MODULE_METADATA[key].name}
                        </Badge>
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </AppCard>

      <button
        type="button"
        disabled={!selectedType}
        onClick={onContinue}
        className="pressable mt-5 flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        التالي: جهّز مشروعك
      </button>
    </section>
  );
}
