import {
  useDebtDetailQuery,
  useDebtEntriesQuery,
  useDebtsQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  DebtEntry,
  DebtSummary,
} from "@/features/workspace/workspace-types";
import { useDebtStore } from "./debt-store";

const EMPTY_ENTRIES: DebtEntry[] = [];

function queryMessage(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : fallback;
}

export function useDebtsView(): {
  debts: DebtSummary[];
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
  const query = useDebtsQuery();
  const demoDebts = useDebtStore((state) => state.debts);

  if (!workspaceId) {
    return {
      debts: isDemo
        ? demoDebts.filter((debt) => !debt.archivedAt)
        : [],
      isLoading: workspaceLoading,
      isLive: false,
      error: isDemo ? null : workspaceError,
      refresh: isDemo ? async () => undefined : refreshWorkspace,
    };
  }

  return {
    debts: query.data ?? [],
    isLoading: workspaceLoading || query.isLoading,
    isLive: true,
    error: queryMessage(query.error, "تعذر تحميل الديون"),
    refresh: async () => {
      await query.refetch();
    },
  };
}

export function useDebtDetailView(debtId: string | undefined): {
  debt: DebtSummary | null;
  entries: DebtEntry[];
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
  const detailQuery = useDebtDetailQuery(debtId);
  const entriesQuery = useDebtEntriesQuery(debtId);
  const demoDebt = useDebtStore(
    (state) => state.debts.find((debt) => debt.id === debtId) ?? null,
  );
  const demoEntries = useDebtStore(
    (state) =>
      debtId ? state.entriesByDebt[debtId] ?? EMPTY_ENTRIES : EMPTY_ENTRIES,
  );

  if (!workspaceId) {
    return {
      debt: isDemo ? demoDebt : null,
      entries: isDemo ? demoEntries : [],
      isLoading: workspaceLoading,
      isLive: false,
      error: isDemo ? null : workspaceError,
      refresh: isDemo ? async () => undefined : refreshWorkspace,
    };
  }

  return {
    debt: detailQuery.data ?? null,
    entries: entriesQuery.data ?? [],
    isLoading:
      workspaceLoading || detailQuery.isLoading || entriesQuery.isLoading,
    isLive: true,
    error:
      queryMessage(detailQuery.error, "تعذر تحميل الدين") ??
      queryMessage(entriesQuery.error, "تعذر تحميل حركات الدين"),
    refresh: async () => {
      await Promise.all([detailQuery.refetch(), entriesQuery.refetch()]);
    },
  };
}
