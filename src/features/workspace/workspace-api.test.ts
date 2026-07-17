const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ from, rpc }),
}));

import * as workspaceApi from "./workspace-api";
import {
  archiveInventoryItem,
  createDebtRpc,
  createProjectRpc,
  createWalletRpc,
  fetchCapitalEntries,
  fetchDebts,
  fetchInventoryItems,
  fetchProjectTransactions,
  fetchProjects,
  fetchTransactions,
  fetchWorkLogs,
  fetchWorkers,
  postCapitalEntry,
  postDebtEntryRpc,
  postTransactionRpc,
  postTransferRpc,
  postWageMovementRpc,
  recordDailyWorkRpc,
  updateProjectRpc,
  upsertInventoryItem,
} from "./workspace-api";

describe("createDebtRpc", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "debt-1", error: null });
  });

  it("maps one caller-owned debt intent to the SQL contract", async () => {
    await createDebtRpc({
      workspaceId: "workspace-1",
      direction: "receivable",
      partyName: "محمد",
      partyPhone: "0910000000",
      principalMinor: 12_500,
      currencyCode: "LYD",
      dueOn: "2026-07-20",
      projectId: "project-1",
      note: "فاتورة",
      clientId: "debt-intent-1",
    });

    expect(rpc).toHaveBeenCalledWith("create_debt", {
      p_workspace_id: "workspace-1",
      p_client_id: "debt-intent-1",
      p_direction: "receivable",
      p_principal_minor: 12_500,
      p_currency_code: "LYD",
      p_party_name: "محمد",
      p_party_phone: "0910000000",
      p_party_notes: null,
      p_due_on: "2026-07-20",
      p_project_id: "project-1",
      p_note: "فاتورة",
    });
  });
});

describe("postDebtEntryRpc", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "entry-1", error: null });
  });

  it("forwards signed debt movements and optional wallet linkage", async () => {
    await postDebtEntryRpc({
      workspaceId: "workspace-1",
      debtId: "debt-1",
      entryType: "payment",
      amountMinor: -4_000,
      occurredOn: "2026-07-13",
      walletId: "wallet-1",
      note: "دفعة",
      clientId: "debt-payment-1",
    });

    expect(rpc).toHaveBeenCalledWith("post_debt_entry", {
      p_workspace_id: "workspace-1",
      p_debt_id: "debt-1",
      p_entry_type: "payment",
      p_amount_minor: -4_000,
      p_occurred_on: "2026-07-13",
      p_wallet_id: "wallet-1",
      p_note: "دفعة",
      p_client_id: "debt-payment-1",
    });
  });
});

describe("debt reads", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("reads list balances from the exact-money debt view", async () => {
    const query = queryResult([
      {
        id: "debt-1",
        workspace_id: "workspace-1",
        party_id: "party-1",
        party_name: "محمد",
        party_phone: null,
        direction: "payable",
        principal_minor: "900719925474099312345",
        balance_minor: "900719925474099300000",
        paid_minor: "12345",
        adjusted_minor: "0",
        written_off_minor: "0",
        currency_code: "LYD",
        status: "partial",
        due_on: "2026-07-20",
        project_id: null,
        project_name: null,
        note: null,
        created_by: "user-1",
        created_at: "2026-07-01T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      },
    ]);
    from.mockReturnValue(query);

    const debts = await fetchDebts("workspace-1");

    expect(from).toHaveBeenCalledWith("debt_balances");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(debts[0]?.balanceMinor).toBe(900719925474099300000n);
  });
});

describe("project transaction history API", () => {
  it("exposes a project-scoped transaction history reader", () => {
    expect(workspaceApi.fetchProjectTransactions).toBeTypeOf("function");
  });
});

function queryResult(data: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    range: vi.fn(),
    then: (
      resolve: (result: { data: unknown[]; error: null }) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.lte.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.range.mockReturnValue(query);
  return query;
}

function financialEventRow(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    workspace_id: "workspace-1",
    event_type: "income",
    effective_event_type: "income",
    is_reversal: false,
    currency_code: "LYD",
    occurred_at: "2026-07-13T12:00:00.000Z",
    description: "دخل",
    category_id: null,
    project_id: "project-1",
    source_wallet_id: null,
    destination_wallet_id: "wallet-1",
    amount_minor: "1",
    created_at: "2026-07-13T11:00:00.000Z",
    ...overrides,
  };
}

describe("transaction history reads", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("keeps the global feed capped while using exact text money", async () => {
    const query = queryResult([
      financialEventRow("event-global", {
        amount_minor: "900719925474099312345",
      }),
    ]);
    from.mockReturnValue(query);

    const transactions = await fetchTransactions("workspace-1");

    expect(from).toHaveBeenCalledWith("financial_event_details");
    expect(query.eq).toHaveBeenCalledWith("workspace_id", "workspace-1");
    expect(query.order.mock.calls).toEqual([
      ["occurred_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(200);
    expect(query.range).not.toHaveBeenCalled();
    expect(transactions[0]?.amountMinor).toBe(900719925474099312345n);
  });

  it("hides reversed transactions and their reversal events", async () => {
    const query = queryResult([
      financialEventRow("event-original", {
        amount_minor: "250",
      }),
      financialEventRow("event-reversal", {
        event_type: "reversal",
        effective_event_type: "income",
        is_reversal: true,
        reversal_of_event_id: "event-original",
        amount_minor: "-250",
      }),
      financialEventRow("event-kept", {
        amount_minor: "100",
      }),
    ]);
    from.mockReturnValue(query);

    const transactions = await fetchTransactions("workspace-1");

    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.id).toBe("event-kept");
  });

  it("filters a project inside a fixed snapshot", async () => {
    const snapshotCutoff = "2026-07-13T12:00:00.000Z";
    const query = queryResult([
      financialEventRow("event-project", {
        amount_minor: "9007199254740993",
      }),
    ]);
    from.mockReturnValue(query);

    const transactions = await fetchProjectTransactions(
      "workspace-1",
      "project-1",
      { snapshotCutoff },
    );

    expect(from).toHaveBeenCalledWith("financial_event_details");
    expect(query.eq.mock.calls).toEqual([
      ["workspace_id", "workspace-1"],
      ["project_id", "project-1"],
    ]);
    expect(query.lte).toHaveBeenCalledWith("created_at", snapshotCutoff);
    expect(query.order.mock.calls).toEqual([
      ["occurred_at", { ascending: false }],
      ["id", { ascending: false }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(1_000);
    expect(query.range).not.toHaveBeenCalled();
    expect(query.or).not.toHaveBeenCalled();
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amountMinor).toBe(9007199254740993n);
  });

  it("uses a keyset snapshot without duplicates after a leading insert", async () => {
    const snapshotCutoff = "2026-07-13T12:00:00.000Z";
    const firstPage = Array.from({ length: 1_000 }, (_, index) =>
      financialEventRow(`event-${String(index).padStart(4, "0")}`, {
        occurred_at: "2026-07-12T10:00:00.000Z",
      }),
    );
    const concurrentLeadingInsert = financialEventRow("event-new-leading", {
      occurred_at: "2026-07-13T11:30:00.000Z",
      created_at: "2026-07-13T12:00:01.000Z",
    });
    const olderEvent = financialEventRow("event-older", {
      occurred_at: "2026-07-11T10:00:00.000Z",
    });
    // An offset-based second page would repeat the prior boundary after this
    // leading insert. The fixed snapshot/keyset query excludes the insert, and
    // defensive de-duplication prevents a malformed/retried page inflating data.
    const rowsAfterLeadingInsert = [
      concurrentLeadingInsert,
      ...firstPage,
      olderEvent,
    ];
    const secondPage = rowsAfterLeadingInsert.slice(1_000);
    const queries = [queryResult(firstPage), queryResult(secondPage)];
    from.mockImplementation(() => queries.shift());

    const transactions = await fetchProjectTransactions(
      "workspace-1",
      "project-1",
      { snapshotCutoff },
    );

    expect(from).toHaveBeenCalledTimes(2);
    expect(transactions).toHaveLength(1_001);
    expect(new Set(transactions.map(({ id }) => id)).size).toBe(1_001);
    expect(transactions.map(({ id }) => id)).not.toContain(
      concurrentLeadingInsert.id,
    );
    expect(transactions[0]?.id).toBe("event-0000");
    expect(transactions.at(-1)?.id).toBe("event-older");
    expect(queries).toHaveLength(0);
    const issuedQueries = from.mock.results.map(
      ({ value }) => value as ReturnType<typeof queryResult>,
    );
    expect(
      issuedQueries.map(({ lte }) => lte.mock.calls),
    ).toEqual([
      [["created_at", snapshotCutoff]],
      [["created_at", snapshotCutoff]],
    ]);
    expect(issuedQueries[0]?.or).not.toHaveBeenCalled();
    expect(issuedQueries[1]?.or).toHaveBeenCalledWith(
      'occurred_at.lt."2026-07-12T10:00:00.000Z",and(occurred_at.eq."2026-07-12T10:00:00.000Z",id.lt."event-0999")',
    );
    expect(issuedQueries.every(({ range }) => range.mock.calls.length === 0))
      .toBe(true);
  });
});

describe("createProjectRpc", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "project-1" }, error: null });
  });

  it("maps the enhanced blueprint payload to the exact RPC argument names", async () => {
    const modules = {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
    livestock: false,
    };
    const seedCategories = [{ name: "علف", kind: "expense" as const }];

    await createProjectRpc({
      workspaceId: "workspace-1",
      name: "طيور",
      projectType: "birds",
      modules,
      openingCapitalMinor: 50_000,
      seedCategories,
      clientId: "client-1",
    });

    expect(rpc).toHaveBeenCalledWith("create_project", {
      p_workspace_id: "workspace-1",
      p_name: "طيور",
      p_project_type: "birds",
      p_modules: modules,
      p_description: null,
      p_goal_minor: null,
      p_color_token: "primary",
      p_client_id: "client-1",
      p_opening_capital_minor: 50_000,
      p_seed_categories: seedCategories,
    });
  });

  it("normalizes returned project rows into a reliable created id", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ id: "project-from-array", name: "مشروع" }],
      error: null,
    });

    const result = await createProjectRpc({
      workspaceId: "workspace-1",
      name: "مشروع",
    });

    expect(result).toEqual({ id: "project-from-array" });
  });

  it("returns a null created id when the RPC response has no usable id", async () => {
    rpc.mockResolvedValueOnce({
      data: { id: "   ", name: "مشروع" },
      error: null,
    });

    const result = await createProjectRpc({
      workspaceId: "workspace-1",
      name: "مشروع",
    });

    expect(result).toEqual({ id: null });
  });

  it("preserves the legacy create overload for existing callers", async () => {
    await createProjectRpc({
      workspaceId: "workspace-1",
      name: "مشروع قديم",
      description: "وصف",
      goalMinor: 10_000,
      colorToken: "success",
    });

    expect(rpc).toHaveBeenCalledWith("create_project", {
      p_workspace_id: "workspace-1",
      p_name: "مشروع قديم",
      p_description: "وصف",
      p_goal_minor: 10_000,
      p_color_token: "success",
    });
  });

  it("passes a supplied client id through the legacy overload", async () => {
    await createProjectRpc({
      workspaceId: "workspace-1",
      name: "مشروع قديم",
      clientId: "legacy-client-1",
    });

    expect(rpc).toHaveBeenCalledWith("create_project", {
      p_workspace_id: "workspace-1",
      p_name: "مشروع قديم",
      p_description: null,
      p_goal_minor: null,
      p_color_token: "primary",
      p_client_id: "legacy-client-1",
    });
  });

  it("rejects enhanced creation without a caller-owned client id", async () => {
    await expect(
      createProjectRpc({
        workspaceId: "workspace-1",
        name: "طيور",
        projectType: "birds",
      } as Parameters<typeof createProjectRpc>[0]),
    ).rejects.toThrow(/clientId/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("caller-owned finance idempotency", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: "result-1", error: null });
  });

  it("forwards one wallet client id unchanged across retries", async () => {
    const input = {
      workspaceId: "workspace-1",
      name: "النقدية",
      currencyCode: "LYD",
      openingBalanceMinor: 1_000,
      clientId: "wallet-intent-1",
    };

    await createWalletRpc(input);
    await createWalletRpc(input);

    expect(rpc.mock.calls.map(([, args]) => args.p_client_id)).toEqual([
      "wallet-intent-1",
      "wallet-intent-1",
    ]);
  });

  it("forwards one transaction client id unchanged across retries", async () => {
    const input = {
      workspaceId: "workspace-1",
      walletId: "wallet-1",
      kind: "income" as const,
      amountMinor: 1_000,
      description: "دخل",
      projectId: "project-1",
      clientId: "transaction-intent-1",
    };

    await postTransactionRpc(input);
    await postTransactionRpc(input);

    expect(rpc.mock.calls.map(([, args]) => args.p_client_id)).toEqual([
      "transaction-intent-1",
      "transaction-intent-1",
    ]);
  });

  it("forwards one transfer client id unchanged across retries", async () => {
    const input = {
      workspaceId: "workspace-1",
      sourceWalletId: "wallet-1",
      destinationWalletId: "wallet-2",
      amountMinor: 1_000,
      description: "تحويل",
      clientId: "transfer-intent-1",
    };

    await postTransferRpc(input);
    await postTransferRpc(input);

    expect(rpc.mock.calls.map(([, args]) => args.p_client_id)).toEqual([
      "transfer-intent-1",
      "transfer-intent-1",
    ]);
  });
});

describe("updateProjectRpc", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "project-1" }, error: null });
  });

  it("uses the blueprint update overload and explicit goal clearing flag", async () => {
    const modules = {
      transactions: true,
      goal: false,
      workers: false,
      capital: true,
      inventory: true,
    livestock: false,
    };

    await updateProjectRpc({
      workspaceId: "workspace-1",
      projectId: "project-1",
      projectType: "goods",
      modules,
      clearGoal: true,
    });

    expect(rpc).toHaveBeenCalledWith("update_project", {
      p_workspace_id: "workspace-1",
      p_project_id: "project-1",
      p_project_type: "goods",
      p_modules: modules,
      p_name: null,
      p_description: null,
      p_goal_minor: null,
      p_color_token: null,
      p_status: null,
      p_clear_goal: true,
    });
  });
});

describe("postCapitalEntry", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "capital-1" }, error: null });
  });

  it("maps signed capital entries and retry identifiers", async () => {
    await postCapitalEntry({
      workspaceId: "workspace-1",
      projectId: "project-1",
      entryType: "withdrawal",
      amountMinor: -1_250,
      currencyCode: "LYD",
      note: "سحب",
      occurredOn: "2026-07-13",
      clientId: "client-2",
    });

    expect(rpc).toHaveBeenCalledWith("post_capital_entry", {
      p_workspace_id: "workspace-1",
      p_project_id: "project-1",
      p_entry_type: "withdrawal",
      p_amount_minor: -1_250,
      p_currency_code: "LYD",
      p_note: "سحب",
      p_occurred_on: "2026-07-13",
      p_client_id: "client-2",
    });
  });

  it("rejects capital posting without a caller-owned client id", async () => {
    await expect(
      postCapitalEntry({
        workspaceId: "workspace-1",
        projectId: "project-1",
        entryType: "contribution",
        amountMinor: 1_250,
      } as Parameters<typeof postCapitalEntry>[0]),
    ).rejects.toThrow(/clientId/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("retry-safe work mutations", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "work-log-1" }, error: null });
  });

  it("forwards the same caller-owned id for repeated daily-work attempts", async () => {
    const input = {
      workspaceId: "workspace-1",
      projectId: "project-1",
      workerId: "worker-1",
      workDate: "2026-07-13",
      clientId: "work-intent-1",
    };

    await recordDailyWorkRpc(input);
    await recordDailyWorkRpc(input);

    expect(rpc.mock.calls.map(([, args]) => args.p_client_id)).toEqual([
      "work-intent-1",
      "work-intent-1",
    ]);
  });

  it("forwards the same caller-owned id for repeated wage attempts", async () => {
    const input = {
      workspaceId: "workspace-1",
      projectId: "project-1",
      workerId: "worker-1",
      entryType: "bonus" as const,
      amountMinor: 1_000,
      workDate: "2026-07-13",
      clientId: "wage-intent-1",
    };

    await postWageMovementRpc(input);
    await postWageMovementRpc(input);

    expect(rpc.mock.calls.map(([, args]) => args.p_client_id)).toEqual([
      "wage-intent-1",
      "wage-intent-1",
    ]);
  });
});

describe("upsertInventoryItem", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "item-1" }, error: null });
  });

  it("selects the currency-aware overload with exact parameter names", async () => {
    await upsertInventoryItem({
      workspaceId: "workspace-1",
      projectId: "project-1",
      itemId: "item-1",
      name: "حبوب",
      quantity: 2.5,
      unitLabel: "كيس",
      unitCostMinor: 4_500,
      currencyCode: "LYD",
    });

    expect(rpc).toHaveBeenCalledWith("upsert_inventory_item", {
      p_workspace_id: "workspace-1",
      p_project_id: "project-1",
      p_item_id: "item-1",
      p_name: "حبوب",
      p_quantity: 2.5,
      p_unit_label: "كيس",
      p_unit_cost_minor: 4_500,
      p_currency_code: "LYD",
      p_barcode: null,
      p_location_id: null,
    });
  });

  it("repeats identical desired-state arguments for an inventory retry", async () => {
    const input = {
      workspaceId: "workspace-1",
      projectId: "project-1",
      name: "حبوب",
      quantity: 2.5,
      unitLabel: "كيس",
      unitCostMinor: 4_500,
      currencyCode: "LYD",
    };

    await upsertInventoryItem(input);
    await upsertInventoryItem(input);

    expect(rpc.mock.calls[1]?.[1]).toEqual(rpc.mock.calls[0]?.[1]);
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_client_id");
  });
});

describe("archiveInventoryItem", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "item-1" }, error: null });
  });

  it("sends all ownership keys to the archive RPC", async () => {
    await archiveInventoryItem({
      workspaceId: "workspace-1",
      projectId: "project-1",
      itemId: "item-1",
    });

    expect(rpc).toHaveBeenCalledWith("archive_inventory_item", {
      p_workspace_id: "workspace-1",
      p_project_id: "project-1",
      p_item_id: "item-1",
    });
  });
});

describe("fetchProjects", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("combines currency-scoped totals and zero-fills missing summaries", async () => {
    const modules = {
      transactions: true,
      goal: false,
      workers: false,
      capital: true,
      inventory: true,
    livestock: false,
    };
    const results = {
      project_summaries: queryResult([
        {
          id: "project-1",
          name: "تجارة",
          description: null,
          status: "active",
          color_token: "primary",
          goal_minor: "9007199254740993",
          project_type: "goods",
          modules,
        },
        {
          id: "project-2",
          name: "قديم",
          description: null,
          status: "active",
          color_token: "primary",
          goal_minor: null,
          project_type: "general",
          modules: null,
        },
      ]),
      project_financial_totals: queryResult([
        {
          project_id: "project-1",
          income_minor: "5000",
          expense_minor: "2000",
        },
      ]),
      project_labor_summaries: queryResult([]),
      project_capital_totals: queryResult([
        { project_id: "project-1", net_capital_minor: "10000" },
      ]),
      project_inventory_totals: queryResult([
        {
          project_id: "project-1",
          item_count: 4,
          inventory_value_minor: "3200",
        },
      ]),
    };
    from.mockImplementation(
      (table: keyof typeof results) => results[table],
    );

    const projects = await fetchProjects("workspace-1", "LYD");

    expect(projects[0]).toMatchObject({
      projectType: "goods",
      goalMinor: 9007199254740993n,
      incomeMinor: 5000n,
      expenseMinor: 2000n,
      capitalMinor: 10000n,
      capitalRecoveredRate: 30,
      inventoryValueMinor: 3200n,
      inventoryItemCount: 4,
    });
    expect(projects[1]).toMatchObject({
      incomeMinor: 0n,
      expenseMinor: 0n,
      capitalMinor: 0n,
      capitalRecoveredRate: null,
      inventoryValueMinor: 0n,
      inventoryItemCount: 0,
    });
    expect(results.project_financial_totals.eq).toHaveBeenCalledWith(
      "currency_code",
      "LYD",
    );
    expect(results.project_capital_totals.eq).toHaveBeenCalledWith(
      "currency_code",
      "LYD",
    );
    expect(results.project_inventory_totals.eq).toHaveBeenCalledWith(
      "currency_code",
      "LYD",
    );
  });
});

describe("exact project detail reads", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("reads capital amounts from the text detail view", async () => {
    const capitalQuery = queryResult([
      {
        id: "capital-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        entry_type: "contribution",
        amount_minor: "9007199254740993",
        currency_code: "LYD",
        note: null,
        occurred_on: "2026-07-13",
        created_by: "user-1",
        client_id: "client-1",
        operation: "post_capital_entry",
        payload_hash: "hash",
        created_at: "2026-07-13T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      },
    ]);
    from.mockImplementation((relation: string) =>
      relation === "project_capital_entry_details"
        ? capitalQuery
        : undefined,
    );

    const entries = await fetchCapitalEntries("workspace-1", "project-1");

    expect(from).toHaveBeenCalledWith("project_capital_entry_details");
    expect(entries[0]?.amountMinor).toBe(9007199254740993n);
  });

  it("reads inventory costs from the text detail view", async () => {
    const inventoryQuery = queryResult([
      {
        id: "item-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        name: "حبوب",
        quantity: 2,
        unit_label: "كيس",
        unit_cost_minor: "9007199254740993",
        currency_code: "LYD",
        status: "active",
        created_by: "user-1",
        created_at: "2026-07-13T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      },
    ]);
    from.mockImplementation((relation: string) =>
      relation === "project_inventory_item_details"
        ? inventoryQuery
        : undefined,
    );

    const items = await fetchInventoryItems("workspace-1", "project-1");

    expect(from).toHaveBeenCalledWith("project_inventory_item_details");
    expect(items[0]?.unitCostMinor).toBe(9007199254740993n);
  });

  it("reads oversized worker money from the text balance view", async () => {
    const workerQuery = queryResult([
      {
        worker_id: "worker-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        name: "عامل",
        phone: null,
        daily_wage_minor: "9007199254740993",
        status: "active",
        balance_minor: "9007199254740994",
        earned_minor: "9007199254740995",
        withdrawn_minor: "9007199254740996",
        deducted_minor: "9007199254740997",
        work_days: 3,
      },
    ]);
    from.mockImplementation((relation: string) =>
      relation === "project_worker_balance_details"
        ? workerQuery
        : undefined,
    );

    const workers = await fetchWorkers("workspace-1", "project-1");

    expect(from).toHaveBeenCalledWith("project_worker_balance_details");
    expect(workers[0]).toMatchObject({
      dailyWageMinor: 9007199254740993n,
      balanceMinor: 9007199254740994n,
      earnedMinor: 9007199254740995n,
      withdrawnMinor: 9007199254740996n,
      deductedMinor: 9007199254740997n,
    });
  });

  it("reads oversized work-log money from the text detail view", async () => {
    const workLogQuery = queryResult([
      {
        id: "log-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        worker_id: "worker-1",
        entry_type: "daily_wage",
        work_date: "2026-07-13",
        amount_minor: "900719925474099312345",
        currency_code: "LYD",
        note: null,
        financial_event_id: null,
        created_by: "user-1",
        client_id: "client-1",
        operation: "record_daily_work",
        payload_hash: "hash",
        created_at: "2026-07-13T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      },
    ]);
    from.mockImplementation((relation: string) =>
      relation === "project_work_log_details" ? workLogQuery : undefined,
    );

    const workLogs = await fetchWorkLogs("workspace-1", "project-1");

    expect(from).toHaveBeenCalledWith("project_work_log_details");
    expect(workLogs[0]?.amountMinor).toBe(900719925474099312345n);
  });
});
