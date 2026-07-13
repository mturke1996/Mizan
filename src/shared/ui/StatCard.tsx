import { clsx } from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { AppCard } from "./AppCard";

export type StatCardTone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export interface StatCardProps
  extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  action?: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  label: string;
  tone?: StatCardTone;
  trend?: ReactNode;
  value: ReactNode;
  valueDir?: "ltr" | "rtl" | "auto";
}

const toneClasses: Record<StatCardTone, string> = {
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-subtle text-muted",
};

export function StatCard({
  action,
  "aria-label": ariaLabel,
  className,
  hint,
  icon,
  label,
  tone = "neutral",
  trend,
  value,
  valueDir = "ltr",
  ...props
}: StatCardProps) {
  return (
    <AppCard
      aria-label={ariaLabel ?? label}
      className={clsx("p-4 sm:p-5", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">{label}</p>
          <div
            className="mt-1.5 text-2xl leading-tight font-bold tracking-tight text-ink tabular-nums [unicode-bidi:isolate]"
            dir={valueDir}
          >
            {value}
          </div>
        </div>
        <span
          aria-hidden="true"
          className={clsx(
            "grid size-10 shrink-0 place-items-center rounded-sm",
            toneClasses[tone],
          )}
        >
          {icon}
        </span>
      </div>

      {trend != null || action != null ? (
        <div className="mt-3 flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0 text-xs font-semibold text-muted">{trend}</div>
          <div className="shrink-0">{action}</div>
        </div>
      ) : null}

      {hint != null ? (
        <div className="mt-2 text-xs leading-5 text-muted">{hint}</div>
      ) : null}
    </AppCard>
  );
}
