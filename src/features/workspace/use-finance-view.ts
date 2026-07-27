import {
  useProjectsQuery,
  useTransactionsQuery,
  useWalletsQuery,
} from "./use-finance-data";
import { useFinanceStore } from "@/features/finance/finance-store";
import { useProjectStore } from "@/features/projects/project-store";
import { getUserErrorMessage } from "@/lib/user-error";
import { useWorkspace } from "./use-workspace";
import type { ProjectSummary } from "./workspace-types";
import type {
  FinanceTransaction,
  Wallet,
} from "@/domain/finance/finance-state";

export function useFinanceView(): {
  wallets: Wallet[];
  transactions: FinanceTransaction[];
  isLoading: boolean;
  isLive: boolean;
  error: string | null;
  walletsError: string | null;
  transactionsError: string | null;
  refresh: () => Promise<void>;
} {
  const {
    workspaceId,
    isLoading: workspaceLoading,
    error: workspaceError,
    refresh: refreshWorkspace,
    isDemo = false,
  } = useWorkspace();
  const walletsQuery = useWalletsQuery();
  const transactionsQuery = useTransactionsQuery();
  const storeWallets = useFinanceStore((state) => state.wallets);
  const storeTransactions = useFinanceStore((state) => state.transactions);

  if (!workspaceId) {
    const unavailableError = isDemo ? null : workspaceError;
    return {
      wallets: isDemo ? storeWallets : [],
      transactions: isDemo ? storeTransactions : [],
      isLoading: workspaceLoading,
      isLive: false,
      error: unavailableError,
      walletsError: unavailableError,
      transactionsError: unavailableError,
      refresh: isDemo ? async () => undefined : refreshWorkspace,
    };
  }

  const walletsError = walletsQuery.isError
    ? getUserErrorMessage(walletsQuery.error, "تعذر تحميل المحافظ")
    : null;
  const transactionsError = transactionsQuery.isError
    ? getUserErrorMessage(transactionsQuery.error, "تعذر تحميل الحركات")
    : null;
  return {
    wallets: walletsQuery.data ?? [],
    transactions: transactionsQuery.data ?? [],
    isLoading:
      workspaceLoading ||
      walletsQuery.isLoading ||
      transactionsQuery.isLoading,
    isLive: true,
    error: walletsError ?? transactionsError,
    walletsError,
    transactionsError,
    refresh: async () => {
      await Promise.all([walletsQuery.refetch(), transactionsQuery.refetch()]);
    },
  };
}

export function useProjectsView(): {
  projects: ProjectSummary[];
  isLoading: boolean;
  isLive: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const {
    workspaceId,
    isLoading: workspaceLoading,
    error: workspaceError,
    refresh: refreshWorkspace,
    isDemo = false,
  } = useWorkspace();
  const projectsQuery = useProjectsQuery();
  const storeProjects = useProjectStore((state) => state.projects);

  if (!workspaceId) {
    return {
      projects: isDemo ? storeProjects.filter((p) => p.status !== "archived") : [],
      isLoading: workspaceLoading,
      isLive: false,
      error: isDemo ? null : workspaceError,
      refresh: isDemo ? async () => undefined : refreshWorkspace,
    };
  }

  const activeProjects = (projectsQuery.data ?? []).filter((p) => p.status !== "archived");

  return {
    projects: activeProjects,
    isLoading: workspaceLoading || projectsQuery.isLoading,
    isLive: true,
    error: projectsQuery.isError
      ? getUserErrorMessage(projectsQuery.error, "تعذر تحميل المشاريع")
      : null,
    refresh: async () => {
      await projectsQuery.refetch();
    },
  };
}
