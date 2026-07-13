import { ArrowLeft, CheckCircle2, CircleGauge } from "lucide-react";
import { Link } from "react-router-dom";
import type {
  AnalyticsConfidence,
  AnalyticsSnapshot,
} from "@/domain/analytics/compute-analytics";

const confidenceLabels: Record<AnalyticsConfidence, string> = {
  low: "ثقة أولية",
  medium: "ثقة جيدة",
  high: "ثقة مرتفعة",
};

export function FinancialHealthPanel({
  analytics,
}: {
  analytics: AnalyticsSnapshot;
}) {
  const score = analytics.healthScore ?? 0;
  const ringLength = 251.2;
  const ringOffset = ringLength - (ringLength * score) / 100;
  const scoreTone =
    analytics.healthScore == null
      ? "text-muted"
      : score >= 65
        ? "text-success"
        : score >= 45
          ? "text-warning"
          : "text-danger";
  const insightItems =
    analytics.insights.length > 0
      ? analytics.insights.slice(0, 3)
      : ["أضف ثلاث حركات مالية على الأقل للحصول على قراءة موثوقة."];

  return (
    <section
      aria-labelledby="financial-health-title"
      className="rounded-[14px] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="financial-health-title" className="text-sm font-bold text-ink">
            نبضك المالي
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            قراءة من {analytics.dataPoints} حركة فعلية
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-success-soft px-2 py-1 text-[10px] font-bold text-success">
          <span className="size-1.5 rounded-full bg-success" />
          {confidenceLabels[analytics.confidence]}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative grid size-28 shrink-0 place-items-center">
          <svg
            viewBox="0 0 96 96"
            className="absolute inset-0 size-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="var(--mizan-surface-strong)"
              strokeWidth="7"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={ringLength}
              strokeDashoffset={ringOffset}
              className={scoreTone}
            />
          </svg>
          <div className="text-center">
            <strong className={`numeric block text-2xl font-black ${scoreTone}`}>
              {analytics.healthScore ?? "—"}
            </strong>
            <span className="mt-0.5 block text-[10px] text-muted">من 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CircleGauge className={scoreTone} size={17} aria-hidden="true" />
            <p className="font-bold text-ink">{analytics.healthLabel}</p>
          </div>
          <p className="mt-2 text-xs leading-6 text-muted">
            معدل الادخار{" "}
            <span className="numeric font-bold text-ink">
              {analytics.savingsRate.toFixed(1)}%
            </span>
            {analytics.runwayDays != null
              ? ` · سيولتك تغطي ${analytics.runwayDays} يومًا`
              : ""}
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-3 border-t border-line pt-4">
        {insightItems.map((insight) => (
          <li
            key={insight}
            className="flex items-start gap-2 text-[11px] leading-5 text-muted"
          >
            <CheckCircle2
              aria-hidden="true"
              size={15}
              className="mt-0.5 shrink-0 text-primary"
            />
            <span>{insight}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/analytics"
        className="pressable mt-5 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[10px] bg-primary-soft text-xs font-bold text-primary hover:bg-primary hover:text-primary-on"
      >
        افتح التحليل الكامل
        <ArrowLeft aria-hidden="true" size={14} />
      </Link>
    </section>
  );
}
