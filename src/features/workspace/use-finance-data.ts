import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useWorkspace } from "./use-workspace";
import {
  archiveInventoryItem,
  acceptWorkspaceInviteRpc,
  createDebtRpc,
  createIncomeSourceRpc,
  createInvoiceRpc,
  recordInvoicePaymentRpc,
  refreshOverdueInvoicesRpc,
  updateInvoiceRpc,
  createInventoryLocationRpc,
  createLivestockBatchRpc,
  createProjectRpc,
  createWalletRpc,
  createWorkerRpc,
  fetchCapitalEntries,
  fetchCategories,
  fetchClients,
  fetchDebtDetail,
  fetchDebtEntries,
  fetchDebtParties,
  fetchDebts,
  fetchDebtWorkspaceSummary,
  fetchFinancialEventAttachments,
  fetchIncomeEntries,
  fetchIncomeSourceBalances,
  fetchIncomeSources,
  fetchInvoiceDetail,
  fetchInvoices,
  fetchInventoryItems,
  fetchInventoryLocations,
  fetchInventoryMovements,
  fetchLivestockBatches,
  fetchLivestockEvents,
  fetchProjectAchievementUnlocks,
  fetchProjectCashBalance,
  fetchProjectCashEntries,
  fetchProjectMembers,
  fetchProjectTransactions,
  fetchProjects,
  fetchTransactions,
  fetchTransactionsPage,
  fetchAllFilteredTransactions,
  fetchWallets,
  fetchWorkers,
  fetchWorkLogs,
  fetchWorkspaceAchievementUnlocks,
  fetchWorkspaceGoal,
  fetchWorkspaceMemberOptions,
  filterActiveFinancialEventRows,
  fetchAllCategories,
  fetchBudgets,
  upsertCategoryRpc,
  upsertBudgetRpc,
  deleteBudgetRpc,
  fetchRecurring,
  upsertRecurringRpc,
  deleteRecurringRpc,
  postRecurringDueRpc,
  adjustWalletBalanceRpc,
  openOrLinkProjectWalletRpc,
  postCapitalEntry,
  postDebtEntryRpc,
  postIncomeEntryRpc,
  postInventoryMovementRpc,
  postLivestockEventRpc,
  postProjectCashEntryRpc,
  postTransactionRpc,
  postTransferRpc,
  postWageMovementRpc,
  recordDailyWorkRpc,
  replaceTransactionRpc,
  reverseFinancialEventRpc,
  setProjectCashModeRpc,
  setProjectParentRpc,
  setInvoiceStatusRpc,
  transferProjectCashToWalletRpc,
  unlockProjectAchievementRpc,
  unlockWorkspaceAchievementRpc,
  updateProjectRpc,
  uploadFinancialEventAttachment,
  upsertClientRpc,
  upsertInventoryItem,
  upsertProjectMemberRpc,
  upsertWorkspaceGoalRpc,
  type TransactionFilters,
} from "./workspace-api";
import { mapFinancialEvent } from "./mappers";
import { useFinanceStore } from "@/features/finance/finance-store";
import type {
  CapitalEntryType,
  DebtDirection,
  DebtEntryType,
  IncomeEntryType,
  IncomePayKind,
  InvoicePaymentMethod,
  InvoiceStatus,
  InventoryMovementType,
  LivestockEventType,
  ProjectCashMode,
  ProjectCategorySeed,
  ProjectColorToken,
  ProjectMemberRole,
  ProjectModules,
  ProjectStatus,
  ProjectType,
  CategoryInput,
  BudgetInput,
  RecurringInput,
} from "./workspace-types";
import type { FinanceTransaction } from "@/domain/finance/finance-state";

export const workspaceKeys = {
  wallets: (workspaceId: string) => ["wallets", workspaceId] as const,
  transactions: (workspaceId: string) =>
    ["transactions", workspaceId] as const,
  filteredTransactions: (workspaceId: string, filters: unknown) =>
    ["transactions", workspaceId, "filtered", filters] as const,
  projectTransactionsRoot: (workspaceId: string) =>
    ["project-transactions", workspaceId] as const,
  projectTransactions: (workspaceId: string, projectId: string) =>
    ["project-transactions", workspaceId, projectId] as const,
  projects: (workspaceId: string, currency?: string) =>
    currency
      ? (["projects", workspaceId, currency] as const)
      : (["projects", workspaceId] as const),
  projectDetail: (workspaceId: string, projectId: string) =>
    ["project-detail", workspaceId, projectId] as const,
  analytics: (workspaceId: string) => ["analytics", workspaceId] as const,
  finance: (workspaceId: string) => ["finance", workspaceId] as const,
  categories: (workspaceId: string) => ["categories", workspaceId] as const,
  allCategories: (workspaceId: string) =>
    ["categories", workspaceId, "all"] as const,
  allTransactions: (workspaceId: string) =>
    ["transactions", workspaceId, "all"] as const,
  budgets: (workspaceId: string) => ["budgets", workspaceId] as const,
  recurring: (workspaceId: string) => ["recurring", workspaceId] as const,
  workers: (workspaceId: string, projectId: string) =>
    ["workers", workspaceId, projectId] as const,
  workLogs: (workspaceId: string, projectId: string) =>
    ["work-logs", workspaceId, projectId] as const,
  capitalEntries: (workspaceId: string, projectId: string) =>
    ["capital-entries", workspaceId, projectId] as const,
  inventoryItems: (workspaceId: string, projectId: string) =>
    ["inventory-items", workspaceId, projectId] as const,
  inventoryLocations: (workspaceId: string, projectId: string) =>
    ["inventory-locations", workspaceId, projectId] as const,
  inventoryMovements: (workspaceId: string, projectId: string) =>
    ["inventory-movements", workspaceId, projectId] as const,
  livestockBatches: (workspaceId: string, projectId: string) =>
    ["livestock-batches", workspaceId, projectId] as const,
  livestockEvents: (workspaceId: string, projectId: string) =>
    ["livestock-events", workspaceId, projectId] as const,
  eventAttachments: (workspaceId: string, eventId: string) =>
    ["event-attachments", workspaceId, eventId] as const,
  workspaceGoal: (workspaceId: string, monthKey: string) =>
    ["workspace-goal", workspaceId, monthKey] as const,
  projectMembers: (workspaceId: string, projectId: string) =>
    ["project-members", workspaceId, projectId] as const,
  workspaceMembers: (workspaceId: string) =>
    ["workspace-members", workspaceId] as const,
  workspaceAchievements: (workspaceId: string) =>
    ["workspace-achievements", workspaceId] as const,
  projectAchievements: (workspaceId: string, projectId: string) =>
    ["project-achievements", workspaceId, projectId] as const,
  debts: (workspaceId: string) => ["debts", workspaceId] as const,
  debtWorkspaceSummary: (workspaceId: string, currency: string) =>
    ["debt-workspace-summary", workspaceId, currency] as const,
  debtDetail: (workspaceId: string, debtId: string) =>
    ["debt-detail", workspaceId, debtId] as const,
  debtEntries: (workspaceId: string, debtId: string) =>
    ["debt-entries", workspaceId, debtId] as const,
  debtParties: (workspaceId: string) =>
    ["debt-parties", workspaceId] as const,
  clients: (workspaceId: string) => ["clients", workspaceId] as const,
  projectCashBalance: (workspaceId: string, projectId: string) =>
    ["project-cash-balance", workspaceId, projectId] as const,
  projectCashEntries: (workspaceId: string, projectId: string) =>
    ["project-cash-entries", workspaceId, projectId] as const,
  incomeSources: (workspaceId: string) =>
    ["income-sources", workspaceId] as const,
  incomeSourceBalances: (workspaceId: string) =>
    ["income-source-balances", workspaceId] as const,
  incomeEntries: (workspaceId: string, sourceId: string) =>
    ["income-entries", workspaceId, sourceId] as const,
  invoices: (workspaceId: string) => ["invoices", workspaceId] as const,
  invoiceDetail: (workspaceId: string, invoiceId: string) =>
    ["invoice-detail", workspaceId, invoiceId] as const,
};

function requireLiveWorkspace(workspaceId: string | null): string {
  if (!workspaceId) {
    throw new Error("هذه العملية غير متاحة دون مساحة عمل متصلة");
  }
  return workspaceId;
}

function requireProjectId(projectId: string | undefined): string {
  if (!projectId) {
    throw new Error("المشروع غير متاح");
  }
  return projectId;
}

function requireDebtId(debtId: string | undefined): string {
  if (!debtId) {
    throw new Error("الدين غير متاح");
  }
  return debtId;
}

export function useWalletsQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.wallets(workspaceId ?? "none"),
    queryFn: () => fetchWallets(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useTransactionsQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.transactions(workspaceId ?? "none"),
    queryFn: () => fetchTransactions(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export interface AllTransactionsResult {
  transactions: FinanceTransaction[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Full wallet transaction history (paginated, no 200-row cap) for reports that
 * must be accurate over the whole selected period. Falls back to the demo
 * store in demo mode.
 */
export function useAllTransactionsQuery(): AllTransactionsResult {
  const { workspaceId, isDemo = false } = useWorkspace();
  const storeTransactions = useFinanceStore((state) => state.transactions);
  const query = useQuery({
    queryKey: workspaceKeys.allTransactions(workspaceId ?? "none"),
    queryFn: () =>
      fetchAllFilteredTransactions(requireLiveWorkspace(workspaceId), {}),
    enabled: Boolean(workspaceId) && !isDemo,
  });

  if (!workspaceId && isDemo) {
    return {
      transactions: storeTransactions,
      isLoading: false,
      error: null,
      refetch: () => undefined,
    };
  }

  return {
    transactions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

export interface FilteredTransactionsResult {
  transactions: FinanceTransaction[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  isRefetching: boolean;
  refetch: () => void;
}

/**
 * Server-side filtered, paginated transactions register. Pages accumulate and
 * `filterActiveFinancialEventRows` runs across the full accumulated set, so a
 * reversal (loaded first because it is newer) hides its reversed original even
 * when that original lands on a later page. In demo mode (no live workspace)
 * it falls back to the local demo store with the same client-side filters.
 */
export function useFilteredTransactionsQuery(
  filters: TransactionFilters,
): FilteredTransactionsResult {
  const { workspaceId, isDemo = false } = useWorkspace();
  const storeTransactions = useFinanceStore((state) => state.transactions);

  const query = useInfiniteQuery({
    queryKey: workspaceKeys.filteredTransactions(workspaceId ?? "none", filters),
    queryFn: ({ pageParam }) =>
      fetchTransactionsPage(
        requireLiveWorkspace(workspaceId),
        filters,
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length : undefined,
    enabled: Boolean(workspaceId),
  });

  if (!workspaceId && isDemo) {
    return {
      transactions: applyTransactionFilters(storeTransactions, filters),
      isLoading: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      error: null,
      fetchNextPage: () => undefined,
      isRefetching: false,
      refetch: () => undefined,
    };
  }

  const accumulatedRows = query.data
    ? query.data.pages.flatMap((page) => page.rows)
    : [];
  const transactions = filterActiveFinancialEventRows(accumulatedRows)
    .map(mapFinancialEvent)
    .filter((item): item is FinanceTransaction => item !== null);

  return {
    transactions,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    error: query.error,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    isRefetching: query.isRefetching && !query.isFetchingNextPage,
    refetch: () => {
      void query.refetch();
    },
  };
}

function applyTransactionFilters(
  transactions: FinanceTransaction[],
  filters: TransactionFilters,
): FinanceTransaction[] {
  const search = filters.search?.trim().toLocaleLowerCase("ar");
  return transactions.filter((transaction) => {
    if (filters.kind && transaction.kind !== filters.kind) return false;
    if (
      filters.walletId &&
      transaction.walletId !== filters.walletId &&
      transaction.kind === "transfer" &&
      transaction.destinationWalletId !== filters.walletId
    ) {
      return false;
    }
    if (filters.categoryId && transaction.categoryId !== filters.categoryId) {
      return false;
    }
    if (
      filters.projectId &&
      transaction.projectId !== filters.projectId
    ) {
      return false;
    }
    if (filters.dateFrom && transaction.occurredAt < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && transaction.occurredAt > filters.dateTo) {
      return false;
    }
    if (
      search &&
      !transaction.title.toLocaleLowerCase("ar").includes(search)
    ) {
      return false;
    }
    return true;
  });
}

export function useProjectTransactionsQuery(
  projectId: string | undefined,
) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.projectTransactions(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    queryFn: () =>
      fetchProjectTransactions(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function useProjectsQuery() {
  const { workspaceId, currency } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.projects(workspaceId ?? "none", currency),
    queryFn: () => fetchProjects(requireLiveWorkspace(workspaceId), currency),
    enabled: Boolean(workspaceId),
  });
}

export function useCategoriesQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.categories(workspaceId ?? "none"),
    queryFn: () => fetchCategories(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useAllCategoriesQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.allCategories(workspaceId ?? "none"),
    queryFn: () => fetchAllCategories(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useUpsertCategory() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: (input: CategoryInput) =>
      upsertCategoryRpc(requireLiveWorkspace(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.categories(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.allCategories(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        });
      }
    },
  });
}

export function useBudgetsQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.budgets(workspaceId ?? "none"),
    queryFn: () => fetchBudgets(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useUpsertBudget() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: (input: BudgetInput) =>
      upsertBudgetRpc(requireLiveWorkspace(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.budgets(workspaceId),
        });
      }
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: (budgetId: string) =>
      deleteBudgetRpc(requireLiveWorkspace(workspaceId), budgetId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.budgets(workspaceId),
        });
      }
    },
  });
}

export function useRecurringQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.recurring(workspaceId ?? "none"),
    queryFn: () => fetchRecurring(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useUpsertRecurring() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: (input: RecurringInput) =>
      upsertRecurringRpc(requireLiveWorkspace(workspaceId), input),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.recurring(workspaceId),
        });
      }
    },
  });
}

export function useDeleteRecurring() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: (recurringId: string) =>
      deleteRecurringRpc(requireLiveWorkspace(workspaceId), recurringId),
    onSuccess: () => {
      if (workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.recurring(workspaceId),
        });
      }
    },
  });
}

export function usePostRecurringDue() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  return useMutation({
    mutationFn: () => postRecurringDueRpc(requireLiveWorkspace(workspaceId)),
    onSuccess: (count) => {
      if (workspaceId && count > 0) {
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.recurring(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.transactions(workspaceId),
        });
        void queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        });
      }
    },
  });
}

export function useDebtsQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.debts(workspaceId ?? "none"),
    queryFn: () => fetchDebts(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useDebtWorkspaceSummaryQuery() {
  const { workspaceId, currency } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.debtWorkspaceSummary(
      workspaceId ?? "none",
      currency,
    ),
    queryFn: () =>
      fetchDebtWorkspaceSummary(
        requireLiveWorkspace(workspaceId),
        currency,
      ),
    enabled: Boolean(workspaceId),
  });
}

export function useDebtDetailQuery(debtId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.debtDetail(
      workspaceId ?? "none",
      debtId ?? "none",
    ),
    queryFn: () =>
      fetchDebtDetail(
        requireLiveWorkspace(workspaceId),
        requireDebtId(debtId),
      ),
    enabled: Boolean(workspaceId && debtId),
  });
}

export function useDebtEntriesQuery(debtId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.debtEntries(
      workspaceId ?? "none",
      debtId ?? "none",
    ),
    queryFn: () =>
      fetchDebtEntries(
        requireLiveWorkspace(workspaceId),
        requireDebtId(debtId),
      ),
    enabled: Boolean(workspaceId && debtId),
  });
}

export function useDebtPartiesQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.debtParties(workspaceId ?? "none"),
    queryFn: () => fetchDebtParties(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useWorkersQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.workers(workspaceId ?? "none", projectId ?? "none"),
    queryFn: () =>
      fetchWorkers(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function useWorkLogsQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.workLogs(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    queryFn: () =>
      fetchWorkLogs(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function useCapitalEntriesQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.capitalEntries(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    queryFn: () =>
      fetchCapitalEntries(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function useInventoryItemsQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.inventoryItems(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    queryFn: () =>
      fetchInventoryItems(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export const useProjectCapitalEntriesQuery = useCapitalEntriesQuery;
export const useProjectInventoryItemsQuery = useInventoryItemsQuery;

function useInvalidateFinance() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return async () => {
    if (!workspaceId) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.wallets(workspaceId),
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.transactions(workspaceId),
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.projectTransactionsRoot(workspaceId),
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.projects(workspaceId),
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.analytics(workspaceId),
      }),
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.finance(workspaceId),
      }),
    ]);
  };
}

export function useCreateDebtMutation() {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      direction: DebtDirection;
      partyName: string;
      partyPhone?: string;
      partyNotes?: string;
      principalMinor: number;
      dueOn?: string;
      projectId?: string;
      note?: string;
      clientId: string;
    }) =>
      createDebtRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        currencyCode: currency,
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debts(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debtParties(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debtWorkspaceSummary(workspaceId, currency),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function usePostDebtEntryMutation(debtId: string) {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();
  const invalidateFinance = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      entryType: Exclude<DebtEntryType, "open">;
      amountMinor: number;
      occurredOn: string;
      walletId?: string;
      note?: string;
      clientId: string;
    }) =>
      postDebtEntryRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        debtId: requireDebtId(debtId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debts(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debtDetail(workspaceId, debtId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debtEntries(workspaceId, debtId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.debtWorkspaceSummary(workspaceId, currency),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
        invalidateFinance(),
      ]);
    },
  });
}

export function useCreateWalletMutation() {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      name: string;
      currencyCode: string;
      openingBalanceMinor?: number;
      clientId: string;
    }) =>
      createWalletRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        name: input.name,
        currencyCode: input.currencyCode,
        openingBalanceMinor: input.openingBalanceMinor,
        clientId: input.clientId,
      }),
    onSuccess: invalidate,
  });
}

export function usePostTransactionMutation() {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      walletId: string;
      kind: "income" | "expense";
      amountMinor: number;
      description: string;
      categoryId?: string;
      projectId?: string;
      businessClientId?: string;
      clientId: string;
    }) =>
      postTransactionRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        ...input,
      }),
    onSuccess: invalidate,
  });
}

export function usePostTransferMutation() {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      sourceWalletId: string;
      destinationWalletId: string;
      amountMinor: number;
      description?: string;
      clientId: string;
    }) =>
      postTransferRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        ...input,
      }),
    onSuccess: invalidate,
  });
}

export function useReverseFinancialEventMutation() {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      eventId: string;
      clientId: string;
      reason?: string;
    }) =>
      reverseFinancialEventRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        ...input,
      }),
    onSuccess: invalidate,
  });
}

export function useReplaceTransactionMutation() {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      eventId: string;
      walletId: string;
      kind: "income" | "expense";
      amountMinor: number;
      description: string;
      categoryId?: string;
      projectId?: string | null;
      clientId: string;
      occurredAt?: string;
    }) =>
      replaceTransactionRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        ...input,
      }),
    onSuccess: invalidate,
  });
}

export function useAdjustWalletBalanceMutation() {
  const { workspaceId } = useWorkspace();
  const invalidate = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      walletId: string;
      targetBalanceMinor: number;
      clientId: string;
      note?: string;
    }) =>
      adjustWalletBalanceRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        ...input,
      }),
    onSuccess: invalidate,
  });
}

export function useCreateProjectMutation() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      goalMinor?: number;
      colorToken?: ProjectColorToken;
      projectType?: ProjectType;
      modules?: ProjectModules;
      openingCapitalMinor?: number;
      seedCategories?: ProjectCategorySeed[];
      clientId: string;
    }) =>
      createProjectRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        ...input,
      }),
    onSuccess: async (result) => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.categories(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
      if (!result?.id) {
        await queryClient.refetchQueries({
          queryKey: workspaceKeys.projects(workspaceId),
          type: "all",
        });
      }
    },
  });
}

export function useUpdateProjectSettingsMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      projectType: ProjectType;
      modules: ProjectModules;
      name?: string;
      description?: string;
      goalMinor?: number;
      colorToken?: ProjectColorToken;
      status?: ProjectStatus;
      clearGoal?: boolean;
    }) =>
      updateProjectRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export const useUpdateProjectMutation = useUpdateProjectSettingsMutation;

export function useArchiveProjectMutation() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      projectId: string;
      projectType: ProjectType;
      modules: ProjectModules;
    }) =>
      updateProjectRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(input.projectId),
        projectType: input.projectType,
        modules: input.modules,
        status: "archived",
      }),
    onSuccess: async (_data, variables) => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(
            workspaceId,
            variables.projectId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function usePostCapitalEntryMutation(projectId: string) {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      entryType: CapitalEntryType;
      amountMinor: number;
      currencyCode?: string;
      note?: string;
      occurredOn?: string;
      clientId: string;
    }) =>
      postCapitalEntry({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
        currencyCode: input.currencyCode ?? currency,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.capitalEntries(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function useUpsertInventoryItemMutation(projectId: string) {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      itemId?: string;
      name: string;
      quantity: number;
      unitLabel: string;
      unitCostMinor?: number;
      currencyCode?: string;
      barcode?: string | null;
      locationId?: string | null;
    }) =>
      upsertInventoryItem({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
        currencyCode: input.currencyCode ?? currency,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.inventoryItems(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function useArchiveInventoryItemMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) =>
      archiveInventoryItem({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        itemId,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.inventoryItems(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function useCreateWorkerMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      dailyWageMinor: number;
      phone?: string;
    }) =>
      createWorkerRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.workers(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function useRecordDailyWorkMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      workerId: string;
      workDate: string;
      amountMinor?: number;
      note?: string;
      clientId: string;
    }) =>
      recordDailyWorkRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.workers(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.workLogs(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.analytics(workspaceId),
        }),
      ]);
    },
  });
}

export function usePostWageMovementMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const invalidateFinance = useInvalidateFinance();

  return useMutation({
    mutationFn: (input: {
      workerId: string;
      entryType: "bonus" | "deduction" | "withdrawal" | "adjustment";
      amountMinor: number;
      workDate?: string;
      walletId?: string;
      note?: string;
      clientId: string;
    }) =>
      postWageMovementRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async (_data, input) => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.workers(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.workLogs(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
        ...(input.entryType === "withdrawal"
          ? [
              queryClient.invalidateQueries({
                queryKey: workspaceKeys.categories(workspaceId),
              }),
            ]
          : []),
        invalidateFinance(),
      ]);
    },
  });
}

export function useInventoryLocationsQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.inventoryLocations(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    enabled: Boolean(workspaceId && projectId),
    queryFn: () =>
      fetchInventoryLocations(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
  });
}

export function useInventoryMovementsQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.inventoryMovements(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    enabled: Boolean(workspaceId && projectId),
    queryFn: () =>
      fetchInventoryMovements(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
  });
}

export function useCreateInventoryLocationMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      createInventoryLocationRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        name,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.inventoryLocations(workspaceId, projectId),
      });
    },
  });
}

export function usePostInventoryMovementMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      itemId: string;
      movementType: InventoryMovementType;
      quantity: number;
      clientId: string;
      fromLocationId?: string | null;
      toLocationId?: string | null;
      note?: string | null;
    }) =>
      postInventoryMovementRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.inventoryItems(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.inventoryMovements(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
      ]);
    },
  });
}

export function useLivestockBatchesQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.livestockBatches(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    enabled: Boolean(workspaceId && projectId),
    queryFn: () =>
      fetchLivestockBatches(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
  });
}

export function useLivestockEventsQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.livestockEvents(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    enabled: Boolean(workspaceId && projectId),
    queryFn: () =>
      fetchLivestockEvents(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
  });
}

export function useCreateLivestockBatchMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      headCount?: number;
      species?: string | null;
      note?: string | null;
      clientId?: string | null;
    }) =>
      createLivestockBatchRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.livestockBatches(workspaceId, projectId),
      });
    },
  });
}

export function usePostLivestockEventMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      batchId: string;
      eventType: LivestockEventType;
      quantity: number;
      clientId: string;
      note?: string | null;
    }) =>
      postLivestockEventRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.livestockBatches(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.livestockEvents(workspaceId, projectId),
        }),
      ]);
    },
  });
}

export function useWorkspaceGoalQuery(monthKey: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.workspaceGoal(
      workspaceId ?? "none",
      monthKey ?? "none",
    ),
    enabled: Boolean(workspaceId && monthKey),
    queryFn: () =>
      fetchWorkspaceGoal(requireLiveWorkspace(workspaceId), monthKey as string),
  });
}

export function useUpsertWorkspaceGoalMutation() {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      monthKey: string;
      incomeGoalMinor: number;
      note?: string;
      currencyCode?: string;
    }) =>
      upsertWorkspaceGoalRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        monthKey: input.monthKey,
        incomeGoalMinor: input.incomeGoalMinor,
        currencyCode: input.currencyCode ?? currency,
        note: input.note,
      }),
    onSuccess: async (_data, variables) => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.workspaceGoal(workspaceId, variables.monthKey),
      });
    },
  });
}

export function useEventAttachmentsQuery(eventId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.eventAttachments(
      workspaceId ?? "none",
      eventId ?? "none",
    ),
    enabled: Boolean(workspaceId && eventId),
    queryFn: () =>
      fetchFinancialEventAttachments(
        requireLiveWorkspace(workspaceId),
        eventId as string,
      ),
  });
}

export function useUploadEventAttachmentMutation(eventId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) =>
      uploadFinancialEventAttachment({
        workspaceId: requireLiveWorkspace(workspaceId),
        eventId,
        file,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.eventAttachments(workspaceId, eventId),
      });
    },
  });
}

export function useAcceptWorkspaceInviteMutation() {
  return useMutation({
    mutationFn: (input: { token: string; clientId?: string }) =>
      acceptWorkspaceInviteRpc(input),
  });
}

export function useProjectMembersQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.projectMembers(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    enabled: Boolean(workspaceId && projectId),
    queryFn: () =>
      fetchProjectMembers(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
  });
}

export function useWorkspaceMemberOptionsQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.workspaceMembers(workspaceId ?? "none"),
    enabled: Boolean(workspaceId),
    queryFn: () =>
      fetchWorkspaceMemberOptions(requireLiveWorkspace(workspaceId)),
  });
}

export function useUpsertProjectMemberMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: ProjectMemberRole }) =>
      upsertProjectMemberRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        ...input,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.projectMembers(workspaceId, projectId),
      });
    },
  });
}

export function useSetProjectParentMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (parentProjectId: string | null) =>
      setProjectParentRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        parentProjectId,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectDetail(workspaceId, projectId),
        }),
      ]);
    },
  });
}

export function useWorkspaceAchievementUnlocksQuery() {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.workspaceAchievements(workspaceId ?? "none"),
    enabled: Boolean(workspaceId),
    queryFn: () =>
      fetchWorkspaceAchievementUnlocks(requireLiveWorkspace(workspaceId)),
  });
}

export function useProjectAchievementUnlocksQuery(
  projectId: string | undefined,
) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.projectAchievements(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    enabled: Boolean(workspaceId && projectId),
    queryFn: () =>
      fetchProjectAchievementUnlocks(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
  });
}

export function useUnlockWorkspaceAchievementMutation() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (achievementId: string) =>
      unlockWorkspaceAchievementRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        achievementId,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.workspaceAchievements(workspaceId),
      });
    },
  });
}

export function useUnlockProjectAchievementMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (achievementId: string) =>
      unlockProjectAchievementRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId: requireProjectId(projectId),
        achievementId,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.projectAchievements(workspaceId, projectId),
      });
    },
  });
}

// ─── Clients ──────────────────────────────────────────────────

export function useClientsQuery() {
  const { workspaceId, isDemo = false } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.clients(workspaceId ?? "none"),
    queryFn: () =>
      isDemo ? Promise.resolve([]) : fetchClients(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useUpsertClientMutation() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; phone?: string }) =>
      upsertClientRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        name: input.name,
        phone: input.phone,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.clients(workspaceId),
      });
    },
  });
}

// ─── Project Cash ─────────────────────────────────────────────

export function useProjectCashBalanceQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.projectCashBalance(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    queryFn: () =>
      fetchProjectCashBalance(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function useProjectCashEntriesQuery(projectId: string | undefined) {
  const { workspaceId } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.projectCashEntries(
      workspaceId ?? "none",
      projectId ?? "none",
    ),
    queryFn: () =>
      fetchProjectCashEntries(
        requireLiveWorkspace(workspaceId),
        requireProjectId(projectId),
      ),
    enabled: Boolean(workspaceId && projectId),
  });
}

export function usePostProjectCashEntryMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entryType: "income" | "expense";
      amountMinor: number;
      title?: string;
      note?: string;
    }) =>
      postProjectCashEntryRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId,
        entryType: input.entryType,
        amountMinor: input.amountMinor,
        title: input.title,
        note: input.note,
        clientId: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectCashBalance(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectCashEntries(workspaceId, projectId),
        }),
      ]);
    },
  });
}

export function useTransferProjectCashToWalletMutation(projectId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      walletId: string;
      amountMinor: number;
      note?: string;
    }) =>
      transferProjectCashToWalletRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId,
        walletId: input.walletId,
        amountMinor: input.amountMinor,
        note: input.note,
        clientId: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectCashBalance(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projectCashEntries(workspaceId, projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.wallets(workspaceId),
        }),
      ]);
    },
  });
}

export function useSetProjectCashModeMutation(projectId: string) {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cashMode: ProjectCashMode) =>
      setProjectCashModeRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId,
        cashMode,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.projects(workspaceId, currency),
      });
    },
  });
}

export function useOpenOrLinkProjectWalletMutation(projectId: string) {
  const { workspaceId, currency } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (walletId?: string) =>
      openOrLinkProjectWalletRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        projectId,
        walletId,
        clientId: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.projects(workspaceId, currency),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.wallets(workspaceId),
        }),
      ]);
    },
  });
}

// ─── Income ───────────────────────────────────────────────────

export function useIncomeSourcesQuery() {
  const { workspaceId, isDemo = false } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.incomeSources(workspaceId ?? "none"),
    queryFn: () =>
      isDemo
        ? Promise.resolve([])
        : fetchIncomeSources(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useIncomeSourceBalancesQuery() {
  const { workspaceId, isDemo = false } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.incomeSourceBalances(workspaceId ?? "none"),
    queryFn: () =>
      isDemo
        ? Promise.resolve([])
        : fetchIncomeSourceBalances(requireLiveWorkspace(workspaceId)),
    enabled: Boolean(workspaceId),
  });
}

export function useIncomeEntriesQuery(sourceId: string | undefined) {
  const { workspaceId, isDemo = false } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.incomeEntries(
      workspaceId ?? "none",
      sourceId ?? "none",
    ),
    queryFn: () =>
      isDemo
        ? Promise.resolve([])
        : fetchIncomeEntries(requireLiveWorkspace(workspaceId), sourceId!),
    enabled: Boolean(workspaceId && sourceId),
  });
}

export function useCreateIncomeSourceMutation() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      place?: string;
      payKind: IncomePayKind;
      dailyWageMinor?: number;
      monthlySalaryMinor?: number;
      currencyCode?: string;
    }) =>
      createIncomeSourceRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        name: input.name,
        place: input.place,
        payKind: input.payKind,
        dailyWageMinor: input.dailyWageMinor,
        monthlySalaryMinor: input.monthlySalaryMinor,
        currencyCode: input.currencyCode,
        clientId: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.incomeSources(workspaceId),
      });
    },
  });
}

export function usePostIncomeEntryMutation(sourceId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entryType: IncomeEntryType;
      amountMinor: number;
      workDate?: string;
      walletId?: string;
      note?: string;
    }) =>
      postIncomeEntryRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        sourceId,
        entryType: input.entryType,
        amountMinor: input.amountMinor,
        workDate: input.workDate,
        walletId: input.walletId,
        note: input.note,
        clientId: crypto.randomUUID(),
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.incomeEntries(workspaceId, sourceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.incomeSourceBalances(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.incomeSources(workspaceId),
        }),
      ]);
    },
  });
}

// ─── Invoices ─────────────────────────────────────────────────

export function useInvoicesQuery() {
  const { workspaceId, isDemo = false } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.invoices(workspaceId ?? "none"),
    queryFn: async () => {
      if (isDemo) return [];
      const id = requireLiveWorkspace(workspaceId);
      const { cacheInvoiceList, getCachedInvoiceList } = await import(
        "@/lib/invoice-cache"
      );
      try {
        const invoices = await fetchInvoices(id);
        await cacheInvoiceList(id, invoices);
        return invoices;
      } catch (error) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const cached = await getCachedInvoiceList(id);
          if (cached) return cached;
        }
        throw error;
      }
    },
    enabled: Boolean(workspaceId),
  });
}

export function useInvoiceDetailQuery(invoiceId: string | undefined) {
  const { workspaceId, isDemo = false } = useWorkspace();
  return useQuery({
    queryKey: workspaceKeys.invoiceDetail(
      workspaceId ?? "none",
      invoiceId ?? "none",
    ),
    queryFn: async () => {
      if (isDemo) return null;
      const id = requireLiveWorkspace(workspaceId);
      const { cacheInvoiceDetail, getCachedInvoiceDetail } = await import(
        "@/lib/invoice-cache"
      );
      try {
        const invoice = await fetchInvoiceDetail(id, invoiceId!);
        if (invoice) await cacheInvoiceDetail(id, invoice);
        return invoice;
      } catch (error) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const cached = await getCachedInvoiceDetail(id, invoiceId!);
          if (cached) return cached;
        }
        throw error;
      }
    },
    enabled: Boolean(workspaceId && invoiceId),
  });
}

export function useCreateInvoiceMutation() {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      items: Array<{
        description: string;
        quantity: number;
        unitPriceMinor: number;
      }>;
      businessClientId?: string;
      clientName?: string;
      clientPhone?: string;
      issueOn?: string;
      dueOn?: string;
      taxRatePercent?: number;
      notes?: string;
      status?: InvoiceStatus;
      clientId?: string;
    }) =>
      createInvoiceRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        clientId: input.clientId ?? crypto.randomUUID(),
        items: input.items,
        businessClientId: input.businessClientId,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        issueOn: input.issueOn,
        dueOn: input.dueOn,
        taxRatePercent: input.taxRatePercent,
        notes: input.notes,
        status: input.status,
      }),
    onSuccess: async (invoice) => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoices(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoiceDetail(workspaceId, invoice.id),
        }),
      ]);
    },
  });
}

export function useSetInvoiceStatusMutation(invoiceId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: InvoiceStatus) =>
      setInvoiceStatusRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        invoiceId,
        status,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoices(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoiceDetail(workspaceId, invoiceId),
        }),
      ]);
    },
  });
}

export function useUpdateInvoiceMutation(invoiceId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      items: Array<{
        description: string;
        quantity: number;
        unitPriceMinor: number;
      }>;
      businessClientId?: string | null;
      clientName?: string;
      clientPhone?: string | null;
      issueOn?: string;
      dueOn?: string | null;
      taxRatePercent?: number;
      notes?: string | null;
    }) =>
      updateInvoiceRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        invoiceId,
        clientId: crypto.randomUUID(),
        items: input.items,
        businessClientId: input.businessClientId,
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        issueOn: input.issueOn,
        dueOn: input.dueOn,
        taxRatePercent: input.taxRatePercent,
        notes: input.notes,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoices(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoiceDetail(workspaceId, invoiceId),
        }),
      ]);
    },
  });
}

export function useRecordInvoicePaymentMutation(invoiceId: string) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      amountMinor: number;
      walletId: string;
      method?: InvoicePaymentMethod;
      notes?: string;
      paidOn?: string;
    }) =>
      recordInvoicePaymentRpc({
        workspaceId: requireLiveWorkspace(workspaceId),
        invoiceId,
        clientId: crypto.randomUUID(),
        amountMinor: input.amountMinor,
        walletId: input.walletId,
        method: input.method,
        notes: input.notes,
        paidOn: input.paidOn,
      }),
    onSuccess: async () => {
      if (!workspaceId) return;
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoices(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.invoiceDetail(workspaceId, invoiceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.wallets(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.transactions(workspaceId),
        }),
      ]);
    },
  });
}

export function useRefreshOverdueInvoicesOnce() {
  const { workspaceId, isDemo = false } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      isDemo
        ? Promise.resolve(0)
        : refreshOverdueInvoicesRpc(requireLiveWorkspace(workspaceId)),
    onSuccess: async () => {
      if (!workspaceId) return;
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.invoices(workspaceId),
      });
    },
  });
}
