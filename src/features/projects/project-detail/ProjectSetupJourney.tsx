import { Check, CheckCircle2, ChevronLeft, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import type {
  ProjectAnalyticsSetupAction,
  ProjectAnalyticsSnapshot,
} from "@/domain/analytics/compute-project-analytics";
import { AppCard } from "@/shared/ui/AppCard";
import { ProgressRing } from "@/shared/ui/ProgressRing";

interface ProjectSetupJourneyProps {
  analytics: ProjectAnalyticsSnapshot;
  onOpenSettings: () => void;
  projectId: string;
}

const actionTabs: Partial<
  Record<ProjectAnalyticsSetupAction, "capital" | "workers" | "inventory">
> = {
  record_capital: "capital",
  add_worker: "workers",
  add_inventory_item: "inventory",
};

function actionRoute(
  projectId: string,
  action: ProjectAnalyticsSetupAction | undefined,
): string | null {
  if (!action) return null;
  const tab = actionTabs[action];
  return tab
    ? `/projects/${encodeURIComponent(projectId)}?tab=${tab}`
    : null;
}

export function ProjectSetupJourney({
  analytics,
  onOpenSettings,
  projectId,
}: ProjectSetupJourneyProps) {
  if (analytics.setupComplete) {
    return (
      <AppCard
        aria-labelledby="project-setup-complete-title"
        className="flex items-start gap-3 bg-success-soft p-4 sm:p-5"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-surface text-success">
          <CheckCircle2 aria-hidden="true" size={20} />
        </span>
        <div>
          <h2
            className="font-bold text-ink"
            id="project-setup-complete-title"
          >
            اكتمل إعداد المشروع
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            الوحدات المفعّلة لديها بيانات البداية اللازمة. يمكنك متابعة
            التشغيل من الأقسام أعلاه.
          </p>
        </div>
      </AppCard>
    );
  }

  return (
    <AppCard
      aria-labelledby="project-setup-title"
      className="overflow-hidden"
    >
      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[9rem_minmax(0,1fr)] md:items-center">
        <div className="flex justify-center">
          <ProgressRing
            helper={`${analytics.setupSteps.filter((step) => step.completed).length} من ${analytics.setupSteps.length} خطوات`}
            label="جاهزية الإعداد"
            size={104}
            value={analytics.setupProgress}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <ListChecks aria-hidden="true" className="text-primary" size={19} />
            <h2 className="font-bold text-ink" id="project-setup-title">
              خطوات الإعداد
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            أكمل الخطوات الناقصة ليعتمد التحليل على صورة تشغيلية أوضح.
          </p>
          <progress
            aria-label="نسبة اكتمال إعداد المشروع"
            className="mt-4 h-2 w-full"
            max={100}
            value={analytics.setupProgress}
          />
        </div>
      </div>

      <ol className="divide-y divide-line border-t border-line">
        {analytics.setupSteps.map((step) => {
          const route = step.route ?? actionRoute(projectId, step.action);
          return (
            <li
              className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
              key={step.id}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-xs ${
                  step.completed
                    ? "bg-success-soft text-success"
                    : "bg-surface-subtle text-muted"
                }`}
              >
                {step.completed ? <Check size={15} /> : <span>•</span>}
              </span>
              <div className="min-w-0 flex-1">
                {step.completed ? (
                  <p className="text-sm font-bold text-ink">{step.title}</p>
                ) : route ? (
                  <Link
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary-ink hover:text-primary"
                    to={route}
                  >
                    {step.title}
                    <ChevronLeft aria-hidden="true" size={15} />
                  </Link>
                ) : step.action === "configure_goal" ? (
                  <button
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary-ink hover:text-primary"
                    onClick={onOpenSettings}
                    type="button"
                  >
                    {step.title}
                    <ChevronLeft aria-hidden="true" size={15} />
                  </button>
                ) : (
                  <p className="text-sm font-bold text-ink">{step.title}</p>
                )}
                <p className="text-xs leading-5 text-muted">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </AppCard>
  );
}
