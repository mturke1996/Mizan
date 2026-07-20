import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { getCurrencyScale } from "@/domain/money/money";
import type { ProjectSummary } from "@/features/workspace/workspace-types";

export type AnalyticsConfidence = "low" | "medium" | "high";

/**
 * Sum expense totals per category id for the current calendar month in the
 * given timezone, restricted to the workspace currency. Used by the budgets
 * card to compare monthly spend against per-category limits. Only transactions
 * that carry a categoryId are counted; transfers are ignored.
 */
export function summarizeCurrentMonthByCategory(input: {
  transactions: FinanceTransaction[];
  currency?: string;
  timeZone?: string;
  now?: Date;
}): Map<string, bigint> {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? "Africa/Tripoli";
  const currentKey = monthKeyForDate(now, timeZone);
  const totals = new Map<string, bigint>();
  for (const tx of input.transactions) {
    if (tx.kind !== "expense") continue;
    if (input.currency && tx.currency !== input.currency) continue;
    if (!tx.categoryId) continue;
    const occurred = new Date(tx.occurredAt);
    if (Number.isNaN(occurred.getTime())) continue;
    if (monthKeyForDate(occurred, timeZone) !== currentKey) continue;
    totals.set(tx.categoryId, (totals.get(tx.categoryId) ?? 0n) + tx.amountMinor);
  }
  return totals;
}

export interface AnalyticsSnapshot {
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  savingsRate: number;
  burnRateDaily: number;
  runwayDays: number | null;
  expenseRatio: number | null;
  averageDailyExpense: number;
  projectedIncomeMinor: bigint;
  projectedExpenseMinor: bigint;
  projectedNetMinor: bigint;
  incomeTrendRate: number | null;
  expenseTrendRate: number | null;
  expenseVolatility: number | null;
  positiveMonthsRate: number | null;
  expenseConcentrationRate: number | null;
  profitableProjectsRate: number | null;
  laborLiabilityMinor: bigint;
  laborCoverageRate: number | null;
  healthScore: number | null;
  healthLabel: string;
  confidence: AnalyticsConfidence;
  dataPoints: number;
  monthlyTrend: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  categoryMix: Array<{
    name: string;
    amountMinor: bigint;
    percent: number;
  }>;
  categoryBreakdown: Array<{
    name: string;
    incomeMinor: bigint;
    expenseMinor: bigint;
    netMinor: bigint;
  }>;
  topProjects: Array<{
    id: string;
    name: string;
    profitMinor: bigint;
    cashProfitMinor: bigint;
    outstandingLaborMinor: bigint;
    margin: number;
  }>;
  achievements: Array<{
    id:
      | "saving"
      | "liquidity"
      | "consistency"
      | "labor"
      | "projects";
    title: string;
    detail: string;
  }>;
  insights: string[];
}

const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

function toMajor(amountMinor: bigint, scale = 3): number {
  const factor = 10 ** scale;
  return Number(amountMinor) / factor;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getDateParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-nu-latn", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const values = new Map(parts.map((part) => [part.type, part.value]));
    return {
      year: Number(values.get("year")),
      month: Number(values.get("month")),
      day: Number(values.get("day")),
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }
}

function monthKeyFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthKeyForDate(date: Date, timeZone: string): string {
  const parts = getDateParts(date, timeZone);
  return monthKeyFromParts(parts.year, parts.month);
}

function shiftMonth(
  year: number,
  month: number,
  offset: number,
): { year: number; month: number } {
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

function percentOf(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 10_000n) / total) / 100;
}

function percentChange(current: bigint, previous: bigint): number | null {
  if (previous <= 0n) return null;
  return Number(((current - previous) * 10_000n) / previous) / 100;
}

function standardDeviationPercent(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  if (mean <= 0) return null;
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
    values.length;
  return (Math.sqrt(variance) / mean) * 100;
}

export function computeAnalytics(input: {
  transactions: FinanceTransaction[];
  projects: ProjectSummary[];
  totalBalanceMinor: bigint;
  categoryNames?: Map<string, string>;
  months?: number;
  now?: Date;
  currency?: string;
  timeZone?: string;
}): AnalyticsSnapshot {
  const now = input.now ?? new Date();
  const months = clamp(Math.floor(input.months ?? 6), 2, 24);
  const timeZone = input.timeZone ?? "Africa/Tripoli";
  const currencyScale = getCurrencyScale(input.currency ?? "LYD");
  const nowParts = getDateParts(now, timeZone);
  const currentMonthKey = monthKeyFromParts(nowParts.year, nowParts.month);

  const buckets = new Map<string, { income: bigint; expense: bigint }>();
  for (let index = 0; index < months; index += 1) {
    const shifted = shiftMonth(
      nowParts.year,
      nowParts.month,
      -(months - 1 - index),
    );
    buckets.set(monthKeyFromParts(shifted.year, shifted.month), {
      income: 0n,
      expense: 0n,
    });
  }

  const periodTx = input.transactions.filter((transaction) => {
    if (input.currency && transaction.currency !== input.currency) return false;
    const occurred = new Date(transaction.occurredAt);
    if (Number.isNaN(occurred.getTime()) || occurred > now) return false;
    return buckets.has(monthKeyForDate(occurred, timeZone));
  });
  const currentMonthTx = periodTx.filter(
    (transaction) =>
      monthKeyForDate(new Date(transaction.occurredAt), timeZone) ===
      currentMonthKey,
  );

  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const tx of currentMonthTx) {
    if (tx.kind === "income") incomeMinor += tx.amountMinor;
    if (tx.kind === "expense") expenseMinor += tx.amountMinor;
  }

  const netMinor = incomeMinor - expenseMinor;
  const savingsRate = incomeMinor > 0n ? percentOf(netMinor, incomeMinor) : 0;
  const expenseRatio =
    incomeMinor > 0n ? percentOf(expenseMinor, incomeMinor) : null;

  const dayOfMonth = Math.max(nowParts.day, 1);
  const daysInMonth = new Date(
    Date.UTC(nowParts.year, nowParts.month, 0),
  ).getUTCDate();
  const averageDailyExpense =
    toMajor(expenseMinor, currencyScale) / dayOfMonth;
  const burnRateDaily = averageDailyExpense;
  const runwayDays =
    burnRateDaily > 0
      ? Math.max(
          0,
          Math.floor(
            toMajor(input.totalBalanceMinor, currencyScale) / burnRateDaily,
          ),
        )
      : null;

  for (const tx of periodTx) {
    const key = monthKeyForDate(new Date(tx.occurredAt), timeZone);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.kind === "income") bucket.income += tx.amountMinor;
    if (tx.kind === "expense") bucket.expense += tx.amountMinor;
  }

  const monthlyTrend = [...buckets.entries()].map(([key, value]) => {
    const monthIndex = Number(key.split("-")[1]) - 1;
    return {
      month: MONTH_NAMES[monthIndex] ?? key,
      income: Number(toMajor(value.income, currencyScale).toFixed(2)),
      expense: Number(toMajor(value.expense, currencyScale).toFixed(2)),
    };
  });

  const projectedIncomeMinor =
    (incomeMinor * BigInt(daysInMonth)) / BigInt(dayOfMonth);
  const projectedExpenseMinor =
    (expenseMinor * BigInt(daysInMonth)) / BigInt(dayOfMonth);
  const projectedNetMinor = projectedIncomeMinor - projectedExpenseMinor;
  const bucketValues = [...buckets.values()];
  const previousMonth = bucketValues.at(-2) ?? { income: 0n, expense: 0n };
  const incomeTrendRate = percentChange(
    projectedIncomeMinor,
    previousMonth.income,
  );
  const expenseTrendRate = percentChange(
    projectedExpenseMinor,
    previousMonth.expense,
  );
  const expenseVolatility = standardDeviationPercent(
    bucketValues
      .slice(0, -1)
      .map((bucket) => toMajor(bucket.expense, currencyScale)),
  );
  const completedActiveMonths = bucketValues
    .slice(0, -1)
    .filter((bucket) => bucket.income > 0n || bucket.expense > 0n);
  const positiveMonthsRate =
    completedActiveMonths.length > 0
      ? (completedActiveMonths.filter(
          (bucket) => bucket.income - bucket.expense > 0n,
        ).length /
          completedActiveMonths.length) *
        100
      : null;

  const categoryTotals = new Map<string, bigint>();
  const projectNames = new Map(
    input.projects.map((project) => [project.id, project.name]),
  );
  for (const tx of currentMonthTx) {
    if (tx.kind !== "expense") continue;
    const name =
      (tx.categoryId && input.categoryNames?.get(tx.categoryId)) ||
      (tx.projectId ? projectNames.get(tx.projectId) : null) ||
      "أخرى";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0n) + tx.amountMinor);
  }

  const categoryMix = [...categoryTotals.entries()]
    .map(([name, amountMinor]) => ({
      name,
      amountMinor,
      percent:
        expenseMinor > 0n
          ? Number(percentOf(amountMinor, expenseMinor).toFixed(1))
          : 0,
    }))
    .sort((a, b) =>
      a.amountMinor === b.amountMinor ? 0 : a.amountMinor > b.amountMinor ? -1 : 1,
    )
    .slice(0, 6);
  const expenseConcentrationRate = categoryMix[0]?.percent ?? null;

  // Period-wide category breakdown (income and expense per category) for the
  // selected window. Unlike categoryMix (current-month expense only), this
  // covers the whole selected period and both directions, so it works as a
  // proper category report and a base for budgets.
  const breakdownMap = new Map<string, { income: bigint; expense: bigint }>();
  for (const tx of periodTx) {
    if (tx.kind === "transfer" || tx.kind === "opening_balance") continue;
    const name =
      (tx.categoryId && input.categoryNames?.get(tx.categoryId)) ||
      (tx.projectId ? projectNames.get(tx.projectId) : null) ||
      "أخرى";
    const entry = breakdownMap.get(name) ?? { income: 0n, expense: 0n };
    if (tx.kind === "income") entry.income += tx.amountMinor;
    if (tx.kind === "expense") entry.expense += tx.amountMinor;
    breakdownMap.set(name, entry);
  }
  const categoryBreakdown = [...breakdownMap.entries()]
    .map(([name, entry]) => ({
      name,
      incomeMinor: entry.income,
      expenseMinor: entry.expense,
      netMinor: entry.income - entry.expense,
    }))
    .sort((a, b) => {
      const aTotal = a.incomeMinor + a.expenseMinor;
      const bTotal = b.incomeMinor + b.expenseMinor;
      return aTotal === bTotal ? 0 : aTotal > bTotal ? -1 : 1;
    });

  const activeProjectsWithActivity = input.projects.filter(
    (project) =>
      project.status === "active" &&
      (project.incomeMinor > 0n ||
        project.expenseMinor > 0n ||
        (project.modules.workers && project.outstandingLaborMinor > 0n)),
  );
  const profitableProjects = activeProjectsWithActivity.filter((project) => {
    const labor =
      project.modules.workers ? project.outstandingLaborMinor : 0n;
    return project.profitMinor - labor > 0n;
  });
  const profitableProjectsRate =
    activeProjectsWithActivity.length > 0
      ? (profitableProjects.length / activeProjectsWithActivity.length) * 100
      : null;
  const laborLiabilityMinor = input.projects.reduce((total, project) => {
    if (!project.modules.workers) return total;
    return total + project.outstandingLaborMinor;
  }, 0n);
  const laborCoverageRate =
    laborLiabilityMinor > 0n
      ? percentOf(
          input.totalBalanceMinor > 0n ? input.totalBalanceMinor : 0n,
          laborLiabilityMinor,
        )
      : null;

  const topProjects = [...input.projects]
    .filter((project) => project.status === "active")
    .map((project) => {
      const outstandingLaborMinor = project.modules.workers
        ? project.outstandingLaborMinor
        : 0n;
      const profitAfterLaborMinor = project.profitMinor - outstandingLaborMinor;
      return {
        id: project.id,
        name: project.name,
        profitMinor: profitAfterLaborMinor,
        cashProfitMinor: project.profitMinor,
        outstandingLaborMinor,
        margin:
          project.incomeMinor > 0n
            ? percentOf(profitAfterLaborMinor, project.incomeMinor)
            : 0,
      };
    })
    .sort((a, b) =>
      a.profitMinor === b.profitMinor ? 0 : a.profitMinor > b.profitMinor ? -1 : 1,
    )
    .slice(0, 5);

  const dataPoints = periodTx.filter(
    (transaction) =>
      transaction.kind !== "transfer" &&
      transaction.kind !== "opening_balance",
  ).length;
  const activeMonths = bucketValues.filter(
    (bucket) => bucket.income > 0n || bucket.expense > 0n,
  ).length;
  const confidence: AnalyticsConfidence =
    dataPoints >= 30 && activeMonths >= 3
      ? "high"
      : dataPoints >= 10 && activeMonths >= 2
        ? "medium"
        : "low";

  let healthScore: number | null = null;
  let healthLabel = "غير متاح";
  if (dataPoints >= 3 && incomeMinor > 0n && expenseMinor > 0n) {
    const savingsComponent =
      clamp((savingsRate + 20) / 60, 0, 1) * 40;
    const liquidityComponent =
      burnRateDaily === 0
        ? 35
        : clamp((runwayDays ?? 0) / 90, 0, 1) * 35;
    const concentrationComponent =
      expenseMinor === 0n
        ? 15
        : clamp((70 - (categoryMix[0]?.percent ?? 100)) / 50, 0, 1) * 15;
    const projectComponent =
      profitableProjectsRate == null ? 5 : (profitableProjectsRate / 100) * 10;
    healthScore = Math.round(
      savingsComponent +
        liquidityComponent +
        concentrationComponent +
        projectComponent,
    );
    healthLabel =
      healthScore >= 80
        ? "ممتاز"
        : healthScore >= 65
          ? "جيد"
          : healthScore >= 45
            ? "يحتاج تحسين"
            : "حرج";
  }

  const achievements: AnalyticsSnapshot["achievements"] = [];
  if (dataPoints >= 3 && incomeMinor > 0n && savingsRate >= 20) {
    achievements.push({
      id: "saving",
      title: "ادخار منضبط",
      detail: `احتفظت بـ ${savingsRate.toFixed(1)}% من دخل هذا الشهر.`,
    });
  }
  if (dataPoints >= 3 && runwayDays != null && runwayDays >= 60) {
    achievements.push({
      id: "liquidity",
      title: "هامش سيولة قوي",
      detail: `رصيدك يغطي نحو ${runwayDays} يومًا وفق وتيرة الإنفاق الحالية.`,
    });
  }
  if (
    completedActiveMonths.length >= 2 &&
    positiveMonthsRate != null &&
    positiveMonthsRate >= 75
  ) {
    achievements.push({
      id: "consistency",
      title: "تدفّق موجب مستمر",
      detail: `${positiveMonthsRate.toFixed(0)}% من الأشهر المكتملة النشطة حققت صافيًا موجبًا.`,
    });
  }
  if (
    laborLiabilityMinor > 0n &&
    laborCoverageRate != null &&
    laborCoverageRate >= 100
  ) {
    achievements.push({
      id: "labor",
      title: "مستحقات العمال مغطاة",
      detail: `السيولة تغطي ${laborCoverageRate.toFixed(0)}% من الأرصدة المستحقة.`,
    });
  }
  if (
    activeProjectsWithActivity.length >= 2 &&
    profitableProjectsRate != null &&
    profitableProjectsRate >= 75
  ) {
    achievements.push({
      id: "projects",
      title: "محفظة مشاريع رابحة",
      detail:
        laborLiabilityMinor > 0n
          ? `${profitableProjectsRate.toFixed(0)}% من مشاريعك النشطة رابحة بعد مستحقات العمال.`
          : `${profitableProjectsRate.toFixed(0)}% من مشاريعك النشطة رابحة.`,
    });
  }

  const insights: string[] = [];
  if (incomeMinor === 0n && expenseMinor === 0n) {
    insights.push("ابدأ بتسجيل دخل ومصروف هذا الشهر لبناء صورة مالية دقيقة.");
  } else {
    if (confidence === "low") {
      insights.push(
        `دقة الاستنتاجات أولية حاليًا لأنها مبنية على ${dataPoints} حركة فقط.`,
      );
    }

    if (savingsRate >= 40) {
      insights.push(
        `معدل ادخار ممتاز هذا الشهر (${savingsRate.toFixed(1)}%). حافظ على نفس الإيقاع.`,
      );
    } else if (savingsRate >= 20) {
      insights.push(
        `ادخارك عند ${savingsRate.toFixed(1)}%، وهو مستوى جيد. خفض أكبر بند مصروف قد يرفعه أكثر.`,
      );
    } else if (incomeMinor > 0n) {
      insights.push(
        `معدل الادخار منخفض (${savingsRate.toFixed(1)}%). راجع المصروفات غير الضرورية.`,
      );
    }

    if (runwayDays != null && runwayDays < 30 && burnRateDaily > 0) {
      insights.push(
        `الرصيد يكفي لحوالي ${runwayDays} يومًا بمعدل الإنفاق الحالي. راقب السيولة.`,
      );
    } else if (runwayDays != null && runwayDays >= 90) {
      insights.push(
        `سيولتك قوية: الرصيد يغطي نحو ${runwayDays} يومًا من الإنفاق اليومي.`,
      );
    }

    const best = topProjects[0];
    if (best && best.profitMinor > 0n) {
      insights.push(
        laborLiabilityMinor > 0n
          ? `أقوى مشروع بعد احتساب أجور العمال المستحقة هو ${best.name} بهامش ${best.margin.toFixed(1)}%.`
          : `أقوى مشروع حاليًا هو ${best.name} بهامش ${best.margin.toFixed(1)}%.`,
      );
    }

    if (laborCoverageRate != null && laborCoverageRate < 100) {
      insights.push(
        `السيولة الحالية تغطي ${laborCoverageRate.toFixed(0)}% من أرصدة العمال المستحقة.`,
      );
    }

    if (expenseVolatility != null && expenseVolatility >= 40) {
      insights.push(
        `الإنفاق متذبذب بنسبة ${expenseVolatility.toFixed(0)}% بين الأشهر، لذا اجعل التوقعات أكثر تحفظًا.`,
      );
    }

    if (categoryMix[0] && categoryMix[0].percent >= 35) {
      insights.push(
        `${categoryMix[0].name} يستحوذ على ${categoryMix[0].percent}% من مصروف الشهر.`,
      );
    }
  }

  return {
    incomeMinor,
    expenseMinor,
    netMinor,
    savingsRate,
    burnRateDaily,
    runwayDays,
    expenseRatio,
    averageDailyExpense,
    projectedIncomeMinor,
    projectedExpenseMinor,
    projectedNetMinor,
    incomeTrendRate,
    expenseTrendRate,
    expenseVolatility,
    positiveMonthsRate,
    expenseConcentrationRate,
    profitableProjectsRate,
    laborLiabilityMinor,
    laborCoverageRate,
    healthScore,
    healthLabel,
    confidence,
    dataPoints,
    monthlyTrend,
    categoryMix,
    categoryBreakdown,
    topProjects,
    achievements,
    insights: insights.slice(0, 5),
  };
}
