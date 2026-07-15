import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CircleDot,
  FolderKanban,
  Landmark,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { formatMinorAmount } from "@/domain/money/money";
import { getProjectBlueprint } from "@/features/projects/project-blueprints";
import { groupProjectsByParent } from "@/features/projects/parent-project-tree";
import { useProjectStore } from "@/features/projects/project-store";
import {
  useArchiveProjectMutation,
} from "@/features/workspace/use-finance-data";
import { useProjectsView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge } from "@/shared/ui/Badge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import { StatCard } from "@/shared/ui/StatCard";

function projectNet(project: ProjectSummary): bigint {
  const labor =
    project.modules.workers ? project.outstandingLaborMinor : 0n;
  return project.profitMinor - labor;
}

function ProjectListRow({
  busy,
  currency,
  onDelete,
  project,
}: {
  busy: boolean;
  currency: string;
  onDelete: (project: ProjectSummary) => void;
  project: ProjectSummary;
}) {
  const blueprint = getProjectBlueprint(project.projectType);
  const BlueprintIcon = blueprint.icon;
  const net = projectNet(project);
  const margin =
    project.incomeMinor > 0n
      ? Number((net * 10000n) / project.incomeMinor) / 100
      : 0;
  const showWorkers =
    project.modules.workers && project.activeWorkers > 0;
  const showGoal =
    project.modules.goal && project.goalMinor !== undefined;
  const showInventory =
    project.modules.inventory && project.inventoryItemCount > 0;
  const showCapital =
    project.modules.capital && project.capitalMinor > 0n;
  const metaVisible =
    showGoal || showWorkers || showInventory || showCapital;

  return (
    <li className="group relative">
      <div className="flex items-stretch">
        <Link
          to={`/projects/${project.id}`}
          className="pressable flex min-w-0 flex-1 items-start gap-3 px-4 py-4 hover:bg-surface-subtle sm:px-5"
        >
          <span
            className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-sm ${project.tone}`}
          >
            <BlueprintIcon aria-hidden="true" size={20} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-bold text-ink">
                    {project.name}
                  </span>
                  <Badge tone="neutral">{blueprint.name}</Badge>
                </span>
                {project.description ? (
                  <span className="mt-1 block truncate text-xs text-muted">
                    {project.description}
                  </span>
                ) : null}
              </span>

              <span className="shrink-0 text-left">
                <span
                  className={`numeric block text-sm font-bold ${
                    net >= 0n ? "text-success" : "text-danger"
                  }`}
                >
                  {formatMinorAmount(net, {
                    currency,
                    locale: "en-US",
                    fractionDigits: 0,
                  })}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  هامش {margin.toFixed(0)}%
                </span>
              </span>
            </span>

            <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1">
                <ArrowDownLeft
                  aria-hidden="true"
                  className="text-success"
                  size={12}
                />
                <span className="numeric font-semibold text-ink">
                  {formatMinorAmount(project.incomeMinor, {
                    currency,
                    locale: "en-US",
                    fractionDigits: 0,
                  })}
                </span>
              </span>
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight
                  aria-hidden="true"
                  className="text-danger"
                  size={12}
                />
                <span className="numeric font-semibold text-ink">
                  {formatMinorAmount(project.expenseMinor, {
                    currency,
                    locale: "en-US",
                    fractionDigits: 0,
                  })}
                </span>
              </span>
              {metaVisible ? (
                <>
                  {showGoal ? (
                    <span>
                      تقدم{" "}
                      <strong className="numeric text-ink">
                        {project.progress}%
                      </strong>
                    </span>
                  ) : null}
                  {showWorkers ? (
                    <span className="inline-flex items-center gap-1">
                      <Users aria-hidden="true" size={12} />
                      {project.activeWorkers} ·{" "}
                      <strong className="numeric text-ink">
                        {formatMinorAmount(project.outstandingLaborMinor, {
                          currency,
                          locale: "en-US",
                          fractionDigits: 0,
                        })}
                      </strong>
                    </span>
                  ) : null}
                  {showCapital ? (
                    <span className="inline-flex items-center gap-1">
                      <Landmark aria-hidden="true" size={12} />
                      <strong className="numeric text-ink">
                        {formatMinorAmount(project.capitalMinor, {
                          currency,
                          locale: "en-US",
                          fractionDigits: 0,
                        })}
                      </strong>
                    </span>
                  ) : null}
                  {showInventory ? (
                    <span className="inline-flex items-center gap-1">
                      <Boxes aria-hidden="true" size={12} />
                      {project.inventoryItemCount}
                    </span>
                  ) : null}
                </>
              ) : null}
            </span>

            {showGoal ? (
              <progress
                max={100}
                value={project.progress}
                aria-label={`تقدم ${project.name}`}
                className="mt-3 h-1.5 w-full overflow-hidden rounded-full accent-primary"
              />
            ) : null}
          </span>
        </Link>

        <div className="flex items-center border-s border-line px-2 sm:px-3">
          <button
            aria-label={`حذف ${project.name}`}
            className="pressable grid size-11 shrink-0 place-items-center rounded-sm border border-line text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger disabled:cursor-wait disabled:opacity-50"
            disabled={busy}
            onClick={() => onDelete(project)}
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

export function ProjectsPage() {
  const { currency, isDemo = false } = useWorkspace();
  const { projects, isLoading, error, refresh } = useProjectsView();
  const archiveDemoProject = useProjectStore((state) => state.archiveProject);
  const archiveProject = useArchiveProjectMutation();
  const confirm = useConfirm();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteLock = useRef(false);

  const activeProjects = projects.filter(
    (project) => project.status === "active",
  );
  const totalProfit = activeProjects.reduce(
    (total, project) => total + projectNet(project),
    0n,
  );
  const totalLabor = activeProjects.reduce(
    (total, project) =>
      total +
      (project.modules.workers ? project.outstandingLaborMinor : 0n),
    0n,
  );
  const sorted = [...activeProjects].sort((a, b) => {
    const aNet = projectNet(a);
    const bNet = projectNet(b);
    return aNet === bNet ? 0 : aNet > bNet ? -1 : 1;
  });
  const grouped = groupProjectsByParent(sorted);
  const listBlocks = [
    ...grouped.roots.map((group) => ({
      key: `root-${group.parent.id}`,
      kind: "group" as const,
      group,
    })),
    ...[...grouped.standalone, ...grouped.orphans].map((project) => ({
      key: `solo-${project.id}`,
      kind: "solo" as const,
      project,
    })),
  ];

  const deleteProject = async (project: ProjectSummary) => {
    if (deleteLock.current || deletingId) return;
    const ok = await confirm({
      title: `حذف مشروع «${project.name}»؟`,
      description: "سيُزال من القائمة النشطة.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;

    deleteLock.current = true;
    setDeletingId(project.id);
    try {
      if (isDemo) {
        archiveDemoProject(project.id);
      } else {
        await archiveProject.mutateAsync({
          projectId: project.id,
          projectType: project.projectType,
          modules: project.modules,
        });
      }
      toast.success("تم حذف المشروع");
    } catch (err) {
      toast.error(getUserErrorMessage(err, "تعذر حذف المشروع"));
    } finally {
      deleteLock.current = false;
      setDeletingId(null);
    }
  };

  const pageHeader = (
    <PageHeader
      title="المشاريع"
      subtitle="مخططات ذكية لأرباحك ووحدات مشروعك بدقة."
      action={
        <Link
          to="/projects/new"
          aria-label="إضافة مشروع"
          className="pressable flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
        >
          <Plus aria-hidden="true" size={18} />
          إضافة
        </Link>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6">
        {pageHeader}
        <div className="grid gap-3" role="status">
          <div className="grid grid-cols-2 gap-3">
            <AppCard className="h-28 animate-pulse bg-surface-subtle" />
            <AppCard className="h-28 animate-pulse bg-surface-subtle" />
          </div>
          <AppCard className="h-56 animate-pulse bg-surface-subtle" />
          <span className="sr-only">جاري تحميل المشاريع</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6">
        {pageHeader}
        <ErrorState message={error} onRetry={() => void refresh()} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      {pageHeader}

      <section
        aria-label="ملخص المشاريع"
        className="mb-5 grid grid-cols-2 gap-3"
      >
        <StatCard
          icon={<TrendingUp aria-hidden="true" size={20} />}
          label="الصافي بعد الالتزامات"
          tone="success"
          value={
            <>
              {formatMinorAmount(totalProfit, {
                currency,
                locale: "en-US",
              })}
              <span className="ms-1.5 text-[10px] font-bold text-muted">
                {currency}
              </span>
            </>
          }
        />
        <StatCard
          icon={<CircleDot aria-hidden="true" size={20} />}
          label="مشاريع نشطة"
          tone="primary"
          value={activeProjects.length}
        />
      </section>

      {totalLabor > 0n ? (
        <AppCard className="mb-5 flex items-center gap-3 p-4">
          <span className="flex size-10 items-center justify-center rounded-sm bg-warning-soft text-warning">
            <Users aria-hidden="true" size={18} />
          </span>
          <div>
            <p className="text-xs text-muted">مستحقات عمال معلّقة</p>
            <p className="numeric mt-1 text-lg font-bold text-ink">
              {formatMinorAmount(totalLabor, {
                currency,
                locale: "en-US",
              })}{" "}
              <span className="text-xs font-bold text-muted">{currency}</span>
            </p>
          </div>
        </AppCard>
      ) : null}

      <section aria-labelledby="active-projects-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2
              id="active-projects-title"
              className="text-lg font-bold text-ink"
            >
              المشاريع النشطة
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              مرتبة حسب الصافي مع تجميع المشاريع الفرعية
            </p>
          </div>
          {listBlocks.length > 0 ? (
            <span className="numeric text-xs font-semibold text-muted">
              {sorted.length}
            </span>
          ) : null}
        </div>

        {listBlocks.length === 0 ? (
          <EmptyState
            icon={<FolderKanban aria-hidden="true" size={22} />}
            title="لا مشاريع بعد"
            description="أنشئ مشروعًا بمخطط يناسب نوع عملك ثم فعّل وحداته."
            action={
              <Link
                to="/projects/new"
                className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
              >
                <Plus aria-hidden="true" size={16} />
                إنشاء مشروع
              </Link>
            }
          />
        ) : (
          <AppCard className="overflow-hidden p-0" elevated>
            <ul className="divide-y divide-line">
              {listBlocks.map((block) => {
                if (block.kind === "solo") {
                  return (
                    <ProjectListRow
                      key={block.key}
                      busy={deletingId === block.project.id}
                      currency={currency}
                      onDelete={(target) => void deleteProject(target)}
                      project={block.project}
                    />
                  );
                }

                const { group } = block;
                return (
                  <li key={block.key}>
                    <div className="border-b border-line bg-surface-subtle/70 px-4 py-2 text-xs text-muted sm:px-5">
                      مشروع أب · {group.childCount} فرعي · صافي مجمّع{" "}
                      <bdi className="numeric font-bold text-ink" dir="ltr">
                        {formatMinorAmount(group.rolledProfitMinor, {
                          currency,
                          locale: "en-US",
                        })}
                      </bdi>
                    </div>
                    <ul className="divide-y divide-line">
                      <ProjectListRow
                        busy={deletingId === group.parent.id}
                        currency={currency}
                        onDelete={(target) => void deleteProject(target)}
                        project={group.parent}
                      />
                      {group.children.map((child) => (
                        <ProjectListRow
                          busy={deletingId === child.id}
                          currency={currency}
                          key={child.id}
                          onDelete={(target) => void deleteProject(target)}
                          project={child}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </AppCard>
        )}
      </section>
    </div>
  );
}
