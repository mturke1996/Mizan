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
  { icon: string }
> = {
  primary: {
    icon: "bg-primary-soft text-primary",
  },
  success: {
    icon: "bg-success-soft text-success",
  },
  danger: {
    icon: "bg-danger-soft text-danger",
  },
  warning: {
    icon: "bg-warning-soft text-warning",
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
  label: string;
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
    <article className="relative min-w-0 rounded-[12px] border border-line bg-surface p-4 shadow-[0_2px_14px_rgb(27_30_60/3%)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted sm:text-xs">
            {label}
          </p>
          <p className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <strong className="numeric min-w-0 text-[17px] leading-none font-bold tracking-[-0.025em] text-ink min-[390px]:text-[19px] sm:text-2xl">
              {value}
            </strong>
            {suffix ? (
              <span className="shrink-0 text-[10px] font-bold text-muted">
                {suffix}
              </span>
            ) : null}
          </p>
        </div>
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${classes.icon}`}
        >
          <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
        </span>
      </div>

      <div className="mt-4 min-h-5">
        {trend != null ? (
          <p className="flex items-center gap-1.5 text-[10px] text-muted sm:text-[11px]">
            <span
              className={`numeric inline-flex items-center gap-0.5 font-bold ${trendTone}`}
            >
              <TrendIcon aria-hidden="true" size={12} />
              {trend > 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
            <span>{trendLabel}</span>
          </p>
        ) : (
          <p className="truncate text-[10px] text-muted sm:text-[11px]">
            {helper ?? "يتحدث تلقائيًا من بياناتك"}
          </p>
        )}
      </div>
    </article>
  );
}
