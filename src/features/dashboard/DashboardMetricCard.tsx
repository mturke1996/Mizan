import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

type MetricTone = "primary" | "success" | "danger" | "warning";

const toneClasses: Record<
  MetricTone,
  { icon: string; wash: string; edge: string }
> = {
  primary: {
    icon: "bg-primary-soft text-primary",
    wash: "bg-primary-soft/40",
    edge: "border-primary/15",
  },
  success: {
    icon: "bg-success-soft text-success",
    wash: "bg-success-soft/40",
    edge: "border-success/15",
  },
  danger: {
    icon: "bg-danger-soft text-danger",
    wash: "bg-danger-soft/35",
    edge: "border-danger/15",
  },
  warning: {
    icon: "bg-warning-soft text-warning",
    wash: "bg-warning-soft/45",
    edge: "border-warning/20",
  },
};

export function DashboardMetricCard({
  label,
  value,
  suffix,
  helper,
  trend,
  trendLabel = "عن الشهر السابق",
  icon: Icon,
  tone = "primary",
  invertTrend = false,
}: {
  label: ReactNode;
  value: ReactNode;
  suffix?: string;
  helper?: string;
  trend?: number | null;
  trendLabel?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  invertTrend?: boolean;
}) {
  const classes = toneClasses[tone];
  const positive = trend != null && trend > 0;
  const negative = trend != null && trend < 0;
  const favorable = trend == null ? null : invertTrend ? trend <= 0 : trend >= 0;
  const TrendIcon = positive
    ? ArrowUpRight
    : negative
      ? ArrowDownRight
      : Minus;
  const trendTone =
    favorable == null
      ? "text-muted"
      : favorable
        ? "text-success"
        : "text-danger";

  return (
    <article
      className={[
        // Force a single clipped paint layer (fixes Android white-box overflow)
        "relative h-full min-w-0 isolate overflow-hidden rounded-2xl border bg-surface",
        "shadow-[0_1px_0_rgb(25_28_54/4%),0_8px_20px_rgb(25_28_54/5%)]",
        "[transform:translateZ(0)] [backface-visibility:hidden]",
        classes.edge,
      ].join(" ")}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${classes.wash}`}
      />
      <div className="relative flex h-full flex-col p-3.5 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[11px] font-semibold leading-4 text-muted sm:text-xs">
            {label}
          </p>
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-xl ${classes.icon}`}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.9} />
          </span>
        </div>

        <p className="mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0.5">
          <strong
            className="numeric max-w-full truncate text-[17px] font-bold leading-none tracking-tight text-ink min-[390px]:text-[19px] sm:text-[22px]"
            dir="ltr"
          >
            {value}
          </strong>
          {suffix ? (
            <span className="shrink-0 text-[10px] font-bold text-muted">
              {suffix}
            </span>
          ) : null}
        </p>

        <div className="mt-auto pt-3">
          {trend != null ? (
            <p className="flex items-center gap-1 text-[10px] text-muted sm:text-[11px]">
              <span
                className={`numeric inline-flex items-center gap-0.5 font-bold ${trendTone}`}
              >
                <TrendIcon aria-hidden="true" size={12} />
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1)}%
              </span>
              <span className="truncate">{trendLabel}</span>
            </p>
          ) : (
            <p className="truncate text-[10px] text-muted sm:text-[11px]">
              {helper ?? "يتحدث تلقائيًا من بياناتك"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
