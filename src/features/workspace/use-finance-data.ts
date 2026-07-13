import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "./use-workspace";
import {
  archiveInventoryItem,
  acceptWorkspaceInviteRpc,
  createDebtRpc,
  createInventoryLocationRpc,
  createLivestockBatchRpc,
  createProjectRpc,
  createWalletRpc,
  createWorkerRpc,
  fetchCapitalEntries,
  fetchCategories,
  fetchDebtDetail,
  fetchDebtEntries,
  fetchDebtParties,
  fetchDebts,
  fetchDebtWorkspaceSummary,
  fetchFinancialEventAttachments,
  fetchInventoryItems,
  fetchInventoryLocations,
  fetchInventoryMovements,
  fetchLivestockBatches,
  fetchLivestockEvents,
  fetchProjectAchievementUnlocks,
  fetchProjectMembers,
  fetchProjectTransactions,
  fetchProjects,
  fetchTransactions,
  fetchWallets,
  fetchWorkers,
  fetchWorkLogs,
  fetchWorkspaceAchievementUnlocks,
  fetchWorkspaceGoal,
  fetchWorkspaceMemberOptions,
  adjustWalletBalanceRpc,
  postCapitalEntry,
  postDebtEntryRpc,
  postInventoryMovementRpc,
  postLivestockEventRpc,
  postTransactionRpc,
  postTransferRpc,
  postWageMovementRpc,
  recordDailyWorkRpc,
  replaceTransactionRpc,
  reverseFinancialEventRpc,
  setProjectParentRpc,
  unlockProjectAchievementRpc,
  unlockWorkspaceAchievementRpc,
  updateProjectRpc,
  uploadFinancialEventAttachment,
  upsertInventoryItem,
  upsertProjectMemberRpc,
  upsertWorkspaceGoalRpc,
} from "./workspace-api";
import type {
  CapitalEntryType,
  DebtDirection,
  DebtEntryType,
  InventoryMovementType,
  LivestockEventType,
  ProjectCategorySeed,
  ProjectColorToken,
  ProjectMemberRole,
  ProjectModules,
  ProjectStatus,
  ProjectType,
} from "./workspace-types";

export const workspaceKeys = {
  wallets: (workspaceId: string) => ["wallets", workspaceId] as const,
  transactions: (workspaceId: string) =>
    ["transactions", workspaceId] as const,
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
