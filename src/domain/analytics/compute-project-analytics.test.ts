import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { PROJECT_BLUEPRINTS } from "@/features/projects/project-blueprints";
import type {
  ProjectModules,
  ProjectSummary,
} from "@/features/workspace/workspace-types";
import {
  PROJECT_HEALTH_FORMULA,
  PROJECT_HEALTH_WEIGHTS,
  computeProjectAnalytics,
} from "./compute-project-analytics";
import type {
  ProjectAnalyticsAchievement,
  ProjectAnalyticsSetupStep,
  ProjectAnalyticsSnapshot,
  ProjectExpenseCategoryMix,
  ProjectMonthlyTrendPoint,
} from "./compute-project-analytics";

type ProjectOverrides = Omit<Partial<ProjectSummary>, "modules"> & {
  modules?: Partial<ProjectModules>;
};

function project(overrides: ProjectOverrides = {}): ProjectSummary {
  const modules: ProjectModules = {
    transactions: true,
    goal: false,
    workers: false,
    capital: false,
    inventory: false,
    livestock: false,
    ...overrides.modules,
  } as ProjectModules;

  return {
    id: "project-1",
    name: "مشروع الاختبار",
    description: "وصف",
    status: "active",
    projectType: "general",
    incomeMinor: 999_999n,
    expenseMinor: 999_999n,
    profitMinor: 0n,
    progress: 0,
    mark: "م",
    tone: "bg-primary-soft text-primary",
    colorToken: "primary",
    outstandingLaborMinor: 0n,
    activeWorkers: 0,
    capitalMinor: 0n,
    capitalRecoveredRate: null,
    inventoryValueMinor: 0n,
    inventoryItemCount: 0,
    ...overrides,
    modules,
  };
}

interface TransactionOverrides {
  id: string;
  kind?: FinanceTransaction["kind"];
  amountMinor?: bigint;
  occurredAt?: string;
  projectId?: string;
  categoryId?: string;
}

function transaction(overrides: TransactionOverrides): FinanceTransaction {
  const kind = overrides.kind ?? "income";
  const base = {
    id: overrides.id,
    amountMinor: overrides.amountMinor ?? 100n,
    currency: "LYD" as const,
    title: `حركة ${overrides.id}`,
    occurredAt: overrides.occurredAt ?? "2026-07-10T10:00:00.000Z",
    projectId: overrides.projectId ?? "project-1",
    ...(overrides.categoryId ? { categoryId: overrides.categoryId } : {}),
  };

  if (kind === "transfer") {
    return {
      ...base,
      kind,
      walletId: "cash",
      destinationWalletId: "bank",
    };
  }
  if (kind === "opening_balance") {
    return {
      ...base,
      kind: "opening_balance",
      walletId: "cash",
      flow: "in",
    };
  }
  return {
    ...base,
    kind: kind === "expense" ? "expense" : "income",
    walletId: "cash",
  };
}

function datedTransactions(
  count: number,
  occurredAt: string,
  prefix: string,
): FinanceTransaction[] {
  return Array.from({ length: count }, (_, index) =>
    transaction({
      id: `${prefix}-${index}`,
      occurredAt,
      amountMinor: 1n,
    }),
  );
}

describe("computeProjectAnalytics", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("computes cumulative project metrics while keeping the trend period-scoped", () => {
    const result = computeProjectAnalytics({
      project: project({
        modules: {
          workers: true,
          capital: true,
          inventory: true,
        livestock: false,
        },
        outstandingLaborMinor: 100n,
        activeWorkers: 1,
        capitalMinor: 300n,
        inventoryValueMinor: 700n,
        inventoryItemCount: 4,
      }),
      transactions: [
        transaction({
          id: "may-income",
          amountMinor: 100n,
          occurredAt: "2026-05-20T10:00:00.000Z",
        }),
        transaction({
          id: "june-income",
          amountMinor: 300n,
          occurredAt: "2026-06-10T10:00:00.000Z",
        }),
        transaction({
          id: "june-expense",
          kind: "expense",
          amountMinor: 100n,
          occurredAt: "2026-06-12T10:00:00.000Z",
        }),
        transaction({
          id: "july-income",
          amountMinor: 200n,
          occurredAt: "2026-07-11T10:00:00.000Z",
        }),
        transaction({
          id: "july-expense",
          kind: "expense",
          amountMinor: 50n,
          categoryId: "supplies",
          occurredAt: "2026-07-12T10:00:00.000Z",
        }),
        transaction({
          id: "other-project",
          amountMinor: 50_000n,
          projectId: "project-2",
        }),
        transaction({
          id: "project-transfer",
          kind: "transfer",
          amountMinor: 40_000n,
        }),
      ],
      categoryNames: new Map([["supplies", "مستلزمات"]]),
      months: 2,
      now,
      timeZone: "Africa/Tripoli",
    });

    expect(result.projectId).toBe("project-1");
    expect(result.transactionCount).toBe(5);
    expect(result.dataPoints).toBe(5);
    expect(result.confidence).toBe("low");
    expect(result.incomeMinor).toBe(600n);
    expect(result.expenseMinor).toBe(150n);
    expect(result.cashProfitMinor).toBe(450n);
    expect(result.outstandingLaborMinor).toBe(100n);
    expect(result.profitAfterLaborMinor).toBe(350n);
    expect(result.marginPercent).toBe(58.33);
    expect(result.capitalMinor).toBe(300n);
    expect(result.capitalRecoveredRate).toBe(116.66);
    expect(result.returnOnCapitalRate).toBe(116.66);
    expect(result.laborCoverageRate).toBe(450);
    expect(result.inventoryValueMinor).toBe(700n);
    expect(result.inventoryItemCount).toBe(4);
    expect(result.lastActivityAt).toBe("2026-07-12T10:00:00.000Z");
    expect(result.daysSinceActivity).toBe(1);
    expect(result.monthlyTrend).toEqual([
      {
        monthKey: "2026-06",
        month: "يونيو 2026",
        incomeMinor: 300n,
        expenseMinor: 100n,
      },
      {
        monthKey: "2026-07",
        month: "يوليو 2026",
        incomeMinor: 200n,
        expenseMinor: 50n,
      },
    ]);
    expect(result.categoryMix).toEqual([
      { name: "مستلزمات", amountMinor: 50n, percent: 100 },
    ]);
    expect(result.topExpenseCategory).toEqual(result.categoryMix[0]);
    expect(result.healthScore).toBe(100);
    expect(result.healthLabel).toBe("ممتاز");
  });

  it("uses scaled bigint math for exact money ratios beyond Number safety", () => {
    const unit = 9_007_199_254_740_993n;
    const result = computeProjectAnalytics({
      project: project({
        modules: { workers: true, capital: true },
        outstandingLaborMinor: unit,
        capitalMinor: 3n * unit,
      }),
      transactions: [
        transaction({ id: "income-1", amountMinor: 2n * unit }),
        transaction({ id: "income-2", amountMinor: unit }),
        transaction({
          id: "expense",
          kind: "expense",
          amountMinor: unit,
        }),
      ],
      now,
    });

    expect(result.cashProfitMinor).toBe(2n * unit);
    expect(result.profitAfterLaborMinor).toBe(unit);
    expect(result.marginPercent).toBe(33.33);
    expect(result.capitalRecoveredRate).toBe(33.33);
    expect(result.returnOnCapitalRate).toBe(33.33);
    expect(result.laborCoverageRate).toBe(200);
    expect(result.healthScore).toBe(79);
    expect(result.healthLabel).toBe("جيد");
    expect(PROJECT_HEALTH_WEIGHTS).toEqual({
      profitMargin: 40,
      capitalRecovery: 25,
      laborCoverage: 20,
      activityRecency: 15,
    });
    expect(PROJECT_HEALTH_FORMULA).toEqual({
      minimumDataPoints: 3,
      marginFloorPercent: -20,
      marginCeilingPercent: 40,
      recencyFullScoreDays: 7,
      recencyZeroScoreDays: 30,
    });
  });

  it("nets original project movements with their signed reversals", () => {
    const result = computeProjectAnalytics({
      project: project(),
      transactions: [
        transaction({ id: "income", amountMinor: 500n }),
        transaction({ id: "income-reversal", amountMinor: -500n }),
        transaction({
          id: "expense",
          kind: "expense",
          amountMinor: 200n,
          categoryId: "supplies",
        }),
        transaction({
          id: "expense-reversal",
          kind: "expense",
          amountMinor: -200n,
          categoryId: "supplies",
        }),
      ],
      now,
    });

    expect(result.transactionCount).toBe(4);
    expect(result.incomeMinor).toBe(0n);
    expect(result.expenseMinor).toBe(0n);
    expect(result.cashProfitMinor).toBe(0n);
    expect(result.monthlyTrend.at(-1)).toMatchObject({
      incomeMinor: 0n,
      expenseMinor: 0n,
    });
  });

  it("normalizes health weights and does not penalize unavailable modules", () => {
    const movements = [
      transaction({ id: "expense-1", kind: "expense", amountMinor: 30n }),
      transaction({ id: "expense-2", kind: "expense", amountMinor: 20n }),
      transaction({ id: "expense-3", kind: "expense", amountMinor: 10n }),
    ];
    const disabled = computeProjectAnalytics({
      project: project({
        capitalMinor: 50_000n,
        outstandingLaborMinor: 40_000n,
        inventoryValueMinor: 30_000n,
        inventoryItemCount: 8,
      }),
      transactions: movements,
      now,
    });
    const enabledButInapplicable = computeProjectAnalytics({
      project: project({
        modules: { capital: true, workers: true },
        capitalMinor: 0n,
        outstandingLaborMinor: 0n,
      }),
      transactions: movements,
      now,
    });

    expect(disabled.marginPercent).toBeNull();
    expect(disabled.capitalMinor).toBeNull();
    expect(disabled.capitalRecoveredRate).toBeNull();
    expect(disabled.laborCoverageRate).toBeNull();
    expect(disabled.inventoryValueMinor).toBeNull();
    expect(disabled.inventoryItemCount).toBeNull();
    expect(disabled.healthScore).toBe(27);
    expect(enabledButInapplicable.capitalRecoveredRate).toBeNull();
    expect(enabledButInapplicable.laborCoverageRate).toBeNull();
    expect(enabledButInapplicable.capitalMinor).toBe(0n);
    expect(enabledButInapplicable.healthScore).toBe(disabled.healthScore);
    expect(disabled.healthLabel).toBe("حرج");
    expect(disabled.setupSteps.map((step) => step.id)).toEqual([
      "project_basics",
      "first_transaction",
    ]);
    expect(disabled.insights.join(" ")).not.toContain("رأس المال");
    expect(disabled.insights.join(" ")).not.toContain("العمال");
  });

  it("keeps health unavailable below three valid non-transfer data points", () => {
    const result = computeProjectAnalytics({
      project: project(),
      transactions: [
        transaction({ id: "income" }),
        transaction({ id: "expense", kind: "expense" }),
        transaction({ id: "transfer", kind: "transfer" }),
        transaction({ id: "other", projectId: "another-project" }),
      ],
      now,
    });

    expect(result.transactionCount).toBe(2);
    expect(result.healthScore).toBeNull();
    expect(result.healthLabel).toBe("غير متاح");
  });

  it("uses local month and day boundaries and ignores invalid or future dates", () => {
    const result = computeProjectAnalytics({
      project: project(),
      transactions: [
        transaction({
          id: "tripoli-july",
          amountMinor: 100n,
          occurredAt: "2026-06-30T23:30:00.000Z",
        }),
        transaction({
          id: "tripoli-june",
          kind: "expense",
          amountMinor: 40n,
          occurredAt: "2026-06-30T21:00:00.000Z",
        }),
        transaction({
          id: "future",
          amountMinor: 900n,
          occurredAt: "2026-07-01T00:31:00.000Z",
        }),
        transaction({
          id: "invalid",
          amountMinor: 800n,
          occurredAt: "not-a-date",
        }),
      ],
      months: 2,
      now: new Date("2026-07-01T00:30:00.000Z"),
      timeZone: "Africa/Tripoli",
    });

    expect(result.transactionCount).toBe(2);
    expect(result.incomeMinor).toBe(100n);
    expect(result.expenseMinor).toBe(40n);
    expect(result.monthlyTrend).toEqual([
      {
        monthKey: "2026-06",
        month: "يونيو 2026",
        incomeMinor: 0n,
        expenseMinor: 40n,
      },
      {
        monthKey: "2026-07",
        month: "يوليو 2026",
        incomeMinor: 100n,
        expenseMinor: 0n,
      },
    ]);
    expect(result.lastActivityAt).toBe("2026-06-30T23:30:00.000Z");
    expect(result.daysSinceActivity).toBe(0);
    expect(result.healthScore).toBeNull();
  });

  it("rejects invalid now and accepts only strict offset ISO timestamps", () => {
    expect(() =>
      computeProjectAnalytics({
        project: project(),
        transactions: [],
        now: new Date("not-a-date"),
      }),
    ).toThrow("computeProjectAnalytics: now must be a valid Date");

    const result = computeProjectAnalytics({
      project: project(),
      transactions: [
        transaction({
          id: "utc",
          amountMinor: 100n,
          occurredAt: "2026-07-10T10:00:00.000Z",
        }),
        transaction({
          id: "numeric-offset",
          kind: "expense",
          amountMinor: 40n,
          occurredAt: "2026-07-10T12:00:00+02:00",
        }),
        transaction({
          id: "offsetless",
          amountMinor: 900n,
          occurredAt: "2026-07-10T10:00:00",
        }),
        transaction({
          id: "date-only",
          amountMinor: 800n,
          occurredAt: "2026-07-10",
        }),
        transaction({
          id: "impossible-date",
          amountMinor: 700n,
          occurredAt: "2026-02-30T10:00:00Z",
        }),
        transaction({
          id: "invalid-offset",
          amountMinor: 600n,
          occurredAt: "2026-07-10T10:00:00+15:00",
        }),
        transaction({
          id: "future",
          amountMinor: 500n,
          occurredAt: "2026-07-13T12:00:00.001Z",
        }),
      ],
      now,
      timeZone: "UTC",
    });

    expect(result.transactionCount).toBe(2);
    expect(result.incomeMinor).toBe(100n);
    expect(result.expenseMinor).toBe(40n);
    expect(result.lastActivityAt).toBe("2026-07-10T10:00:00.000Z");
  });

  it("provides unique chronological month identity for 13 and 24 months", () => {
    const thirteenMonths = computeProjectAnalytics({
      project: project(),
      transactions: [],
      months: 13,
      now,
      timeZone: "UTC",
    }).monthlyTrend;
    const twentyFourMonths = computeProjectAnalytics({
      project: project(),
      transactions: [],
      months: 24,
      now,
      timeZone: "UTC",
    }).monthlyTrend;

    expect(thirteenMonths).toHaveLength(13);
    expect(thirteenMonths[0]).toMatchObject({
      monthKey: "2025-07",
      month: "يوليو 2025",
    });
    expect(thirteenMonths.at(-1)).toMatchObject({
      monthKey: "2026-07",
      month: "يوليو 2026",
    });
    expect(new Set(thirteenMonths.map((point) => point.monthKey)).size).toBe(13);

    expect(twentyFourMonths).toHaveLength(24);
    expect(twentyFourMonths[0]).toMatchObject({
      monthKey: "2024-08",
      month: "أغسطس 2024",
    });
    expect(twentyFourMonths.at(-1)).toMatchObject({
      monthKey: "2026-07",
      month: "يوليو 2026",
    });
    const orderedKeys = twentyFourMonths.map((point) => point.monthKey);
    expect(orderedKeys).toEqual([...orderedKeys].sort());
  });

  it("normalizes one-to-six ISO fractional digits before parsing", () => {
    const result = computeProjectAnalytics({
      project: project(),
      transactions: [
        transaction({
          id: "microseconds-z",
          amountMinor: 100n,
          occurredAt: "2026-07-13T10:00:00.123456Z",
        }),
        transaction({
          id: "microseconds-offset",
          kind: "expense",
          amountMinor: 40n,
          occurredAt: "2026-07-13T10:00:00.123456+00:00",
        }),
        transaction({
          id: "too-many-fractional-digits",
          amountMinor: 900n,
          occurredAt: "2026-07-13T10:00:00.1234567Z",
        }),
      ],
      now: new Date("2026-07-13T10:00:00.123Z"),
      timeZone: "UTC",
    });

    expect(result.transactionCount).toBe(2);
    expect(result.incomeMinor).toBe(100n);
    expect(result.expenseMinor).toBe(40n);
  });

  it("scores activity by calendar recency and warns only after 30 days", () => {
    const at = (date: string) => [
      transaction({ id: `${date}-income-1`, amountMinor: 100n, occurredAt: date }),
      transaction({ id: `${date}-income-2`, amountMinor: 100n, occurredAt: date }),
      transaction({
        id: `${date}-expense`,
        kind: "expense" as const,
        amountMinor: 100n,
        occurredAt: date,
      }),
    ];
    const sevenDays = computeProjectAnalytics({
      project: project(),
      transactions: at("2026-07-06T10:00:00.000Z"),
      now,
      timeZone: "UTC",
    });
    const thirtyDays = computeProjectAnalytics({
      project: project(),
      transactions: at("2026-06-13T10:00:00.000Z"),
      now,
      timeZone: "UTC",
    });
    const thirtyOneDays = computeProjectAnalytics({
      project: project(),
      transactions: at("2026-06-12T10:00:00.000Z"),
      now,
      timeZone: "UTC",
    });

    expect(sevenDays.daysSinceActivity).toBe(7);
    expect(sevenDays.healthScore).toBe(100);
    expect(thirtyDays.daysSinceActivity).toBe(30);
    expect(thirtyDays.healthScore).toBe(73);
    expect(thirtyDays.insights.join(" ")).not.toContain("30 يومًا");
    expect(thirtyOneDays.daysSinceActivity).toBe(31);
    expect(thirtyOneDays.insights.join(" ")).toContain("31 يومًا");
  });

  it("assigns confidence from data count and active-month support", () => {
    const low = computeProjectAnalytics({
      project: project(),
      transactions: datedTransactions(
        9,
        "2026-07-01T10:00:00.000Z",
        "low",
      ),
      now,
    });
    const medium = computeProjectAnalytics({
      project: project(),
      transactions: [
        ...datedTransactions(
          5,
          "2026-06-01T10:00:00.000Z",
          "medium-june",
        ),
        ...datedTransactions(
          5,
          "2026-07-01T10:00:00.000Z",
          "medium-july",
        ),
      ],
      now,
    });
    const high = computeProjectAnalytics({
      project: project(),
      transactions: [
        ...datedTransactions(
          10,
          "2026-05-01T10:00:00.000Z",
          "high-may",
        ),
        ...datedTransactions(
          10,
          "2026-06-01T10:00:00.000Z",
          "high-june",
        ),
        ...datedTransactions(
          10,
          "2026-07-01T10:00:00.000Z",
          "high-july",
        ),
      ],
      now,
    });

    expect(low.confidence).toBe("low");
    expect(medium.confidence).toBe("medium");
    expect(high.confidence).toBe("high");
  });

  it("derives each achievement without persisting fake unlock dates", () => {
    const achieved = computeProjectAnalytics({
      project: project({
        modules: {
          goal: true,
          workers: true,
          capital: true,
        },
        goalMinor: 300n,
        outstandingLaborMinor: 100n,
        capitalMinor: 100n,
      }),
      transactions: [
        transaction({
          id: "june-income",
          amountMinor: 200n,
          occurredAt: "2026-06-10T10:00:00.000Z",
        }),
        transaction({
          id: "june-expense",
          kind: "expense",
          amountMinor: 100n,
          occurredAt: "2026-06-11T10:00:00.000Z",
        }),
        transaction({
          id: "july-income",
          amountMinor: 100n,
          occurredAt: "2026-07-10T10:00:00.000Z",
        }),
      ],
      months: 1,
      now,
    });

    expect(achieved.achievements).toEqual([
      {
        id: "capital_recovered",
        title: "استرداد رأس المال",
        detail:
          "غطّى صافي المشروع بعد مستحقات العمال كامل رأس المال المسجّل.",
      },
      {
        id: "first_profitable_month",
        title: "أول شهر رابح",
        detail: "حقق المشروع صافيًا موجبًا في شهر مكتمل واحد على الأقل.",
      },
      {
        id: "labor_covered",
        title: "مستحقات العمال مغطاة",
        detail:
          "الربح النقدي الموجب يقدّر تغطية كامل مستحقات العمال الحالية.",
      },
      {
        id: "goal_reached",
        title: "تحقق هدف الإيرادات",
        detail: "بلغ الدخل التراكمي هدف الإيرادات المحدد للمشروع.",
      },
    ]);
    expect(achieved.insights.join(" ")).toContain("استُرد رأس المال بالكامل");

    const notAchieved = computeProjectAnalytics({
      project: project({
        modules: {
          goal: true,
          workers: true,
          capital: true,
        },
        goalMinor: 400n,
        outstandingLaborMinor: 300n,
        capitalMinor: 100n,
      }),
      transactions: [
        transaction({
          id: "flat-june-income",
          amountMinor: 100n,
          occurredAt: "2026-06-10T10:00:00.000Z",
        }),
        transaction({
          id: "flat-june-expense",
          kind: "expense",
          amountMinor: 100n,
          occurredAt: "2026-06-11T10:00:00.000Z",
        }),
        transaction({
          id: "small-july-income",
          amountMinor: 100n,
          occurredAt: "2026-07-10T10:00:00.000Z",
        }),
      ],
      now,
    });

    expect(notAchieved.achievements).toEqual([]);
  });

  it("returns null rates when active capital and worker bases are zero", () => {
    const result = computeProjectAnalytics({
      project: project({
        modules: { capital: true, workers: true },
        capitalMinor: 0n,
        outstandingLaborMinor: 0n,
      }),
      transactions: [
        transaction({ id: "income-1", amountMinor: 100n }),
        transaction({ id: "income-2", amountMinor: 100n }),
        transaction({ id: "income-3", amountMinor: 100n }),
      ],
      now,
    });

    expect(result.capitalRecoveredRate).toBeNull();
    expect(result.laborCoverageRate).toBeNull();
    expect(result.healthScore).toBe(100);
    expect(result.insights).toEqual([
      "ثقة التحليل منخفضة لأنها مبنية على 3 حركات فقط.",
      "إشارة إيجابية: الربح موجب بهامش 100%.",
    ]);
  });

  it.each([
    {
      caseName: "worker module is disabled",
      workers: false,
      outstandingLaborMinor: 500n,
    },
    {
      caseName: "worker liability is zero",
      workers: true,
      outstandingLaborMinor: 0n,
    },
  ])(
    "uses neutral profit copy when $caseName",
    ({ workers, outstandingLaborMinor }) => {
      const result = computeProjectAnalytics({
        project: project({
          modules: { capital: true, workers },
          capitalMinor: 100n,
          outstandingLaborMinor,
        }),
        transactions: [
          transaction({ id: "income-1", amountMinor: 100n }),
          transaction({ id: "income-2", amountMinor: 100n }),
          transaction({ id: "income-3", amountMinor: 100n }),
        ],
        now,
      });

      expect(result.achievements).toEqual([
        {
          id: "capital_recovered",
          title: "استرداد رأس المال",
          detail: "غطّى الربح كامل رأس المال المسجّل.",
        },
      ]);
      expect(result.insights).toEqual([
        "ثقة التحليل منخفضة لأنها مبنية على 3 حركات فقط.",
        "استُرد رأس المال بالكامل وفق الربح.",
        "إشارة إيجابية: الربح موجب بهامش 100%.",
      ]);
      expect(
        [
          ...result.insights,
          ...result.achievements.map((achievement) => achievement.detail),
        ].join(" "),
      ).not.toMatch(/العمال|مستحقات/);
    },
  );

  it("uses neutral profit copy for capital progress without worker liability", () => {
    const result = computeProjectAnalytics({
      project: project({
        modules: { capital: true },
        capitalMinor: 500n,
        outstandingLaborMinor: 400n,
      }),
      transactions: [
        transaction({ id: "income-1", amountMinor: 100n }),
        transaction({ id: "income-2", amountMinor: 100n }),
        transaction({ id: "income-3", amountMinor: 100n }),
      ],
      now,
    });

    expect(result.capitalRecoveredRate).toBe(60);
    expect(result.achievements).toEqual([]);
    expect(result.insights).toEqual([
      "ثقة التحليل منخفضة لأنها مبنية على 3 حركات فقط.",
      "تقدّم استرداد رأس المال عند 60% وفق الربح.",
      "إشارة إيجابية: الربح موجب بهامش 100%.",
    ]);
  });

  it("builds a catalog-backed setup journey from enabled modules and data", () => {
    const configuredProject = project({
      projectType: "services",
      modules: {
        goal: true,
        workers: true,
        capital: true,
        inventory: true,
      livestock: false,
      },
      goalMinor: 1_000n,
      activeWorkers: 1,
      capitalMinor: 0n,
      inventoryItemCount: 0,
    });
    const partial = computeProjectAnalytics({
      project: configuredProject,
      transactions: [transaction({ id: "first" })],
      now,
    });

    expect(partial.setupSteps.map((step) => step.id)).toEqual([
      "project_basics",
      "first_transaction",
      "set_goal",
      "opening_capital",
      "first_worker",
      "first_inventory_item",
    ]);
    expect(partial.setupSteps.map((step) => step.completed)).toEqual([
      true,
      true,
      true,
      false,
      true,
      false,
    ]);
    expect(partial.setupProgress).toBe(67);
    expect(partial.setupComplete).toBe(false);
    expect(partial.setupSteps[0]?.route).toBe("/projects/project-1");
    expect(partial.setupSteps[1]?.route).toBe(
      "/transactions/new?project=project-1",
    );
    expect(partial.setupSteps[2]?.action).toBe("configure_goal");
    expect(partial.setupSteps[3]?.action).toBe("record_capital");
    expect(partial.setupSteps[4]?.action).toBe("add_worker");
    expect(partial.setupSteps[5]?.action).toBe("add_inventory_item");
    expect(partial.setupSteps[1]?.detail).toBe(
      PROJECT_BLUEPRINTS.services.setupSteps.find(
        (step) => step.id === "first_transaction",
      )?.description,
    );
    expect(partial.setupSteps[3]?.detail).toBe(
      PROJECT_BLUEPRINTS.goods.setupSteps.find(
        (step) => step.id === "opening_capital",
      )?.description,
    );

    const complete = computeProjectAnalytics({
      project: {
        ...configuredProject,
        capitalMinor: 1n,
        inventoryItemCount: 1,
      },
      transactions: [transaction({ id: "first" })],
      now,
    });

    expect(complete.setupProgress).toBe(100);
    expect(complete.setupComplete).toBe(true);
  });

  it("orders Arabic insights deterministically and caps them at four", () => {
    const input = {
      project: project({
        modules: { workers: true, capital: true },
        outstandingLaborMinor: 500n,
        capitalMinor: 1_000n,
      }),
      transactions: [
        transaction({ id: "income-1", amountMinor: 200n }),
        transaction({ id: "income-2", amountMinor: 100n }),
        transaction({
          id: "expense",
          kind: "expense" as const,
          amountMinor: 200n,
          categoryId: "supplies",
        }),
      ],
      categoryNames: new Map([["supplies", "مستلزمات"]]),
      now,
    };

    const first = computeProjectAnalytics(input);
    const second = computeProjectAnalytics(input);

    expect(first.insights).toEqual(second.insights);
    expect(first.insights).toHaveLength(4);
    expect(first.insights[0]).toContain("3 حركات");
    expect(first.insights[1]).toContain("استرداد رأس المال");
    expect(first.insights[2]).toContain("مستلزمات");
    expect(first.insights[3]).toContain("تغطية تقديرية");
  });

  it("adds the positive signal deterministically only when supported", () => {
    const supportedInput = {
      project: project(),
      transactions: [
        transaction({ id: "income-1", amountMinor: 100n }),
        transaction({ id: "income-2", amountMinor: 100n }),
        transaction({ id: "income-3", amountMinor: 100n }),
      ],
      now,
    };
    const supported = computeProjectAnalytics(supportedInput);
    const supportedAgain = computeProjectAnalytics(supportedInput);

    expect(supported.insights).toEqual([
      "ثقة التحليل منخفضة لأنها مبنية على 3 حركات فقط.",
      "إشارة إيجابية: الربح موجب بهامش 100%.",
    ]);
    expect(supportedAgain.insights).toEqual(supported.insights);

    const unsupportedInput = {
      project: project({
        modules: { workers: true },
        outstandingLaborMinor: 400n,
      }),
      transactions: [
        transaction({ id: "income-1", amountMinor: 100n }),
        transaction({ id: "income-2", amountMinor: 100n }),
        transaction({ id: "income-3", amountMinor: 100n }),
      ],
      now,
    };
    const unsupported = computeProjectAnalytics(unsupportedInput);
    const unsupportedAgain = computeProjectAnalytics(unsupportedInput);

    expect(unsupported.insights).toEqual(unsupportedAgain.insights);
    expect(
      unsupported.insights.some((insight) =>
        insight.startsWith("إشارة إيجابية"),
      ),
    ).toBe(false);
  });

  it("is invariant to transaction permutations and category ties", () => {
    const transactions = [
      transaction({
        id: "income",
        amountMinor: 300n,
        occurredAt: "2026-07-10T10:00:00.000Z",
      }),
      transaction({
        id: "expense-b",
        kind: "expense",
        amountMinor: 100n,
        categoryId: "category-b",
        occurredAt: "2026-07-10T10:00:00.000Z",
      }),
      transaction({
        id: "expense-a",
        kind: "expense",
        amountMinor: 100n,
        categoryId: "category-a",
        occurredAt: "2026-07-10T10:00:00.000Z",
      }),
    ];
    const input = {
      project: project(),
      categoryNames: new Map([
        ["category-b", "باء"],
        ["category-a", "ألف"],
      ]),
      now,
      timeZone: "UTC",
    };

    const original = computeProjectAnalytics({ ...input, transactions });
    const permuted = computeProjectAnalytics({
      ...input,
      transactions: [transactions[2]!, transactions[0]!, transactions[1]!],
    });

    expect(original).toEqual(permuted);
    expect(original.categoryMix.map((category) => category.name)).toEqual([
      "ألف",
      "باء",
    ]);
  });

  it("saturates extreme ratios without Infinity or unsafe conversion", () => {
    const huge = 10n ** 80n;
    const positive = computeProjectAnalytics({
      project: project({
        modules: { capital: true, workers: true },
        capitalMinor: 1n,
        outstandingLaborMinor: 1n,
      }),
      transactions: [
        transaction({ id: "income-1", amountMinor: huge }),
        transaction({ id: "income-2", amountMinor: huge }),
        transaction({ id: "income-3", amountMinor: huge }),
      ],
      now,
    });
    const negative = computeProjectAnalytics({
      project: project({
        modules: { capital: true },
        capitalMinor: 1n,
      }),
      transactions: [
        transaction({ id: "small-income", amountMinor: 1n }),
        transaction({
          id: "huge-expense",
          kind: "expense",
          amountMinor: huge,
        }),
        transaction({
          id: "second-expense",
          kind: "expense",
          amountMinor: 1n,
        }),
      ],
      now,
    });
    const saturation = Number.MAX_SAFE_INTEGER / 100;

    expect(positive.capitalRecoveredRate).toBe(saturation);
    expect(positive.laborCoverageRate).toBe(saturation);
    expect(negative.marginPercent).toBe(-saturation);
    expect(negative.capitalRecoveredRate).toBe(-saturation);
    expect(Number.isFinite(positive.capitalRecoveredRate)).toBe(true);
    expect(Number.isFinite(negative.marginPercent)).toBe(true);
  });

  it("exposes a deeply readonly snapshot contract", () => {
    expectTypeOf<ProjectAnalyticsSnapshot>().toEqualTypeOf<
      Readonly<ProjectAnalyticsSnapshot>
    >();
    expectTypeOf<ProjectMonthlyTrendPoint>().toEqualTypeOf<
      Readonly<ProjectMonthlyTrendPoint>
    >();
    expectTypeOf<ProjectExpenseCategoryMix>().toEqualTypeOf<
      Readonly<ProjectExpenseCategoryMix>
    >();
    expectTypeOf<ProjectAnalyticsAchievement>().toEqualTypeOf<
      Readonly<ProjectAnalyticsAchievement>
    >();
    expectTypeOf<ProjectAnalyticsSetupStep>().toEqualTypeOf<
      Readonly<ProjectAnalyticsSetupStep>
    >();
    expectTypeOf<ProjectAnalyticsSnapshot["monthlyTrend"]>().toEqualTypeOf<
      ReadonlyArray<ProjectMonthlyTrendPoint>
    >();
    expectTypeOf<ProjectAnalyticsSnapshot["insights"]>().toEqualTypeOf<
      ReadonlyArray<string>
    >();
  });
});
