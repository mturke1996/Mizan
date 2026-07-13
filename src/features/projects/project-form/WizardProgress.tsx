import { clsx } from "clsx";
import { Check } from "lucide-react";
import type { WizardStep } from "../use-project-wizard";
import { WIZARD_STEPS } from "./project-form-config";

export interface WizardProgressProps {
  step: WizardStep;
}

export function WizardProgress({ step }: WizardProgressProps) {
  return (
    <nav
      aria-label="مراحل إنشاء المشروع"
      className="rounded-md border border-line bg-surface p-3 md:sticky md:top-6 md:self-start"
    >
      <ol className="grid grid-cols-3 gap-2 md:grid-cols-1">
        {WIZARD_STEPS.map((item) => {
          const status =
            item.number < step
              ? "مكتملة"
              : item.number === step
                ? "الحالية"
                : "قادمة";
          const isCurrent = item.number === step;
          const isComplete = item.number < step;
          return (
            <li
              key={item.number}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`${item.title}: ${status}`}
              className={clsx(
                "flex min-h-11 min-w-0 items-center gap-2 rounded-sm px-2 py-2",
                isCurrent && "bg-primary-soft text-primary-ink",
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                  isComplete
                    ? "border-success bg-success text-success-on"
                    : isCurrent
                      ? "border-primary bg-primary text-primary-on"
                      : "border-line-strong bg-surface-subtle text-muted",
                )}
              >
                {isComplete ? <Check size={14} strokeWidth={2.5} /> : item.number}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold md:text-xs">
                  {item.title}
                </span>
                <span className="mt-0.5 hidden text-[10px] text-muted md:block">
                  {status}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
