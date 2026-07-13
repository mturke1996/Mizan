import { computeAnalytics } from "./compute-analytics";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import type { ProjectSummary } from "@/features/workspace/workspace-types";

describe("computeAnalytics", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  const transactions: FinanceTransaction[] = [
    {
      id: "1",
      kind: "income",
      walletId: "cash",
      amountMinor: 1_000_000n,
      currency: "LYD",
      title: "دخل",
      occurredAt: "2026-07-10T10:00:00.000Z",
    },
    {
      id: "2",
      kind: "expense",
      walletId: "cash",
      amountMinor: 250_000n,
      currency: "LYD",
      title: "مصروف",
      categoryId: "cat-1",
      occurredAt: "2026-07-11T10:00:00.000Z",
    },
  ];

  const projects: ProjectSummary[] = [
    {
      id: "p1",
      name: "مقهى",
      description: "يوميات",
      status: "active",
      projectType: "food",
      modules: {
        transactions: true,
        goal: false,
        workers: true,
        capital: true,
        inventory: true,
      livestock: false,
      },
      incomeMinor: 1_000_000n,
      expenseMinor: 250_000n,
      profitMinor: 750_000n,
      progress: 50,
      mark: "م",
      tone: "bg-primary-soft text-primary",
      colorToken: "primary",
      outstandingLaborMinor: 200_000n,
      activeWorkers: 1,
      capitalMinor: 500_000n,
      capitalRecoveredRate: 150,
      inventoryValueMinor: 100_000n,
      inventoryItemCount: 4,
    },
  ];

  it("computes savings rate, burn, and insights from real movements", () => {
    const result = computeAnalytics({
      transactions,
      projects,
      totalBalanceMinor: 2_000_000n,
      categoryNames: new Map([["cat-1", "مستلزمات"]]),
      months: 3,
      now,
    });

    expect(result.incomeMinor).toBe(1_000_000n);
    expect(result.expenseMinor).toBe(250_000n);
    expect(result.savingsRate).toBe(75);
    expect(result.categoryMix[0]?.name).toBe("مستلزمات");
    expect(result.topProjects[0]?.name).toBe("مقهى");
    expect(result.topProjects[0]?.profitMinor).toBe(550_000n);
    expect(result.laborLiabilityMinor).toBe(200_000n);
    expect(result.laborCoverageRate).toBe(1000);
    expect(result.projectedExpenseMinor).toBeGreaterThan(result.expenseMinor);
    expect(result.confidence).toBe("low");
    expect(result.expenseConcentrationRate).toBe(100);
    expect(result.positiveMonthsRate).toBeNull();
    expect(result.achievements.map((item) => item.id)).toEqual(["labor"]);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("excludes other currencies and transfers from cash-flow metrics", () => {
    const mixedTransactions: FinanceTransaction[] = [
      ...transactions,
      {
        id: "usd-income",
        kind: "income",
        walletId: "usd",
        amountMinor: 9_000_000n,
        currency: "USD",
        title: "دخل بالدولار",
        occurredAt: "2026-07-12T10:00:00.000Z",
      },
      {
        id: "transfer",
        kind: "transfer",
        walletId: "cash",
        destinationWalletId: "bank",
        amountMinor: 8_000_000n,
        currency: "LYD",
        title: "تحويل",
        occurredAt: "2026-07-12T11:00:00.000Z",
      },
    ];

    const result = computeAnalytics({
      transactions: mixedTransactions,
      projects: [],
      totalBalanceMinor: 2_000_000n,
      currency: "LYD",
      now,
    });

    expect(result.incomeMinor).toBe(1_000_000n);
    expect(result.expenseMinor).toBe(250_000n);
    expect(result.dataPoints).toBe(2);
  });

  it("nets signed reversals to zero in workspace cash-flow metrics", () => {
    const result = computeAnalytics({
      transactions: [
        {
          ...transactions[0]!,
          id: "income-original",
          amountMinor: 500_000n,
        },
        {
          ...transactions[0]!,
          id: "income-reversal",
          amountMinor: -500_000n,
        },
        {
          ...transactions[1]!,
          id: "expense-original",
          amountMinor: 125_000n,
        },
        {
          ...transactions[1]!,
          id: "expense-reversal",
          amountMinor: -125_000n,
        },
      ],
      projects: [],
      totalBalanceMinor: 0n,
      now,
    });

    expect(result.incomeMinor).toBe(0n);
    expect(result.expenseMinor).toBe(0n);
    expect(result.netMinor).toBe(0n);
    expect(result.monthlyTrend.at(-1)).toMatchObject({
      income: 0,
      expense: 0,
    });
  });

  it("uses ISO minor-unit precision for non-LYD analytics", () => {
    const result = computeAnalytics({
      transactions: [
        {
          id: "usd-expense",
          kind: "expense",
          walletId: "usd",
          amountMinor: 3_100n,
          currency: "USD",
          title: "مصروف بالدولار",
          occurredAt: "2026-07-10T10:00:00.000Z",
        },
      ],
      projects: [],
      totalBalanceMinor: 31_000n,
      currency: "USD",
      now,
      months: 2,
    });

    expect(result.averageDailyExpense).toBeCloseTo(31 / 13, 5);
    expect(result.monthlyTrend.at(-1)?.expense).toBe(31);
    expect(result.runwayDays).toBe(130);
  });

  it("uses the workspace timezone at month boundaries", () => {
    const boundaryTransactions: FinanceTransaction[] = [
      {
        id: "tripoli-july",
        kind: "income",
        walletId: "cash",
        amountMinor: 100_000n,
        currency: "LYD",
        title: "بعد منتصف الليل محليًا",
        occurredAt: "2026-06-30T23:30:00.000Z",
      },
      {
        id: "tripoli-june",
        kind: "income",
        walletId: "cash",
        amountMinor: 50_000n,
        currency: "LYD",
        title: "قبل منتصف الليل محليًا",
        occurredAt: "2026-06-30T21:00:00.000Z",
      },
    ];

    const result = computeAnalytics({
      transactions: boundaryTransactions,
      projects: [],
      totalBalanceMinor: 100_000n,
      currency: "LYD",
      timeZone: "Africa/Tripoli",
      now: new Date("2026-07-01T00:30:00.000Z"),
      months: 2,
    });

    expect(result.incomeMinor).toBe(100_000n);
    expect(result.monthlyTrend[0]?.income).toBe(50);
    expect(result.monthlyTrend[1]?.income).toBe(100);
  });

  it("does not invent an expense ratio when there is no income", () => {
    const result = computeAnalytics({
      transactions: [
        {
          id: "expense-only",
          kind: "expense",
          walletId: "cash",
          amountMinor: 100_000n,
          currency: "LYD",
          title: "مصروف",
          occurredAt: "2026-07-10T10:00:00.000Z",
        },
      ],
      projects: [],
      totalBalanceMinor: -10_000n,
      currency: "LYD",
      now,
    });

    expect(result.expenseRatio).toBeNull();
    expect(result.runwayDays).toBe(0);
    expect(result.healthScore).toBeNull();
  });

  it("awards progress only after enough supporting movements", () => {
    const result = computeAnalytics({
      transactions: [
        ...transactions,
        {
          id: "3",
          kind: "expense",
          walletId: "cash",
          amountMinor: 50_000n,
          currency: "LYD",
          title: "مصروف إضافي",
          categoryId: "cat-2",
          occurredAt: "2026-07-12T10:00:00.000Z",
        },
      ],
      projects,
      totalBalanceMinor: 2_000_000n,
      categoryNames: new Map([
        ["cat-1", "مستلزمات"],
        ["cat-2", "نقل"],
      ]),
      months: 3,
      now,
    });

    expect(result.healthScore).not.toBeNull();
    expect(result.achievements.map((item) => item.id)).toEqual([
      "saving",
      "liquidity",
      "labor",
    ]);
  });

  it("ignores labor liabilities from projects with the workers module disabled", () => {
    const result = computeAnalytics({
      transactions,
      projects: [
        {
          ...projects[0]!,
          modules: {
            transactions: true,
            goal: false,
            workers: false,
            capital: true,
            inventory: false,
          livestock: false,
          },
          outstandingLaborMinor: 900_000n,
          activeWorkers: 4,
        },
      ],
      totalBalanceMinor: 100_000n,
      months: 3,
      now,
    });

    expect(result.laborLiabilityMinor).toBe(0n);
    expect(result.laborCoverageRate).toBeNull();
    expect(result.topProjects[0]?.outstandingLaborMinor).toBe(0n);
    expect(result.topProjects[0]?.profitMinor).toBe(750_000n);
    expect(
      result.insights.some((insight) => insight.includes("عمال")),
    ).toBe(false);
  });

  it("compares the current monthly pace with the previous full month", () => {
    const result = computeAnalytics({
      transactions: [
        ...transactions,
        {
          id: "june-income",
          kind: "income",
          walletId: "cash",
          amountMinor: 2_000_000n,
          currency: "LYD",
          title: "دخل يونيو",
          occurredAt: "2026-06-20T10:00:00.000Z",
        },
        {
          id: "june-expense",
          kind: "expense",
          walletId: "cash",
          amountMinor: 500_000n,
          currency: "LYD",
          title: "مصروف يونيو",
          occurredAt: "2026-06-20T10:00:00.000Z",
        },
      ],
      projects: [],
      totalBalanceMinor: 2_000_000n,
      currency: "LYD",
      months: 3,
      now,
    });

    expect(result.incomeTrendRate).toBeCloseTo(19.23, 1);
    expect(result.expenseTrendRate).toBeCloseTo(19.23, 1);
  });
});
