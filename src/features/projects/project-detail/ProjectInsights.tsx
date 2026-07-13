import { CheckCircle2, Lightbulb, Trophy } from "lucide-react";
import { useEffect } from "react";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import {
  useProjectAchievementUnlocksQuery,
  useUnlockProjectAchievementMutation,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge } from "@/shared/ui/Badge";

const confidencePresentation = {
  low: { label: "ثقة منخفضة", tone: "warning" },
  medium: { label: "ثقة جيدة", tone: "info" },
  high: { label: "ثقة مرتفعة", tone: "success" },
} as const;

const unlockDateFormatter = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
  dateStyle: "medium",
});

export function ProjectInsights({
  analytics,
  projectId,
}: {
  analytics: ProjectAnalyticsSnapshot;
  projectId: string;
}) {
  const { isDemo = false } = useWorkspace();
  const confidence = confidencePresentation[analytics.confidence];
  const insights = analytics.insights.slice(0, 4);
  const unlocksQuery = useProjectAchievementUnlocksQuery(
    isDemo ? undefined : projectId,
  );
  const unlockMutation = useUnlockProjectAchievementMutation(projectId);
  const unlockMap = new Map(
    (unlocksQuery.data ?? []).map((item) => [
      item.achievementId,
      item.unlockedAt,
    ]),
  );

  useEffect(() => {
    if (isDemo) return;
    for (const achievement of analytics.achievements) {
      if (unlockMap.has(achievement.id)) continue;
      void unlockMutation.mutateAsync(achievement.id).catch(() => undefined);
    }
    // Persist newly computed achievements once; unlock RPC is idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics.achievements, isDemo, unlocksQuery.dataUpdatedAt]);

  return (
    <div
      className={`grid gap-4 ${
        analytics.achievements.length > 0 ? "lg:grid-cols-2" : ""
      }`}
    >
      <AppCard aria-labelledby="project-insights-title" className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb aria-hidden="true" className="text-primary" size={18} />
            <h2 className="font-bold text-ink" id="project-insights-title">
              رؤى المشروع
            </h2>
          </div>
          <Badge tone={confidence.tone}>{confidence.label}</Badge>
        </div>
        {insights.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">
            ستظهر الرؤى بعد تسجيل المزيد من الحركات على هذا المشروع.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {insights.map((insight) => (
              <li
                className="rounded-md bg-surface-subtle px-3 py-2.5 text-sm leading-relaxed text-ink"
                key={insight}
              >
                {insight}
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      {analytics.achievements.length > 0 ? (
        <AppCard
          aria-labelledby="project-achievements-title"
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-line p-4 sm:px-5">
            <Trophy aria-hidden="true" className="text-success" size={18} />
            <h2 className="font-bold text-ink" id="project-achievements-title">
              إنجازات مثبتة
            </h2>
          </div>
          <ul className="divide-y divide-line">
            {analytics.achievements.map((achievement) => {
              const unlockedAt = unlockMap.get(achievement.id);
              return (
                <li
                  className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
                  key={achievement.id}
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-success"
                    size={18}
                  />
                  <div>
                    <p className="text-sm font-bold text-ink">
                      {achievement.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {achievement.detail}
                    </p>
                    {unlockedAt ? (
                      <p className="mt-1 text-[11px] text-muted">
                        فُتح في{" "}
                        <time dateTime={unlockedAt}>
                          {unlockDateFormatter.format(new Date(unlockedAt))}
                        </time>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </AppCard>
      ) : null}
    </div>
  );
}
