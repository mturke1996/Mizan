import {
  mapCapitalEntry,
  mapDebtSummary,
  mapFinancialEvent,
  mapInventoryItem,
  mapProjectSummary,
  mapWorkLog,
  mapWorkerBalance,
} from "./mappers";

describe("mapFinancialEvent", () => {
  it.each([
    {
      effectiveEventType: "income",
      sourceWalletId: null,
      destinationWalletId: "wallet-income",
      expected: {
        kind: "income",
        walletId: "wallet-income",
        amountMinor: -125n,
      },
    },
    {
      effectiveEventType: "expense",
      sourceWalletId: "wallet-expense",
      destinationWalletId: null,
      expected: {
        kind: "expense",
        walletId: "wallet-expense",
        amountMinor: -125n,
      },
    },
    {
      effectiveEventType: "transfer",
      sourceWalletId: "wallet-source",
      destinationWalletId: "wallet-destination",
      expected: {
        kind: "transfer",
        walletId: "wallet-source",
        destinationWalletId: "wallet-destination",
        amountMinor: -125n,
      },
    },
  ])(
    "maps an effective $effectiveEventType reversal with original routing",
    ({
      effectiveEventType,
      sourceWalletId,
      destinationWalletId,
      expected,
    }) => {
      const transaction = mapFinancialEvent({
        id: `reversal-${effectiveEventType}`,
        event_type: "reversal",
        effective_event_type: effectiveEventType,
        is_reversal: true,
        currency_code: "LYD",
        occurred_at: "2026-07-13T12:00:00.000Z",
        description: "عكس حركة",
        category_id: null,
        project_id: "project-1",
        source_wallet_id: sourceWalletId,
        destination_wallet_id: destinationWalletId,
        amount_minor: "-125",
      });

      expect(transaction).toMatchObject(expected);
    },
  );

  it("maps treasury fund and withdraw opening-balance events", () => {
    expect(
      mapFinancialEvent({
        id: "treasury-fund",
        event_type: "opening_balance",
        effective_event_type: "opening_balance",
        is_reversal: false,
        currency_code: "LYD",
        occurred_at: "2026-07-17T12:00:00.000Z",
        description: "تمويل الخزينة — النقدية",
        category_id: null,
        project_id: null,
        source_wallet_id: null,
        destination_wallet_id: "cash",
        amount_minor: "500000",
      }),
    ).toMatchObject({
      kind: "opening_balance",
      flow: "in",
      walletId: "cash",
      amountMinor: 500000n,
    });

    expect(
      mapFinancialEvent({
        id: "treasury-withdraw",
        event_type: "opening_balance",
        effective_event_type: "opening_balance",
        is_reversal: false,
        currency_code: "LYD",
        occurred_at: "2026-07-17T12:00:00.000Z",
        description: "سحب من الخزينة — النقدية",
        category_id: null,
        project_id: null,
        source_wallet_id: "cash",
        destination_wallet_id: null,
        amount_minor: "200000",
      }),
    ).toMatchObject({
      kind: "opening_balance",
      flow: "out",
      walletId: "cash",
      amountMinor: 200000n,
    });
  });
});

describe("mapProjectSummary", () => {
  it("falls back safely for project rows created before blueprints", () => {
    const project = mapProjectSummary({
      id: "legacy-project",
      name: "مشروع قديم",
      description: null,
      status: "active",
      goal_minor: "10000",
      income_minor: "2500",
      expense_minor: "1000",
      active_workers: 2,
    });

    expect(project).toMatchObject({
      projectType: "general",
      modules: {
        transactions: true,
        goal: true,
        workers: true,
        capital: false,
        inventory: false,
      livestock: false,
      },
      capitalMinor: 0n,
      capitalRecoveredRate: null,
      inventoryValueMinor: 0n,
      inventoryItemCount: 0,
    });
  });

  it("reconciles legacy signals when module JSON is malformed", () => {
    const project = mapProjectSummary({
      id: "malformed-project",
      name: "مشروع قديم",
      description: null,
      status: "active",
      modules: "{not-json",
      goal_minor: "10000",
      outstanding_minor: "250",
    });

    expect(project.modules).toMatchObject({
      transactions: true,
      goal: true,
      workers: true,
    });
  });

  it("preserves valid module flags while evidence repairs malformed flags", () => {
    const project = mapProjectSummary({
      id: "partial-modules-project",
      name: "مشروع قديم",
      description: null,
      status: "active",
      modules: {
        transactions: true,
        goal: "invalid",
        workers: false,
        capital: true,
        inventory: true,
      livestock: false,
      },
      goal_minor: "10000",
      active_workers: 1,
    });

    expect(project.modules).toEqual({
      transactions: true,
      goal: true,
      workers: true,
      capital: true,
      inventory: true,
    livestock: false,
    });
  });

  it("computes capital recovery as a finite percentage", () => {
    const base = {
      id: "capital-project",
      name: "مشروع",
      description: "وصف",
      status: "active" as const,
      capital_minor: "3000",
      income_minor: "2500",
      expense_minor: "1000",
      inventory_value_minor: "750",
      item_count: "3",
    };

    expect(mapProjectSummary(base)).toMatchObject({
      capitalMinor: 3000n,
      capitalRecoveredRate: 50,
      inventoryValueMinor: 750n,
      inventoryItemCount: 3,
    });
    expect(
      Number.isFinite(
        mapProjectSummary({
          ...base,
          capital_minor: "1",
          income_minor: `1${"0".repeat(400)}`,
          expense_minor: "0",
        }).capitalRecoveredRate!,
      ),
    ).toBe(true);
  });

  it("uses labor-adjusted capital recovery when workers are enabled", () => {
    const project = mapProjectSummary({
      id: "labor-capital-project",
      name: "مشروع",
      description: "وصف",
      status: "active",
      modules: {
        transactions: true,
        goal: false,
        workers: true,
        capital: true,
        inventory: false,
      livestock: false,
      },
      capital_minor: "2000",
      income_minor: "5000",
      expense_minor: "1000",
      outstanding_minor: "1000",
    });

    expect(project.capitalRecoveredRate).toBe(150);
  });

  it("rejects malformed and unsafe project money fields", () => {
    const base = {
      id: "invalid-money-project",
      name: "مشروع",
      description: null,
      status: "active" as const,
    };

    expect(() =>
      mapProjectSummary({ ...base, income_minor: "12.5" }),
    ).toThrow(/سلامة البيانات.*income_minor/);
    expect(() =>
      mapProjectSummary({
        ...base,
        goal_minor: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow(/سلامة البيانات.*goal_minor/);
  });
});

describe("mapDebtSummary", () => {
  it("preserves exact debt balances from text read models", () => {
    const debt = mapDebtSummary({
      id: "debt-1",
      workspace_id: "workspace-1",
      party_id: "party-1",
      party_name: "محمد",
      party_phone: null,
      direction: "receivable",
      principal_minor: "900719925474099312345",
      balance_minor: "900719925474099312000",
      paid_minor: "345",
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
    });

    expect(debt).toMatchObject({
      partyName: "محمد",
      principalMinor: 900719925474099312345n,
      balanceMinor: 900719925474099312000n,
      paidMinor: 345n,
    });
  });
});

describe("mapCapitalEntry", () => {
  it("maps capital money into bigint domain values", () => {
    expect(
      mapCapitalEntry({
        id: "capital-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        entry_type: "withdrawal",
        amount_minor: "-1250",
        currency_code: "LYD",
        note: null,
        occurred_on: "2026-07-13",
        created_by: "user-1",
        client_id: "client-1",
        created_at: "2026-07-13T12:00:00Z",
      }),
    ).toMatchObject({
      entryType: "withdrawal",
      amountMinor: -1250n,
      occurredOn: "2026-07-13",
    });
  });

  it("rejects unsafe numeric money instead of rounding it", () => {
    expect(() =>
      mapCapitalEntry({
        id: "capital-unsafe",
        workspace_id: "workspace-1",
        project_id: "project-1",
        entry_type: "contribution",
        amount_minor: Number.MAX_SAFE_INTEGER + 1,
        currency_code: "LYD",
        note: null,
        occurred_on: "2026-07-13",
        created_by: "user-1",
        client_id: "client-unsafe",
        created_at: "2026-07-13T12:00:00Z",
      }),
    ).toThrow(/سلامة البيانات.*amount_minor/);
  });

  it("rejects malformed textual capital money", () => {
    expect(() =>
      mapCapitalEntry({
        id: "capital-malformed",
        workspace_id: "workspace-1",
        project_id: "project-1",
        entry_type: "contribution",
        amount_minor: "1e3",
        currency_code: "LYD",
        note: null,
        occurred_on: "2026-07-13",
        created_by: "user-1",
        client_id: "client-malformed",
        created_at: "2026-07-13T12:00:00Z",
      }),
    ).toThrow(/سلامة البيانات.*amount_minor/);
  });
});

describe("mapInventoryItem", () => {
  it("maps inventory quantities and optional money safely", () => {
    expect(
      mapInventoryItem({
        id: "item-1",
        workspace_id: "workspace-1",
        project_id: "project-1",
        name: "حبوب",
        quantity: "2.5",
        unit_label: "كيس",
        unit_cost_minor: "4500",
        currency_code: "LYD",
        status: "active",
        created_by: "user-1",
        created_at: "2026-07-13T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      }),
    ).toMatchObject({
      quantity: 2.5,
      unitLabel: "كيس",
      unitCostMinor: 4500n,
      barcode: null,
      locationId: null,
    });
  });

  it("rejects malformed textual unit costs instead of truncating them", () => {
    expect(() =>
      mapInventoryItem({
        id: "item-invalid-cost",
        workspace_id: "workspace-1",
        project_id: "project-1",
        name: "حبوب",
        quantity: 1,
        unit_label: "كيس",
        unit_cost_minor: "4500.75",
        currency_code: "LYD",
        status: "active",
        created_by: "user-1",
        created_at: "2026-07-13T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      }),
    ).toThrow(/سلامة البيانات.*unit_cost_minor/);
  });

  it("rejects unsafe numeric unit costs", () => {
    expect(() =>
      mapInventoryItem({
        id: "item-unsafe-cost",
        workspace_id: "workspace-1",
        project_id: "project-1",
        name: "حبوب",
        quantity: 1,
        unit_label: "كيس",
        unit_cost_minor: Number.MAX_SAFE_INTEGER + 1,
        currency_code: "LYD",
        status: "active",
        created_by: "user-1",
        created_at: "2026-07-13T12:00:00Z",
        updated_at: "2026-07-13T12:00:00Z",
      }),
    ).toThrow(/سلامة البيانات.*unit_cost_minor/);
  });
});

describe("mapWorkerBalance", () => {
  it("preserves oversized textual worker money exactly", () => {
    const worker = mapWorkerBalance({
      worker_id: "worker-1",
      workspace_id: "workspace-1",
      project_id: "project-1",
      name: "عامل",
      phone: null,
      daily_wage_minor: "900719925474099312341",
      status: "active",
      balance_minor: "900719925474099312342",
      earned_minor: "900719925474099312343",
      withdrawn_minor: "900719925474099312344",
      deducted_minor: "900719925474099312345",
      work_days: 4,
    });

    expect(worker).toMatchObject({
      dailyWageMinor: 900719925474099312341n,
      balanceMinor: 900719925474099312342n,
      earnedMinor: 900719925474099312343n,
      withdrawnMinor: 900719925474099312344n,
      deductedMinor: 900719925474099312345n,
    });
  });

  it("rejects unsafe raw worker money with the exact field name", () => {
    expect(() =>
      mapWorkerBalance({
        worker_id: "worker-unsafe",
        workspace_id: "workspace-1",
        project_id: "project-1",
        name: "عامل",
        phone: null,
        daily_wage_minor: Number.MAX_SAFE_INTEGER + 1,
        status: "active",
        balance_minor: "0",
        earned_minor: "0",
        withdrawn_minor: "0",
        deducted_minor: "0",
        work_days: 0,
      }),
    ).toThrow(/سلامة البيانات.*daily_wage_minor/);
  });
});

describe("mapWorkLog", () => {
  it("preserves an oversized textual work-log amount exactly", () => {
    const workLog = mapWorkLog({
      id: "log-1",
      workspace_id: "workspace-1",
      project_id: "project-1",
      worker_id: "worker-1",
      entry_type: "adjustment",
      work_date: "2026-07-13",
      amount_minor: "-900719925474099312345",
      currency_code: "LYD",
      note: null,
      created_at: "2026-07-13T12:00:00Z",
    });

    expect(workLog.amountMinor).toBe(-900719925474099312345n);
  });

  it("rejects malformed work-log money with the exact field name", () => {
    expect(() =>
      mapWorkLog({
        id: "log-invalid",
        workspace_id: "workspace-1",
        project_id: "project-1",
        worker_id: "worker-1",
        entry_type: "bonus",
        work_date: "2026-07-13",
        amount_minor: "1e3",
        currency_code: "LYD",
        note: null,
        created_at: "2026-07-13T12:00:00Z",
      }),
    ).toThrow(/سلامة البيانات.*project_work_log_details\.amount_minor/);
  });
});
