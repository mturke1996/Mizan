import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  FolderKanban,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import type { ProjectSummary } from "@/features/workspace/workspace-types";

interface ProjectProfitabilityMatrixProps {
  projects: ProjectSummary[];
  currency: string;
}

export function ProjectProfitabilityMatrix({
  projects,
  currency,
}: ProjectProfitabilityMatrixProps) {
  const [filterMode, setFilterMode] = useState<"all" | "high_roi" | "risk">("all");

  const computedProjects = useMemo(() => {
    return projects.map((p) => {
      const revenue = Number(p.incomeMinor) / 100;
      const expense = Number(p.expenseMinor) / 100;
      const labor = Number(p.outstandingLaborMinor) / 100;
      const netProfit = revenue - expense - labor;

      const roi = expense > 0 ? (netProfit / expense) * 100 : 0;
      const laborRatio = revenue > 0 ? (labor / revenue) * 100 : 0;

      let riskLevel: "low" | "medium" | "high" = "low";
      if (netProfit < 0 || laborRatio > 50) {
        riskLevel = "high";
      } else if (laborRatio > 30 || roi < 15) {
        riskLevel = "medium";
      }

      return {
        ...p,
        revenue,
        expense,
        labor,
        netProfit,
        roi,
        laborRatio,
        riskLevel,
      };
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    let list = [...computedProjects];
    if (filterMode === "high_roi") {
      list = list.filter((p) => p.roi >= 20);
    } else if (filterMode === "risk") {
      list = list.filter((p) => p.riskLevel === "high" || p.riskLevel === "medium");
    }
    return list.sort((a, b) => b.netProfit - a.netProfit).slice(0, 4);
  }, [computedProjects, filterMode]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
      className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 backdrop-blur-md shadow-card md:p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-warning-soft text-warning ring-1 ring-inset ring-warning/25">
            <FolderKanban size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              أداء مشاريعك
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              ربحية كل مشروع ومستحقات العمالة باختصار
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-1 rounded-xl bg-surface-subtle p-1 border border-line text-xs font-semibold">
          <button
            onClick={() => setFilterMode("all")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              filterMode === "all" ? "bg-primary text-primary-on font-bold" : "text-muted hover:text-ink"
            }`}
          >
            الكل ({projects.length})
          </button>
          <button
            onClick={() => setFilterMode("high_roi")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              filterMode === "high_roi" ? "bg-success text-success-on font-bold" : "text-muted hover:text-ink"
            }`}
          >
            عالية الربحية
          </button>
          <button
            onClick={() => setFilterMode("risk")}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              filterMode === "risk" ? "bg-danger text-danger-on font-bold" : "text-muted hover:text-ink"
            }`}
          >
            تحت الملاحظة
          </button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-muted">
            لا توجد مشاريع تنطبق عليها هذه المعايير حالياً
          </div>
        ) : (
          filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              whileHover={{ y: -3, scale: 1.01 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="group relative rounded-2xl border border-line bg-surface-subtle p-4 transition-colors hover:border-primary/40 hover:bg-surface-raised"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <span className="mt-0.5 inline-block text-[11px] font-medium text-muted">
                    {project.projectType ?? "مشروع عملي"}
                  </span>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    project.riskLevel === "low"
                      ? "bg-success-soft text-success border-success/30"
                      : project.riskLevel === "medium"
                      ? "bg-warning-soft text-warning border-warning/30"
                      : "bg-danger-soft text-danger border-danger/30"
                  }`}
                >
                  {project.riskLevel === "low" ? (
                    <ShieldCheck size={12} />
                  ) : (
                    <AlertTriangle size={12} />
                  )}
                  <span>
                    {project.riskLevel === "low" ? "آمن" : project.riskLevel === "medium" ? "متوسط" : "مخاطرة"}
                  </span>
                </span>
              </div>

              {/* Metrics Row */}
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                <div>
                  <span className="block text-[10px] text-muted">الصافي المتوقع</span>
                  <span className="font-mono text-sm font-black text-ink dir-ltr block text-right">
                    {project.netProfit.toLocaleString("en-US", { maximumFractionDigits: 0 })} {currency}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted">معدل العائد (ROI)</span>
                  <span className="font-mono text-sm font-black text-success dir-ltr block text-right">
                    +{project.roi.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Quick Link Button */}
              <Link
                to={`/projects/${project.id}`}
                className="mt-3 flex items-center justify-between text-xs font-bold text-primary hover:underline"
              >
                <span>تفاصيل العمليات والعمالة</span>
                <ArrowUpRight size={14} />
              </Link>
            </motion.div>
          ))
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-4 flex justify-end">
        <Link
          to="/projects"
          className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition-colors"
        >
          <span>عرض كافة المشاريع المتاحة</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}
