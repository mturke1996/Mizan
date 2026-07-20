import {
  ArrowRight,
  HardHat,
  Landmark,
  Percent,
  Plus,
  Settings2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { getProjectBlueprint } from "@/features/projects/project-blueprints";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { Badge } from "@/shared/ui/Badge";
import { ProgressRing } from "@/shared/ui/ProgressRing";
import {
  formatProjectPercent,
  getProjectColorPresentation,
} from "./project-detail-config";

const confidenceLabels = {
  low: "منخفضة",
  medium: "جيدة",
  high: "مرتفعة",
} as const;

interface ProjectHeroProps {
  analytics: ProjectAnalyticsSnapshot;
  currency: string;
  onOpenSettings: () => void;
  project: ProjectSummary;
  settingsOpen: boolean;
}

export function ProjectHero({
  analytics,
  currency,
  onOpenSettings,
  project,
  settingsOpen,
}: ProjectHeroProps) {
  const blueprint = getProjectBlueprint(project.projectType);
  const BlueprintIcon = blueprint.icon;
  const color = getProjectColorPresentation(project.colorToken);
  const profitLabel = project.modules.workers
    ? "الربح بعد العمال"
    : "صافي الربح";
  const profitPositive = analytics.profitAfterLaborMinor >= 0n;
  const showCapital =
    project.modules.capital &&
    analytics.capitalMinor !== null &&
    analytics.capitalMinor > 0n;

  const metrics = [
    {
      icon: Percent,
      label: "هامش الربح",
      value: formatProjectPercent(analytics.marginPercent),
      valueDir:
        analytics.marginPercent === null ? ("rtl" as const) : ("ltr" as const),
    },
    ...(showCapital
      ? [
          {
            icon: Landmark,
            label: "استرداد رأس المال",
            value: formatProjectPercent(analytics.capitalRecoveredRate),
            valueDir: "ltr" as const,
          },
          {
            icon: Percent,
            label: "عائد رأس المال (ROI)",
            value: formatProjectPercent(analytics.returnOnCapitalRate),
            valueDir: "ltr" as const,
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label={`ملف المشروع ${project.name}`}
      className="mb-5 space-y-3"
    >
      <div className="flex items-center pt-1">
        <Link
          to="/projects"
          aria-label="العودة"
          className="pressable flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink"
        >
          <ArrowRight aria-hidden="true" size={20} />
        </Link>
      </div>

      <header className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className={`grid size-14 shrink-0 place-items-center rounded-[18px] sm:size-16 ${color.iconClassName}`}
        >
          <BlueprintIcon size={26} strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] leading-tight font-bold tracking-[-0.03em] text-ink sm:text-[28px]">
              {project.name}
            </h1>
            <Badge tone={color.badgeTone}>{blueprint.name}</Badge>
          </div>
          {project.description ? (
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-muted">
              {project.description}
            </p>
          ) : null}
        </div>
      </header>

      <div className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_12px_36px_rgb(27_30_60/6%)]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_11.5rem]">
          <div className="p-5 sm:p-6">
            <p className="text-[11px] font-semibold tracking-wide text-muted">
              {profitLabel}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <strong
                className={`numeric text-[42px] leading-none font-black tracking-tight sm:text-[48px] ${
                  profitPositive ? "text-ink" : "text-danger"
                }`}
                dir="ltr"
              >
                {formatMinorAmount(analytics.profitAfterLaborMinor, {
                  currency,
                  locale: "en-US",
                })}
              </strong>
              <span className="text-sm font-bold text-muted">{currency}</span>
            </p>
            <p className="mt-3 text-xs text-muted">
              {analytics.dataPoints > 0 ? (
                <>
                  من{" "}
                  <bdi className="numeric font-semibold text-ink" dir="ltr">
                    {analytics.dataPoints}
                  </bdi>{" "}
                  حركة مسجّلة · ثقة {confidenceLabels[analytics.confidence]}
                </>
              ) : (
                "أضف معاملات لبناء صورة أدق للأداء"
              )}
            </p>
          </div>

          <div
            className={`flex items-center justify-center border-t border-line px-4 py-5 lg:border-t-0 lg:border-s ${color.surfaceClassName}`}
          >
            <ProgressRing
              helper={
                <>
                  <strong className="block font-bold text-ink">
                    {analytics.healthLabel}
                  </strong>
                  <span className="mt-1 block text-[11px]">صحة المشروع</span>
                </>
              }
              label="صحة المشروع"
              size={108}
              value={analytics.healthScore}
            />
          </div>
        </div>

        <dl
          aria-label="مؤشرات المشروع الرئيسية"
          className={`grid divide-y divide-line border-t border-line sm:divide-y-0 sm:divide-x sm:divide-x-reverse ${
            metrics.length >= 3
              ? "sm:grid-cols-3"
              : metrics.length === 2
                ? "sm:grid-cols-2"
                : "sm:grid-cols-1"
          }`}
        >
          {metrics.map((stat) => {
            const Icon = stat.icon;
            return (
              <div className="px-5 py-4" key={stat.label}>
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <Icon aria-hidden="true" size={14} />
                  {stat.label}
                </dt>
                <dd
                  className="numeric mt-1.5 text-xl font-black tracking-tight text-ink [unicode-bidi:isolate]"
                  dir={stat.valueDir}
                >
                  {stat.value}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      <div
        className={`grid gap-2 ${
          project.modules.workers ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"
        }`}
      >
        {project.modules.workers ? (
          <Link
            aria-label="تسجيل يومية عمال"
            className="pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-primary-on hover:bg-primary-hover"
            to={`/projects/${encodeURIComponent(project.id)}?tab=workers`}
          >
            <HardHat aria-hidden="true" size={18} />
            تسجيل يومية
          </Link>
        ) : null}
        <Link
          aria-label="معاملة جديدة"
          className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold ${
            project.modules.workers
              ? "border border-line bg-surface text-ink hover:bg-surface-subtle"
              : "bg-primary text-primary-on hover:bg-primary-hover"
          }`}
          to={`/transactions/new?project=${encodeURIComponent(project.id)}`}
        >
          <Plus aria-hidden="true" size={18} />
          معاملة جديدة
        </Link>
        <button
          aria-controls="project-settings-panel"
          aria-expanded={settingsOpen}
          className="pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold text-ink hover:bg-surface-subtle"
          onClick={onOpenSettings}
          type="button"
        >
          <Settings2 aria-hidden="true" size={17} />
          إعدادات المشروع
        </button>
      </div>
    </section>
  );
}
