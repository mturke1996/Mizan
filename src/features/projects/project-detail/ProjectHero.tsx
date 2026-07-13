import {
  Landmark,
  Percent,
  Plus,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { getProjectBlueprint } from "@/features/projects/project-blueprints";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { Badge } from "@/shared/ui/Badge";
import { PageHeader } from "@/shared/ui/PageHeader";
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
  const stats = [
    {
      icon: TrendingUp,
      label: profitLabel,
      value: formatMinorAmount(analytics.profitAfterLaborMinor, {
        currency,
        locale: "en-US",
      }),
      valueDir: "ltr" as const,
    },
    {
      icon: Percent,
      label: "هامش الربح",
      value: formatProjectPercent(analytics.marginPercent),
      valueDir: analytics.marginPercent === null ? "rtl" : ("ltr" as const),
    },
    ...(project.modules.capital &&
    analytics.capitalMinor !== null &&
    analytics.capitalMinor > 0n
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
      className={`relative mb-5 overflow-hidden rounded-lg border border-line ${color.surfaceClassName}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_31px,var(--mizan-border)_31px,var(--mizan-border)_32px)]"
      />
      <div className="relative p-4 sm:p-6">
        <PageHeader
          backTo="/projects"
          subtitle={project.description}
          title={project.name}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span
                aria-hidden="true"
                className={`grid size-12 place-items-center rounded-md ${color.iconClassName}`}
              >
                <BlueprintIcon size={23} strokeWidth={1.8} />
              </span>
              <Badge tone={color.badgeTone}>{blueprint.name}</Badge>
            </div>

            <div className="mt-5 grid gap-2 min-[380px]:grid-cols-2 sm:flex">
              <Link
                aria-label="معاملة جديدة"
                className="pressable flex min-h-11 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
                to={`/transactions/new?project=${encodeURIComponent(project.id)}`}
              >
                <Plus aria-hidden="true" size={18} />
                معاملة جديدة
              </Link>
              <button
                aria-controls="project-settings-panel"
                aria-expanded={settingsOpen}
                className="pressable flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-sm font-bold text-ink hover:bg-surface-subtle"
                onClick={onOpenSettings}
                type="button"
              >
                <Settings2 aria-hidden="true" size={17} />
                إعدادات المشروع
              </button>
            </div>

            <dl
              aria-label="مؤشرات المشروع الرئيسية"
              className={`mt-6 grid gap-px overflow-hidden rounded-md border border-line bg-line ${
                stats.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"
              }`}
            >
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div className="bg-surface/95 p-4" key={stat.label}>
                    <dt className="flex items-center gap-2 text-xs font-semibold text-muted">
                      <Icon aria-hidden="true" size={16} />
                      {stat.label}
                    </dt>
                    <dd
                      className="numeric mt-2 text-xl font-bold tracking-tight text-ink [unicode-bidi:isolate]"
                      dir={stat.valueDir}
                    >
                      {stat.value}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="flex justify-center rounded-md bg-surface/80 p-4 lg:justify-self-end">
            <ProgressRing
              helper={
                <>
                  <strong className="block font-bold text-ink">
                    {analytics.healthLabel}
                  </strong>
                  <span className="mt-1 block">
                    ثقة {confidenceLabels[analytics.confidence]} من{" "}
                    <bdi className="numeric" dir="ltr">
                      {analytics.dataPoints}
                    </bdi>{" "}
                    حركات
                  </span>
                </>
              }
              label="صحة المشروع"
              size={108}
              value={analytics.healthScore}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
