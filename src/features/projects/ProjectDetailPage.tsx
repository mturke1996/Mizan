import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { computeProjectAnalytics } from "@/domain/analytics/compute-project-analytics";
import { useAuth } from "@/features/auth/use-auth";
import { ProjectCapitalTab } from "@/features/projects/project-detail/ProjectCapitalTab";
import { ProjectDetailErrorState } from "@/features/projects/project-detail/ProjectDetailStates";
import {
  ProjectDetailLoadingState,
  ProjectDetailNotFoundState,
} from "@/features/projects/project-detail/ProjectDetailStates";
import { ProjectHero } from "@/features/projects/project-detail/ProjectHero";
import { ProjectInventoryTab } from "@/features/projects/project-detail/ProjectInventoryTab";
import { ProjectLivestockTab } from "@/features/projects/project-detail/ProjectLivestockTab";
import { ProjectOverview } from "@/features/projects/project-detail/ProjectOverview";
import { ProjectSettingsPanel } from "@/features/projects/project-detail/ProjectSettingsPanel";
import { ProjectTransactionsTab } from "@/features/projects/project-detail/ProjectTransactionsTab";
import { ProjectWorkersTab } from "@/features/projects/project-detail/ProjectWorkersTab";

const ProjectCashTab = lazy(() =>
  import("@/features/projects/project-detail/ProjectCashTab").then((m) => ({
    default: m.ProjectCashTab,
  })),
);
import {
  PROJECT_DETAIL_TABS_ID,
  getProjectDetailTabs,
  parseProjectDetailTabId,
  type ProjectDetailTabId,
} from "@/features/projects/project-detail/project-detail-config";
import { useProjectTransactionsQuery } from "@/features/workspace/use-finance-data";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  ProjectModules,
  ProjectSummary,
  ProjectType,
} from "@/features/workspace/workspace-types";
import {
  getSectionTabId,
  getSectionTabPanelId,
} from "@/shared/ui/section-tabs-ids";
import { resolveActiveTabId } from "@/shared/ui/section-tabs-utils";
import { SectionTabs } from "@/shared/ui/SectionTabs";

interface ModuleOverride {
  modules: ProjectModules;
  projectId: string;
  projectType?: ProjectType;
  goalMinor?: bigint;
  clearGoal?: boolean;
}

function applyModuleOverride(
  project: ProjectSummary | undefined,
  override: ModuleOverride | null,
): ProjectSummary | undefined {
  if (!project || override?.projectId !== project.id) return project;
  return {
    ...project,
    modules: override.modules,
    ...(override.projectType ? { projectType: override.projectType } : {}),
    ...(override.clearGoal
      ? { goalMinor: undefined, progress: 0 }
      : override.goalMinor !== undefined
        ? {
            goalMinor: override.goalMinor,
            progress:
              override.goalMinor > 0n && project.incomeMinor > 0n
                ? Number(
                    (project.incomeMinor * 100n) / override.goalMinor > 100n
                      ? 100n
                      : (project.incomeMinor * 100n) / override.goalMinor,
                  )
                : 0,
          }
        : {}),
  };
}

function resolveActiveModuleOverride(
  project: ProjectSummary | undefined,
  override: ModuleOverride | null,
): ModuleOverride | null {
  if (!project || !override || override.projectId !== project.id) {
    return null;
  }
  const modulesMatch =
    project.modules.goal === override.modules.goal &&
    project.modules.workers === override.modules.workers &&
    project.modules.capital === override.modules.capital &&
    project.modules.inventory === override.modules.inventory &&
    project.modules.livestock === override.modules.livestock;
  const typeMatch =
    !override.projectType || project.projectType === override.projectType;
  const goalMatch = override.clearGoal
    ? project.goalMinor === undefined
    : override.goalMinor === undefined ||
      project.goalMinor === override.goalMinor;
  if (modulesMatch && goalMatch && typeMatch) {
    return null;
  }
  return override;
}

function queryErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const { currency, isDemo = false } = useWorkspace();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjectsView();
  const {
    wallets,
    transactions,
    isLoading: financeLoading,
    error: financeError,
    refresh: refreshFinance,
  } = useFinanceView();
  const project = projects.find((candidate) => candidate.id === projectId);
  const projectTransactionsQuery = useProjectTransactionsQuery(project?.id);
  const resolvedTimeZone = profile?.timezone ?? "Africa/Tripoli";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moduleOverride, setModuleOverride] = useState<ModuleOverride | null>(
    null,
  );
  const activeModuleOverride = resolveActiveModuleOverride(
    project,
    moduleOverride,
  );
  const displayProject = applyModuleOverride(project, activeModuleOverride);
  const tabs = useMemo(
    () =>
      displayProject
        ? getProjectDetailTabs(displayProject.modules, {
            // Always expose treasury so users can enable/manage it.
            hasCash: true,
          })
        : [],
    [displayProject],
  );
  const requestedTab = parseProjectDetailTabId(searchParams.get("tab"));
  const activeTab = resolveActiveTabId(tabs, requestedTab);

  useEffect(() => {
    if (!displayProject || !activeTab) return;
    if (searchParams.get("tab") === activeTab) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, displayProject, searchParams, setSearchParams]);

  const changeTab = (tab: ProjectDetailTabId) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const retryAll = () =>
    void Promise.all([
      refreshProjects(),
      refreshFinance(),
      ...(!isDemo && project
        ? [projectTransactionsQuery.refetch()]
        : []),
    ]);

  if (projectsLoading || financeLoading) {
    return <ProjectDetailLoadingState />;
  }

  const baseError = projectsError ?? financeError;
  if (baseError) {
    return (
      <ProjectDetailErrorState message={baseError} onRetry={retryAll} />
    );
  }

  if (!displayProject) {
    return <ProjectDetailNotFoundState />;
  }

  if (!isDemo && projectTransactionsQuery.isLoading) {
    return <ProjectDetailLoadingState />;
  }

  if (!isDemo && projectTransactionsQuery.isError) {
    return (
      <ProjectDetailErrorState
        message={queryErrorMessage(
          projectTransactionsQuery.error,
          "تعذر تحميل سجل معاملات المشروع",
        )}
        onRetry={retryAll}
      />
    );
  }

  const projectTransactions = isDemo
    ? transactions.filter(
        (transaction) => transaction.projectId === displayProject.id,
      )
    : (projectTransactionsQuery.data ?? []);
  const analytics = computeProjectAnalytics({
    project: displayProject,
    transactions: projectTransactions,
    timeZone: resolvedTimeZone,
  });
  const resolvedTab = activeTab ?? "overview";
  const panelId = getSectionTabPanelId(
    PROJECT_DETAIL_TABS_ID,
    resolvedTab,
  );
  const tabId = getSectionTabId(PROJECT_DETAIL_TABS_ID, resolvedTab);

  const activePanel = (() => {
    switch (resolvedTab) {
      case "cash":
        return (
          <Suspense fallback={null}>
            <ProjectCashTab
              currency={currency}
              project={displayProject}
              wallets={wallets}
            />
          </Suspense>
        );
      case "capital":
        return (
          <ProjectCapitalTab
            analytics={analytics}
            currency={currency}
            isDemo={isDemo}
            projectId={displayProject.id}
            timeZone={resolvedTimeZone}
          />
        );
      case "workers":
        return (
          <ProjectWorkersTab
            currency={currency}
            isDemo={isDemo}
            projectId={displayProject.id}
            timeZone={resolvedTimeZone}
            wallets={wallets}
          />
        );
      case "inventory":
        return (
          <ProjectInventoryTab
            currency={currency}
            isDemo={isDemo}
            project={displayProject}
          />
        );
      case "livestock":
        return (
          <ProjectLivestockTab
            isDemo={isDemo}
            projectId={displayProject.id}
          />
        );
      case "transactions":
        return (
          <ProjectTransactionsTab
            error={null}
            isLoading={false}
            onRetry={() => void projectTransactionsQuery.refetch()}
            projectId={displayProject.id}
            transactions={projectTransactions}
            wallets={wallets}
          />
        );
      case "overview":
        return (
          <ProjectOverview
            analytics={analytics}
            currency={currency}
            onOpenSettings={() => setSettingsOpen(true)}
            project={displayProject}
            timeZone={resolvedTimeZone}
            transactions={projectTransactions}
          />
        );
    }
  })();

  return (
    <div className="page-enter mx-auto max-w-3xl px-4 pb-8 sm:px-6" dir="rtl">
      <ProjectHero
        analytics={analytics}
        currency={currency}
        onOpenSettings={() => setSettingsOpen(true)}
        project={displayProject}
        settingsOpen={settingsOpen}
      />

      {settingsOpen ? (
        <ProjectSettingsPanel
          isDemo={isDemo}
          onClose={() => setSettingsOpen(false)}
          onSaved={(result) => {
            setModuleOverride({
              modules: result.modules,
              projectId: displayProject.id,
              clearGoal: result.clearGoal,
              projectType: result.projectType,
              ...(result.goalMinor === undefined
                ? {}
                : { goalMinor: result.goalMinor }),
            });
            setSettingsOpen(false);
          }}
          project={displayProject}
        />
      ) : null}

      <div className="sticky top-0 z-10 -mx-4 mb-5 border-b border-line bg-canvas/92 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <SectionTabs
          activeId={resolvedTab}
          ariaLabel="أقسام المشروع"
          className="border-b-0"
          id={PROJECT_DETAIL_TABS_ID}
          items={tabs}
          onChange={changeTab}
        />
      </div>

      <div
        aria-labelledby={tabId}
        className="pb-4"
        id={panelId}
        role="tabpanel"
        tabIndex={0}
      >
        {activePanel}
      </div>
    </div>
  );
}
