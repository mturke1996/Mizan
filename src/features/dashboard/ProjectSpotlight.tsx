import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";

export function ProjectSpotlight({
  projects,
  currency = "LYD",
}: {
  projects: ProjectSummary[];
  currency?: string;
}) {
  const best = [...projects]
    .filter((project) => project.status === "active")
    .sort((a, b) => {
      const aNet = a.profitMinor - a.outstandingLaborMinor;
      const bNet = b.profitMinor - b.outstandingLaborMinor;
      return aNet === bNet ? 0 : aNet > bNet ? -1 : 1;
    })[0];
  const bestNet = best
    ? best.profitMinor - best.outstandingLaborMinor
    : 0n;

  return (
    <section aria-labelledby="project-title" className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="project-title" className="text-lg font-bold text-ink">
          أفضل مشروع
        </h2>
        <Link
          to="/projects"
          className="pressable flex min-h-11 items-center gap-1 rounded-sm px-2 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          المشاريع
          <ArrowLeft aria-hidden="true" size={16} />
        </Link>
      </div>

      {!best ? (
        <AppCard className="p-4 text-sm text-muted">
          لا مشاريع بعد. أنشئ مشروعًا لترى أقوى أداء هنا.
        </AppCard>
      ) : (
        <Link to={`/projects/${best.id}`} className="block">
          <AppCard
            elevated
            className="pressable flex items-center gap-4 overflow-hidden p-4 hover:border-line-strong"
          >
            <div
              className={`flex size-16 shrink-0 items-center justify-center rounded-md text-2xl font-bold ${best.tone}`}
            >
              {best.mark}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">{best.name}</p>
              <p className="mt-1 text-xs text-muted">{best.description}</p>
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span
                  className={`font-semibold ${
                    bestNet >= 0n ? "text-success" : "text-danger"
                  }`}
                >
                  صافي{" "}
                  {formatMinorAmount(bestNet, {
                    currency,
                    locale: "en-US",
                  })}
                </span>
                {best.activeWorkers > 0 ? (
                  <span className="text-muted">
                    {best.activeWorkers} عمال
                  </span>
                ) : null}
              </div>
            </div>
            <ArrowLeft aria-hidden="true" size={20} className="text-soft" />
          </AppCard>
        </Link>
      )}
    </section>
  );
}
