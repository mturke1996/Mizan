const mocks = vi.hoisted(() => ({
  workspace: {
    current: {
      workspaceId: null as string | null,
      currency: "LYD",
    },
  },
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
  refetchQueries: vi.fn().mockResolvedValue(undefined),
  api: {
    archiveInventoryItem: vi.fn(),
    createDebtRpc: vi.fn(),
    createProjectRpc: vi.fn(),
    createWalletRpc: vi.fn(),
    createWorkerRpc: vi.fn(),
    fetchCapitalEntries: vi.fn(),
    fetchCategories: vi.fn(),
    fetchDebtDetail: vi.fn(),
    fetchDebtEntries: vi.fn(),
    fetchDebtParties: vi.fn(),
    fetchDebts: vi.fn(),
    fetchInventoryItems: vi.fn(),
    fetchProjectTransactions: vi.fn(),
    fetchProjects: vi.fn(),
    fetchTransactions: vi.fn(),
    fetchWallets: vi.fn(),
    fetchWorkers: vi.fn(),
    fetchWorkLogs: vi.fn(),
    postCapitalEntry: vi.fn(),
    postDebtEntryRpc: vi.fn(),
    postTransactionRpc: vi.fn(),
    postTransferRpc: vi.fn(),
    postWageMovementRpc: vi.fn(),
    recordDailyWorkRpc: vi.fn(),
    reverseFinancialEventRpc: vi.fn(),
    replaceTransactionRpc: vi.fn(),
    adjustWalletBalanceRpc: vi.fn(),
    updateProjectRpc: vi.fn(),
    upsertInventoryItem: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mocks.useQuery,
  useMutation: mocks.useMutation,
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
    refetchQueries: mocks.refetchQueries,
  }),
}));

vi.mock("./use-workspace", () => ({
  useWorkspace: () => mocks.workspace.current,
}));

vi.mock("./workspace-api", () => mocks.api);

import * as financeDataHooks from "./use-finance-data";
import {
  useArchiveInventoryItemMutation,
  useArchiveProjectMutation,
  useCapitalEntriesQuery,
  useCategoriesQuery,
  useCreateDebtMutation,
  useCreateProjectMutation,
  useCreateWalletMutation,
  useCreateWorkerMutation,
  useInventoryItemsQuery,
  usePostDebtEntryMutation,
  usePostCapitalEntryMutation,
  usePostTransactionMutation,
  usePostTransferMutation,
  usePostWageMovementMutation,
  useProjectTransactionsQuery,
  useProjectsQuery,
  useRecordDailyWorkMutation,
  useTransactionsQuery,
  useUpdateProjectSettingsMutation,
  useUpsertInventoryItemMutation,
  useWalletsQuery,
  useWorkLogsQuery,
  useWorkersQuery,
} from "./use-finance-data";

describe("project module query hooks", () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useMutation.mockReset();
    mocks.invalidateQueries.mockClear();
    mocks.refetchQueries.mockClear();
    mocks.api.archiveInventoryItem.mockReset();
    mocks.api.createDebtRpc.mockReset();
    mocks.api.createProjectRpc.mockReset();
    mocks.api.createWalletRpc.mockReset();
    mocks.api.createWorkerRpc.mockReset();
    mocks.api.fetchCapitalEntries.mockReset();
    mocks.api.fetchCategories.mockReset();
    mocks.api.fetchDebtDetail.mockReset();
    mocks.api.fetchDebtEntries.mockReset();
    mocks.api.fetchDebtParties.mockReset();
    mocks.api.fetchDebts.mockReset();
    mocks.api.fetchInventoryItems.mockReset();
    mocks.api.fetchProjectTransactions.mockReset();
    mocks.api.fetchProjects.mockReset();
    mocks.api.fetchTransactions.mockReset();
    mocks.api.fetchWallets.mockReset();
    mocks.api.fetchWorkers.mockReset();
    mocks.api.fetchWorkLogs.mockReset();
    mocks.api.postCapitalEntry.mockReset();
    mocks.api.postDebtEntryRpc.mockReset();
    mocks.api.postTransactionRpc.mockReset();
    mocks.api.postTransferRpc.mockReset();
    mocks.api.postWageMovementRpc.mockReset();
    mocks.api.recordDailyWorkRpc.mockReset();
    mocks.api.reverseFinancialEventRpc.mockReset();
    mocks.api.replaceTransactionRpc.mockReset();
    mocks.api.adjustWalletBalanceRpc.mockReset();
    mocks.api.updateProjectRpc.mockReset();
    mocks.api.upsertInventoryItem.mockReset();
    mocks.workspace.current.workspaceId = null;
  });

  it("exposes a project transaction history hook", () => {
    expect(financeDataHooks.useProjectTransactionsQuery).toBeTypeOf("function");
  });

  it("enables capital and inventory queries only with workspace and project", () => {
    useCapitalEntriesQuery("project-1");
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: false,
      queryKey: ["capital-entries", "none", "project-1"],
    });

    mocks.workspace.current.workspaceId = "workspace-1";
    useCapitalEntriesQuery(undefined);
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: false,
      queryKey: ["capital-entries", "workspace-1", "none"],
    });

    useCapitalEntriesQuery("project-1");
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: true,
      queryKey: ["capital-entries", "workspace-1", "project-1"],
    });

    useInventoryItemsQuery("project-1");
    expect(mocks.useQuery.mock.calls.at(-1)?.[0]).toMatchObject({
      enabled: true,
      queryKey: ["inventory-items", "workspace-1", "project-1"],
    });
  });

  it("keys full project history by workspace and project", async () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    mocks.api.fetchProjectTransactions.mockResolvedValue([]);

    useProjectTransactionsQuery("project-1");
    const options = mocks.useQuery.mock.calls.at(-1)?.[0] as {
      enabled: boolean;
      queryKey: readonly string[];
      queryFn: () => Promise<unknown>;
    };

    expect(options).toMatchObject({
      enabled: true,
      queryKey: ["project-transactions", "workspace-1", "project-1"],
    });
    await options.queryFn();
    expect(mocks.api.fetchProjectTransactions).toHaveBeenCalledWith(
      "workspace-1",
      "project-1",
    );
  });

  it("keeps offline project queries disabled and guarded", () => {
    const assertQueryGuarded = (
      register: () => unknown,
      apiMock: ReturnType<typeof vi.fn>,
    ) => {
      register();
      const options = mocks.useQuery.mock.calls.at(-1)?.[0] as {
        enabled: boolean;
        queryFn: () => unknown;
      };
      expect(options.enabled).toBe(false);
      expect(() => options.queryFn()).toThrow(/غير متاحة.*مساحة عمل/);
      expect(apiMock).not.toHaveBeenCalled();
    };

    assertQueryGuarded(
      () => useCapitalEntriesQuery("project-1"),
      mocks.api.fetchCapitalEntries,
    );
    assertQueryGuarded(
      () => useInventoryItemsQuery("project-1"),
      mocks.api.fetchInventoryItems,
    );
    assertQueryGuarded(
      () => useProjectTransactionsQuery("project-1"),
      mocks.api.fetchProjectTransactions,
    );
    assertQueryGuarded(
      () => useWorkersQuery("project-1"),
      mocks.api.fetchWorkers,
    );
  });

  it("keeps every workspace-level query disabled and guarded offline", () => {
    const assertQueryGuarded = (
      register: () => unknown,
      apiMock: ReturnType<typeof vi.fn>,
    ) => {
      register();
      const options = mocks.useQuery.mock.calls.at(-1)?.[0] as {
        enabled: boolean;
        queryFn: () => unknown;
      };
      expect(options.enabled).toBe(false);
      expect(() => options.queryFn()).toThrow(/غير متاحة.*مساحة عمل/);
      expect(apiMock).not.toHaveBeenCalled();
    };

    assertQueryGuarded(useWalletsQuery, mocks.api.fetchWallets);
    assertQueryGuarded(useTransactionsQuery, mocks.api.fetchTransactions);
    assertQueryGuarded(useProjectsQuery, mocks.api.fetchProjects);
    assertQueryGuarded(useCategoriesQuery, mocks.api.fetchCategories);
  });

  it("guards project queries when the project id is absent", () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    const assertProjectGuarded = (
      register: () => unknown,
      apiMock: ReturnType<typeof vi.fn>,
    ) => {
      register();
      const options = mocks.useQuery.mock.calls.at(-1)?.[0] as {
        enabled: boolean;
        queryFn: () => unknown;
      };
      expect(options.enabled).toBe(false);
      expect(() => options.queryFn()).toThrow(/المشروع غير متاح/);
      expect(apiMock).not.toHaveBeenCalled();
    };

    assertProjectGuarded(
      () => useWorkersQuery(undefined),
      mocks.api.fetchWorkers,
    );
    assertProjectGuarded(
      () => useWorkLogsQuery(undefined),
      mocks.api.fetchWorkLogs,
    );
    assertProjectGuarded(
      () => useCapitalEntriesQuery(undefined),
      mocks.api.fetchCapitalEntries,
    );
    assertProjectGuarded(
      () => useProjectTransactionsQuery(undefined),
      mocks.api.fetchProjectTransactions,
    );
    assertProjectGuarded(
      () => useInventoryItemsQuery(undefined),
      mocks.api.fetchInventoryItems,
    );
  });

  it("invalidates capital, project detail, projects, and analytics after posting", async () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    usePostCapitalEntryMutation("project-1");
    const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
      onSuccess: () => Promise<void>;
    };

    await options.onSuccess();

    expect(
      mocks.invalidateQueries.mock.calls.map(([input]) => input.queryKey),
    ).toEqual([
      ["capital-entries", "workspace-1", "project-1"],
      ["projects", "workspace-1"],
      ["project-detail", "workspace-1", "project-1"],
      ["analytics", "workspace-1"],
    ]);
  });

  it("invalidates all cached project histories after a financial write", async () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    usePostTransactionMutation();
    const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
      onSuccess: () => Promise<void>;
    };

    await options.onSuccess();

    expect(
      mocks.invalidateQueries.mock.calls.map(([input]) => input.queryKey),
    ).toContainEqual(["project-transactions", "workspace-1"]);
  });

  it("invalidates categories after a wage withdrawal", async () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    usePostWageMovementMutation("project-1");
    const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
      onSuccess: (
        data: unknown,
        input: { entryType: "withdrawal" },
      ) => Promise<void>;
    };

    await options.onSuccess(undefined, { entryType: "withdrawal" });

    expect(
      mocks.invalidateQueries.mock.calls.map(([input]) => input.queryKey),
    ).toContainEqual(["categories", "workspace-1"]);
  });

  it("invalidates debt and finance caches after posting a debt payment", async () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    usePostDebtEntryMutation("debt-1");
    const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
      onSuccess: () => Promise<void>;
    };

    await options.onSuccess();

    const keys = mocks.invalidateQueries.mock.calls.map(
      ([input]) => input.queryKey,
    );
    expect(keys).toContainEqual(["debts", "workspace-1"]);
    expect(keys).toContainEqual(["debt-detail", "workspace-1", "debt-1"]);
    expect(keys).toContainEqual(["debt-entries", "workspace-1", "debt-1"]);
    expect(keys).toContainEqual(["wallets", "workspace-1"]);
    expect(keys).toContainEqual(["transactions", "workspace-1"]);
    expect(useCreateDebtMutation).toBeTypeOf("function");
  });

  it("refetches projects before a create fallback when the response has no id", async () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    useCreateProjectMutation();
    const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
      onSuccess: (data: { id: string | null }) => Promise<void>;
    };

    await options.onSuccess({ id: null });

    expect(mocks.refetchQueries).toHaveBeenCalledWith({
      queryKey: ["projects", "workspace-1"],
      type: "all",
    });
  });

  it("rejects capital mutations without calling the live API offline", async () => {
    usePostCapitalEntryMutation("project-1");
    const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
      mutationFn: (input: {
        entryType: "contribution";
        amountMinor: number;
      }) => Promise<unknown>;
    };

    expect(() =>
      options.mutationFn({
        entryType: "contribution",
        amountMinor: 1_000,
      }),
    ).toThrow(/غير متاحة.*مساحة عمل/);
    expect(mocks.api.postCapitalEntry).not.toHaveBeenCalled();
  });

  it("guards project, inventory, and worker mutations offline", () => {
    const assertGuarded = (
      register: () => unknown,
      input: unknown,
      apiMock: ReturnType<typeof vi.fn>,
    ) => {
      register();
      const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
        mutationFn: (value: unknown) => unknown;
      };
      expect(() => options.mutationFn(input)).toThrow(
        /غير متاحة.*مساحة عمل/,
      );
      expect(apiMock).not.toHaveBeenCalled();
    };

    assertGuarded(
      useCreateProjectMutation,
      { name: "مشروع" },
      mocks.api.createProjectRpc,
    );
    assertGuarded(
      () => useUpdateProjectSettingsMutation("project-1"),
      {
        projectType: "general",
        modules: {
          transactions: true,
          goal: false,
          workers: false,
          capital: false,
          inventory: false,
        livestock: false,
        },
      },
      mocks.api.updateProjectRpc,
    );
    assertGuarded(
      useArchiveProjectMutation,
      {
        projectId: "project-1",
        projectType: "general",
        modules: {
          transactions: true,
          goal: false,
          workers: false,
          capital: false,
          inventory: false,
        livestock: false,
        },
      },
      mocks.api.updateProjectRpc,
    );
    assertGuarded(
      () => useUpsertInventoryItemMutation("project-1"),
      { name: "حبوب", quantity: 1, unitLabel: "كيس" },
      mocks.api.upsertInventoryItem,
    );
    assertGuarded(
      () => useArchiveInventoryItemMutation("project-1"),
      "item-1",
      mocks.api.archiveInventoryItem,
    );
    assertGuarded(
      () => useCreateWorkerMutation("project-1"),
      { name: "عامل", dailyWageMinor: 1_000 },
      mocks.api.createWorkerRpc,
    );
    assertGuarded(
      () => useRecordDailyWorkMutation("project-1"),
      { workerId: "worker-1", workDate: "2026-07-13" },
      mocks.api.recordDailyWorkRpc,
    );
    assertGuarded(
      () => usePostWageMovementMutation("project-1"),
      {
        workerId: "worker-1",
        entryType: "bonus",
        amountMinor: 1_000,
      },
      mocks.api.postWageMovementRpc,
    );
  });

  it("guards wallet, transaction, and transfer mutations offline", () => {
    const assertGuarded = (
      register: () => unknown,
      input: unknown,
      apiMock: ReturnType<typeof vi.fn>,
    ) => {
      register();
      const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
        mutationFn: (value: unknown) => unknown;
      };
      expect(() => options.mutationFn(input)).toThrow(
        /غير متاحة.*مساحة عمل/,
      );
      expect(apiMock).not.toHaveBeenCalled();
    };

    assertGuarded(
      useCreateWalletMutation,
      { name: "نقدية", currencyCode: "LYD", clientId: "wallet-intent" },
      mocks.api.createWalletRpc,
    );
    assertGuarded(
      usePostTransactionMutation,
      {
        walletId: "wallet-1",
        kind: "income",
        amountMinor: 1_000,
        description: "دخل",
        clientId: "transaction-intent",
      },
      mocks.api.postTransactionRpc,
    );
    assertGuarded(
      usePostTransferMutation,
      {
        sourceWalletId: "wallet-1",
        destinationWalletId: "wallet-2",
        amountMinor: 1_000,
        clientId: "transfer-intent",
      },
      mocks.api.postTransferRpc,
    );
  });

  it("guards project mutations when the project id is absent", () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    const assertProjectGuarded = (
      register: () => unknown,
      input: unknown,
      apiMock: ReturnType<typeof vi.fn>,
    ) => {
      register();
      const options = mocks.useMutation.mock.calls.at(-1)?.[0] as {
        mutationFn: (value: unknown) => unknown;
      };
      expect(() => options.mutationFn(input)).toThrow(/المشروع غير متاح/);
      expect(apiMock).not.toHaveBeenCalled();
    };

    assertProjectGuarded(
      () => useUpdateProjectSettingsMutation(""),
      {
        projectType: "general",
        modules: {
          transactions: true,
          goal: false,
          workers: false,
          capital: false,
          inventory: false,
        livestock: false,
        },
      },
      mocks.api.updateProjectRpc,
    );
    assertProjectGuarded(
      () => usePostCapitalEntryMutation(""),
      {
        entryType: "contribution",
        amountMinor: 1_000,
        clientId: "capital-intent",
      },
      mocks.api.postCapitalEntry,
    );
    assertProjectGuarded(
      () => useUpsertInventoryItemMutation(""),
      { name: "حبوب", quantity: 1, unitLabel: "كيس" },
      mocks.api.upsertInventoryItem,
    );
    assertProjectGuarded(
      () => useArchiveInventoryItemMutation(""),
      "item-1",
      mocks.api.archiveInventoryItem,
    );
    assertProjectGuarded(
      () => useCreateWorkerMutation(""),
      { name: "عامل", dailyWageMinor: 1_000 },
      mocks.api.createWorkerRpc,
    );
    assertProjectGuarded(
      () => useRecordDailyWorkMutation(""),
      {
        workerId: "worker-1",
        workDate: "2026-07-13",
        clientId: "work-intent",
      },
      mocks.api.recordDailyWorkRpc,
    );
    assertProjectGuarded(
      () => usePostWageMovementMutation(""),
      {
        workerId: "worker-1",
        entryType: "bonus",
        amountMinor: 1_000,
        clientId: "wage-intent",
      },
      mocks.api.postWageMovementRpc,
    );
  });

  it("forwards caller-owned ids through finance mutation hooks", () => {
    mocks.workspace.current.workspaceId = "workspace-1";
    const mutationFn = () =>
      (mocks.useMutation.mock.calls.at(-1)?.[0] as {
        mutationFn: (value: unknown) => unknown;
      }).mutationFn;

    useCreateWalletMutation();
    mutationFn()({
      name: "نقدية",
      currencyCode: "LYD",
      clientId: "wallet-intent",
    });
    expect(mocks.api.createWalletRpc).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "wallet-intent" }),
    );

    usePostTransactionMutation();
    mutationFn()({
      walletId: "wallet-1",
      kind: "income",
      amountMinor: 1_000,
      description: "دخل",
      clientId: "transaction-intent",
    });
    expect(mocks.api.postTransactionRpc).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "transaction-intent" }),
    );

    usePostTransferMutation();
    mutationFn()({
      sourceWalletId: "wallet-1",
      destinationWalletId: "wallet-2",
      amountMinor: 1_000,
      clientId: "transfer-intent",
    });
    expect(mocks.api.postTransferRpc).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "transfer-intent" }),
    );
  });
});
