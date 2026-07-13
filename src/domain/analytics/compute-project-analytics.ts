import type { FinanceTransaction } from "@/domain/finance/finance-state";
import {
  PROJECT_BLUEPRINTS,
  getProjectBlueprint,
} from "@/features/projects/project-blueprints";
import type {
  ProjectSetupStep,
  ProjectSetupStepId,
  ProjectSummary,
} from "@/features/workspace/workspace-types";

export type ProjectAnalyticsConfidence = "low" | "medium" | "high";
export type ProjectHealthLabel =
  | "ممتاز"
  | "جيد"
  | "يحتاج تحسين"
  | "حرج"
  | "غير متاح";

export interface ProjectMonthlyTrendPoint {
  readonly monthKey: string;
  readonly month: string;
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
}

export interface ProjectExpenseCategoryMix {
  readonly name: string;
  readonly amountMinor: bigint;
  readonly percent: number;
}

export type ProjectAnalyticsAchievementId =
  | "capital_recovered"
  | "first_profitable_month"
  | "labor_covered"
  | "goal_reached";

export interface ProjectAnalyticsAchievement {
  readonly id: ProjectAnalyticsAchievementId;
  readonly title: string;
  readonly detail: string;
}

export type ProjectAnalyticsSetupStepId =
  | "project_basics"
  | ProjectSetupStepId;

export type ProjectAnalyticsSetupAction =
  | "configure_goal"
  | "record_capital"
  | "add_worker"
  | "add_inventory_item";

export interface ProjectAnalyticsSetupStep {
  readonly id: ProjectAnalyticsSetupStepId;
  readonly title: string;
  readonly detail: string;
  readonly completed: boolean;
  readonly route?: string;
  readonly action?: ProjectAnalyticsSetupAction;
}

export interface ComputeProjectAnalyticsInput {
  readonly project: ProjectSummary;
  readonly transactions: readonly FinanceTransaction[];
  readonly categoryNames?: ReadonlyMap<string, string>;
  readonly now?: Date;
  readonly timeZone?: string;
  readonly months?: number;
}

export interface ProjectAnalyticsSnapshot {
  readonly projectId: string;
  readonly transactionCount: number;
  readonly dataPoints: number;
  readonly confidence: ProjectAnalyticsConfidence;
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
  readonly cashProfitMinor: bigint;
  readonly outstandingLaborMinor: bigint;
  readonly profitAfterLaborMinor: bigint;
  readonly marginPercent: number | null;
  readonly capitalMinor: bigint | null;
  readonly capitalRecoveredRate: number | null;
  /** ROI: (profit after labor ÷ capital) × 100 when capital module applies. */
  readonly returnOnCapitalRate: number | null;
  /**
   * An estimate based on positive cumulative project cash profit divided by
   * current outstanding worker liability. It is not a wallet-liquidity claim.
   */
  readonly laborCoverageRate: number | null;
  readonly inventoryValueMinor: bigint | null;
  readonly inventoryItemCount: number | null;
  readonly lastActivityAt: string | null;
  readonly daysSinceActivity: number | null;
  readonly monthlyTrend: ReadonlyArray<ProjectMonthlyTrendPoint>;
  readonly categoryMix: ReadonlyArray<ProjectExpenseCategoryMix>;
  readonly topExpenseCategory: ProjectExpenseCategoryMix | null;
  readonly healthScore: number | null;
  readonly healthLabel: ProjectHealthLabel;
  readonly insights: ReadonlyArray<string>;
  readonly achievements: ReadonlyArray<ProjectAnalyticsAchievement>;
  readonly setupSteps: ReadonlyArray<ProjectAnalyticsSetupStep>;
  readonly setupProgress: number;
  readonly setupComplete: boolean;
}

/**
 * Each component is scored from 0–100. Optional component weights are omitted
 * when their module/data is unavailable, then the remaining weights are
 * normalized so disabled modules never lower the project score.
 */
export const PROJECT_HEALTH_WEIGHTS = Object.freeze({
  profitMargin: 40,
  capitalRecovery: 25,
  laborCoverage: 20,
  activityRecency: 15,
});

/**
 * Margin maps linearly from -20% to 0 points and 40% to 100 points. Activity
 * receives full points through day 7 and decays linearly to zero on day 30.
 */
export const PROJECT_HEALTH_FORMULA = Object.freeze({
  minimumDataPoints: 3,
  marginFloorPercent: -20,
  marginCeilingPercent: 40,
  recencyFullScoreDays: 7,
  recencyZeroScoreDays: 30,
});

export const DEFAULT_PROJECT_ANALYTICS_MONTHS = 6;
export const DEFAULT_PROJECT_ANALYTICS_TIME_ZONE = "Africa/Tripoli";

const MAX_PROJECT_ANALYTICS_MONTHS = 24;
const MILLISECONDS_PER_DAY = 86_400_000;
const PERCENT_HUNDREDTHS_FACTOR = 10_000n;
const SCORE_HUNDREDTHS_FACTOR = 10_000n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const STRICT_ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;
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
] as const;

const SETUP_STEP_ORDER = [
  "first_transaction",
  "set_goal",
  "opening_capital",
  "first_worker",
  "first_inventory_item",
] as const satisfies readonly ProjectSetupStepId[];

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface ParsedProjectTransaction {
  transaction: FinanceTransaction;
  occurredAt: Date;
  dateParts: DateParts;
  monthKey: string;
}

interface MonthBucket {
  year: number;
  month: number;
  incomeMinor: bigint;
  expenseMinor: bigint;
}

interface HealthComponent {
  scoreHundredths: bigint;
  weight: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeMonths(months: number | undefined): number {
  if (months === undefined || !Number.isFinite(months)) {
    return DEFAULT_PROJECT_ANALYTICS_MONTHS;
  }
  return clamp(Math.floor(months), 1, MAX_PROJECT_ANALYTICS_MONTHS);
}

function normalizeTimeZone(timeZone: string | undefined): string {
  const candidate = timeZone?.trim() || DEFAULT_PROJECT_ANALYTICS_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return DEFAULT_PROJECT_ANALYTICS_TIME_ZONE;
  }
}

function normalizeNow(now: Date | undefined): Date {
  if (now === undefined) return new Date();
  if (Number.isNaN(now.getTime())) {
    throw new Error("computeProjectAnalytics: now must be a valid Date");
  }
  return new Date(now.getTime());
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function parseStrictIsoTimestamp(value: string): Date | null {
  const match = STRICT_ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const zone = match[8];
  const offsetHour = zone === "Z" ? 0 : Number(match[10]);
  const offsetMinute = zone === "Z" ? 0 : Number(match[11]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInGregorianMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }

  const fractionalSeconds = match[7];
  const millisecondFraction = fractionalSeconds
    ? `.${fractionalSeconds.padEnd(3, "0").slice(0, 3)}`
    : "";
  const normalizedTimestamp = [
    `${match[1]}-${match[2]}-${match[3]}`,
    `T${match[4]}:${match[5]}:${match[6]}`,
    millisecondFraction,
    zone,
  ].join("");
  const timestamp = Date.parse(normalizedTimestamp);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function getDateParts(date: Date, timeZone: string): DateParts {
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
}

function monthKeyFromParts(year: number, month: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function monthIndex(parts: Pick<DateParts, "year" | "month">): number {
  return parts.year * 12 + parts.month - 1;
}

function shiftMonth(
  year: number,
  month: number,
  offset: number,
): Pick<DateParts, "year" | "month"> {
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

function localDayOrdinal(parts: DateParts): number {
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / MILLISECONDS_PER_DAY,
  );
}

function toSafePercent(numerator: bigint, denominator: bigint): number | null {
  if (denominator <= 0n) return null;
  const scaled = (numerator * PERCENT_HUNDREDTHS_FACTOR) / denominator;
  if (scaled > MAX_SAFE_BIGINT) return Number.MAX_SAFE_INTEGER / 100;
  if (scaled < -MAX_SAFE_BIGINT) return -Number.MAX_SAFE_INTEGER / 100;
  return Number(scaled) / 100;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function ratioScoreHundredths(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (numerator <= 0n || denominator <= 0n) return 0n;
  if (numerator >= denominator) return SCORE_HUNDREDTHS_FACTOR;
  return (numerator * SCORE_HUNDREDTHS_FACTOR) / denominator;
}

function marginScoreHundredths(
  profitAfterLaborMinor: bigint,
  incomeMinor: bigint,
): bigint {
  if (incomeMinor <= 0n) return 0n;
  const marginHundredths =
    (profitAfterLaborMinor * PERCENT_HUNDREDTHS_FACTOR) / incomeMinor;
  const floorHundredths =
    BigInt(PROJECT_HEALTH_FORMULA.marginFloorPercent) * 100n;
  const ceilingHundredths =
    BigInt(PROJECT_HEALTH_FORMULA.marginCeilingPercent) * 100n;
  if (marginHundredths <= floorHundredths) return 0n;
  if (marginHundredths >= ceilingHundredths) {
    return SCORE_HUNDREDTHS_FACTOR;
  }
  return (
    ((marginHundredths - floorHundredths) * SCORE_HUNDREDTHS_FACTOR) /
    (ceilingHundredths - floorHundredths)
  );
}

function activityScoreHundredths(daysSinceActivity: number | null): bigint {
  if (daysSinceActivity === null) return 0n;
  if (daysSinceActivity <= PROJECT_HEALTH_FORMULA.recencyFullScoreDays) {
    return SCORE_HUNDREDTHS_FACTOR;
  }
  if (daysSinceActivity >= PROJECT_HEALTH_FORMULA.recencyZeroScoreDays) {
    return 0n;
  }
  const remainingDays =
    PROJECT_HEALTH_FORMULA.recencyZeroScoreDays - daysSinceActivity;
  const decayDays =
    PROJECT_HEALTH_FORMULA.recencyZeroScoreDays -
    PROJECT_HEALTH_FORMULA.recencyFullScoreDays;
  return (
    (BigInt(remainingDays) * SCORE_HUNDREDTHS_FACTOR) / BigInt(decayDays)
  );
}

function calculateHealthScore(
  dataPoints: number,
  profitAfterLaborMinor: bigint,
  incomeMinor: bigint,
  capitalMinor: bigint | null,
  cashProfitMinor: bigint,
  laborLiabilityMinor: bigint | null,
  daysSinceActivity: number | null,
): number | null {
  if (dataPoints < PROJECT_HEALTH_FORMULA.minimumDataPoints) return null;

  const components: HealthComponent[] = [
    {
      scoreHundredths: marginScoreHundredths(
        profitAfterLaborMinor,
        incomeMinor,
      ),
      weight: PROJECT_HEALTH_WEIGHTS.profitMargin,
    },
    {
      scoreHundredths: activityScoreHundredths(daysSinceActivity),
      weight: PROJECT_HEALTH_WEIGHTS.activityRecency,
    },
  ];
  if (capitalMinor !== null) {
    components.push({
      scoreHundredths: ratioScoreHundredths(
        profitAfterLaborMinor,
        capitalMinor,
      ),
      weight: PROJECT_HEALTH_WEIGHTS.capitalRecovery,
    });
  }
  if (laborLiabilityMinor !== null) {
    components.push({
      scoreHundredths: ratioScoreHundredths(
        cashProfitMinor,
        laborLiabilityMinor,
      ),
      weight: PROJECT_HEALTH_WEIGHTS.laborCoverage,
    });
  }

  const totalWeight = components.reduce(
    (total, component) => total + BigInt(component.weight),
    0n,
  );
  const weightedScore = components.reduce(
    (total, component) =>
      total + component.scoreHundredths * BigInt(component.weight),
    0n,
  );
  const roundingDenominator = totalWeight * 100n;
  return Number(
    (weightedScore + roundingDenominator / 2n) / roundingDenominator,
  );
}

function getHealthLabel(score: number | null): ProjectHealthLabel {
  if (score === null) return "غير متاح";
  if (score >= 80) return "ممتاز";
  if (score >= 65) return "جيد";
  if (score >= 45) return "يحتاج تحسين";
  return "حرج";
}

function getSetupStepMetadata(
  project: ProjectSummary,
  id: ProjectSetupStepId,
): ProjectSetupStep {
  const projectBlueprint = getProjectBlueprint(project.projectType);
  const ownStep = projectBlueprint.setupSteps.find((step) => step.id === id);
  if (ownStep) return ownStep;

  for (const blueprint of Object.values(PROJECT_BLUEPRINTS)) {
    const step = blueprint.setupSteps.find((candidate) => candidate.id === id);
    if (step) return step;
  }
  throw new Error(`Missing project setup metadata for ${id}`);
}

function isSetupStepComplete(
  id: ProjectSetupStepId,
  project: ProjectSummary,
  dataPoints: number,
): boolean {
  switch (id) {
    case "first_transaction":
      return dataPoints > 0;
    case "set_goal":
      return project.goalMinor !== undefined && project.goalMinor > 0n;
    case "opening_capital":
      return project.capitalMinor > 0n;
    case "first_worker":
      return project.activeWorkers > 0;
    case "first_inventory_item":
      return project.inventoryItemCount > 0;
  }
}

function getSetupAction(
  id: ProjectSetupStepId,
): ProjectAnalyticsSetupAction | undefined {
  switch (id) {
    case "first_transaction":
      return undefined;
    case "set_goal":
      return "configure_goal";
    case "opening_capital":
      return "record_capital";
    case "first_worker":
      return "add_worker";
    case "first_inventory_item":
      return "add_inventory_item";
  }
}

function buildSetupJourney(
  project: ProjectSummary,
  dataPoints: number,
): Pick<
  ProjectAnalyticsSnapshot,
  "setupSteps" | "setupProgress" | "setupComplete"
> {
  const encodedProjectId = encodeURIComponent(project.id);
  const setupSteps: ProjectAnalyticsSetupStep[] = [
    {
      id: "project_basics",
      title: "أساسيات المشروع",
      detail: "تم إنشاء المشروع وتحديد اسمه ونوعه.",
      completed: true,
      route: `/projects/${encodedProjectId}`,
    },
  ];

  for (const id of SETUP_STEP_ORDER) {
    const metadata = getSetupStepMetadata(project, id);
    if (
      id !== "first_transaction" &&
      !project.modules[metadata.module]
    ) {
      continue;
    }
    const action = getSetupAction(id);
    setupSteps.push({
      id,
      title: metadata.title,
      detail: metadata.description,
      completed: isSetupStepComplete(id, project, dataPoints),
      ...(id === "first_transaction"
        ? { route: `/transactions/new?project=${encodedProjectId}` }
        : action
          ? { action }
          : {}),
    });
  }

  const completedCount = setupSteps.filter((step) => step.completed).length;
  const setupProgress = Math.round(
    (completedCount * 100) / setupSteps.length,
  );
  return {
    setupSteps,
    setupProgress,
    setupComplete: completedCount === setupSteps.length,
  };
}

export function computeProjectAnalytics(
  input: ComputeProjectAnalyticsInput,
): ProjectAnalyticsSnapshot {
  const now = normalizeNow(input.now);
  const timeZone = normalizeTimeZone(input.timeZone);
  const months = normalizeMonths(input.months);
  const nowParts = getDateParts(now, timeZone);
  const currentMonthKey = monthKeyFromParts(nowParts.year, nowParts.month);
  const nowMonthIndex = monthIndex(nowParts);
  const parsedTransactions: ParsedProjectTransaction[] = [];

  for (const candidate of input.transactions) {
    if (
      candidate.projectId !== input.project.id ||
      candidate.kind === "transfer"
    ) {
      continue;
    }
    const occurredAt = parseStrictIsoTimestamp(candidate.occurredAt);
    if (
      occurredAt === null ||
      occurredAt.getTime() > now.getTime()
    ) {
      continue;
    }
    const dateParts = getDateParts(occurredAt, timeZone);
    parsedTransactions.push({
      transaction: candidate,
      occurredAt,
      dateParts,
      monthKey: monthKeyFromParts(dateParts.year, dateParts.month),
    });
  }

  let incomeMinor = 0n;
  let expenseMinor = 0n;
  let lastActivity: ParsedProjectTransaction | null = null;
  const historicalBuckets = new Map<string, MonthBucket>();
  for (const parsed of parsedTransactions) {
    if (parsed.transaction.kind === "income") {
      incomeMinor += parsed.transaction.amountMinor;
    } else if (parsed.transaction.kind === "expense") {
      expenseMinor += parsed.transaction.amountMinor;
    }
    if (
      lastActivity === null ||
      parsed.occurredAt.getTime() > lastActivity.occurredAt.getTime()
    ) {
      lastActivity = parsed;
    }
    const bucket = historicalBuckets.get(parsed.monthKey) ?? {
      year: parsed.dateParts.year,
      month: parsed.dateParts.month,
      incomeMinor: 0n,
      expenseMinor: 0n,
    };
    if (parsed.transaction.kind === "income") {
      bucket.incomeMinor += parsed.transaction.amountMinor;
    } else if (parsed.transaction.kind === "expense") {
      bucket.expenseMinor += parsed.transaction.amountMinor;
    }
    historicalBuckets.set(parsed.monthKey, bucket);
  }

  const cashProfitMinor = incomeMinor - expenseMinor;
  const outstandingLaborMinor =
    input.project.modules.workers &&
    input.project.outstandingLaborMinor > 0n
      ? input.project.outstandingLaborMinor
      : 0n;
  const profitAfterLaborMinor =
    cashProfitMinor - outstandingLaborMinor;
  const marginPercent =
    incomeMinor > 0n
      ? toSafePercent(profitAfterLaborMinor, incomeMinor)
      : null;
  const applicableCapitalMinor =
    input.project.modules.capital && input.project.capitalMinor > 0n
      ? input.project.capitalMinor
      : null;
  const applicableLaborLiabilityMinor =
    input.project.modules.workers && outstandingLaborMinor > 0n
      ? outstandingLaborMinor
      : null;
  const hasLaborLiability = applicableLaborLiabilityMinor !== null;
  const recoveryProfitMinor = input.project.modules.workers
    ? profitAfterLaborMinor
    : cashProfitMinor;
  const capitalRecoveredRate =
    applicableCapitalMinor === null
      ? null
      : toSafePercent(recoveryProfitMinor, applicableCapitalMinor);
  const returnOnCapitalRate =
    applicableCapitalMinor === null
      ? null
      : toSafePercent(profitAfterLaborMinor, applicableCapitalMinor);
  const laborCoverageRate =
    applicableLaborLiabilityMinor === null
      ? null
      : toSafePercent(
          cashProfitMinor > 0n ? cashProfitMinor : 0n,
          applicableLaborLiabilityMinor,
        );
  const lastActivityAt = lastActivity
    ? lastActivity.occurredAt.toISOString()
    : null;
  const daysSinceActivity = lastActivity
    ? Math.max(
        0,
        localDayOrdinal(nowParts) -
          localDayOrdinal(lastActivity.dateParts),
      )
    : null;

  const trendBuckets = new Map<string, MonthBucket>();
  for (let index = 0; index < months; index += 1) {
    const shifted = shiftMonth(
      nowParts.year,
      nowParts.month,
      -(months - 1 - index),
    );
    trendBuckets.set(monthKeyFromParts(shifted.year, shifted.month), {
      year: shifted.year,
      month: shifted.month,
      incomeMinor: 0n,
      expenseMinor: 0n,
    });
  }
  for (const parsed of parsedTransactions) {
    const bucket = trendBuckets.get(parsed.monthKey);
    if (!bucket) continue;
    if (parsed.transaction.kind === "income") {
      bucket.incomeMinor += parsed.transaction.amountMinor;
    } else if (parsed.transaction.kind === "expense") {
      bucket.expenseMinor += parsed.transaction.amountMinor;
    }
  }
  const monthlyTrend = [...trendBuckets.values()].map((bucket) => ({
    monthKey: monthKeyFromParts(bucket.year, bucket.month),
    month: `${MONTH_NAMES[bucket.month - 1] ?? monthKeyFromParts(
      bucket.year,
      bucket.month,
    )} ${bucket.year}`,
    incomeMinor: bucket.incomeMinor,
    expenseMinor: bucket.expenseMinor,
  }));

  const currentExpenseTotals = new Map<string, bigint>();
  let currentMonthExpenseMinor = 0n;
  for (const parsed of parsedTransactions) {
    if (
      parsed.monthKey !== currentMonthKey ||
      parsed.transaction.kind !== "expense"
    ) {
      continue;
    }
    currentMonthExpenseMinor += parsed.transaction.amountMinor;
    const configuredName = parsed.transaction.categoryId
      ? input.categoryNames?.get(parsed.transaction.categoryId)?.trim()
      : undefined;
    const name = configuredName || "أخرى";
    currentExpenseTotals.set(
      name,
      (currentExpenseTotals.get(name) ?? 0n) +
        parsed.transaction.amountMinor,
    );
  }
  const categoryMix = [...currentExpenseTotals.entries()]
    .map(([name, amountMinor]) => ({
      name,
      amountMinor,
      percent:
        toSafePercent(amountMinor, currentMonthExpenseMinor) ?? 0,
    }))
    .sort((left, right) => {
      if (left.amountMinor !== right.amountMinor) {
        return left.amountMinor > right.amountMinor ? -1 : 1;
      }
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
    });
  const topExpenseCategory = categoryMix[0] ?? null;

  const dataPoints = parsedTransactions.length;
  const activeMonths = historicalBuckets.size;
  const confidence: ProjectAnalyticsConfidence =
    dataPoints >= 30 && activeMonths >= 3
      ? "high"
      : dataPoints >= 10 && activeMonths >= 2
        ? "medium"
        : "low";
  const healthScore = calculateHealthScore(
    dataPoints,
    profitAfterLaborMinor,
    incomeMinor,
    applicableCapitalMinor,
    cashProfitMinor,
    applicableLaborLiabilityMinor,
    daysSinceActivity,
  );
  const healthLabel = getHealthLabel(healthScore);

  const achievements: ProjectAnalyticsAchievement[] = [];
  if (
    applicableCapitalMinor !== null &&
    profitAfterLaborMinor >= applicableCapitalMinor
  ) {
    achievements.push({
      id: "capital_recovered",
      title: "استرداد رأس المال",
      detail: hasLaborLiability
        ? "غطّى صافي المشروع بعد مستحقات العمال كامل رأس المال المسجّل."
        : "غطّى الربح كامل رأس المال المسجّل.",
    });
  }
  const hasProfitableCompletedMonth = [...historicalBuckets.values()].some(
    (bucket) =>
      monthIndex(bucket) < nowMonthIndex &&
      bucket.incomeMinor - bucket.expenseMinor > 0n,
  );
  if (hasProfitableCompletedMonth) {
    achievements.push({
      id: "first_profitable_month",
      title: "أول شهر رابح",
      detail: "حقق المشروع صافيًا موجبًا في شهر مكتمل واحد على الأقل.",
    });
  }
  if (
    applicableLaborLiabilityMinor !== null &&
    cashProfitMinor >= applicableLaborLiabilityMinor
  ) {
    achievements.push({
      id: "labor_covered",
      title: "مستحقات العمال مغطاة",
      detail:
        "الربح النقدي الموجب يقدّر تغطية كامل مستحقات العمال الحالية.",
    });
  }
  if (
    input.project.modules.goal &&
    input.project.goalMinor !== undefined &&
    input.project.goalMinor > 0n &&
    incomeMinor >= input.project.goalMinor
  ) {
    achievements.push({
      id: "goal_reached",
      title: "تحقق هدف الإيرادات",
      detail: "بلغ الدخل التراكمي هدف الإيرادات المحدد للمشروع.",
    });
  }

  const insights: string[] = [];
  if (confidence === "low") {
    insights.push(
      `ثقة التحليل منخفضة لأنها مبنية على ${dataPoints} حركات فقط.`,
    );
  }
  if (applicableCapitalMinor !== null && capitalRecoveredRate !== null) {
    if (profitAfterLaborMinor >= applicableCapitalMinor) {
      insights.push(
        hasLaborLiability
          ? "استُرد رأس المال بالكامل وفق الربح بعد احتساب مستحقات العمال."
          : "استُرد رأس المال بالكامل وفق الربح.",
      );
    } else {
      const progress = clamp(capitalRecoveredRate, 0, 100);
      insights.push(
        hasLaborLiability
          ? `تقدّم استرداد رأس المال عند ${formatPercent(progress)}% وفق الربح بعد احتساب مستحقات العمال.`
          : `تقدّم استرداد رأس المال عند ${formatPercent(progress)}% وفق الربح.`,
      );
    }
  }
  if (topExpenseCategory && topExpenseCategory.percent >= 35) {
    insights.push(
      `${topExpenseCategory.name} يمثل ${formatPercent(topExpenseCategory.percent)}% من مصروفات الشهر الحالي.`,
    );
  }
  if (
    laborCoverageRate !== null &&
    laborCoverageRate < 100
  ) {
    insights.push(
      `الربح النقدي الموجب يوفّر تغطية تقديرية بنسبة ${formatPercent(laborCoverageRate)}% من مستحقات العمال؛ المتبقي غير مغطى.`,
    );
  }
  if (
    daysSinceActivity !== null &&
    daysSinceActivity > PROJECT_HEALTH_FORMULA.recencyZeroScoreDays
  ) {
    insights.push(
      `لم تُسجّل حركة للمشروع منذ ${daysSinceActivity} يومًا؛ راجع نشاطه قبل بناء توقعات جديدة.`,
    );
  }
  if (
    profitAfterLaborMinor > 0n &&
    marginPercent !== null &&
    marginPercent > 0
  ) {
    insights.push(
      hasLaborLiability
        ? `إشارة إيجابية: المشروع يحقق صافيًا موجبًا بعد مستحقات العمال بهامش ${formatPercent(marginPercent)}%.`
        : `إشارة إيجابية: الربح موجب بهامش ${formatPercent(marginPercent)}%.`,
    );
  }

  const setupJourney = buildSetupJourney(input.project, dataPoints);
  return {
    projectId: input.project.id,
    transactionCount: dataPoints,
    dataPoints,
    confidence,
    incomeMinor,
    expenseMinor,
    cashProfitMinor,
    outstandingLaborMinor,
    profitAfterLaborMinor,
    marginPercent,
    capitalMinor: input.project.modules.capital
      ? input.project.capitalMinor
      : null,
    capitalRecoveredRate,
    returnOnCapitalRate,
    laborCoverageRate,
    inventoryValueMinor: input.project.modules.inventory
      ? input.project.inventoryValueMinor
      : null,
    inventoryItemCount: input.project.modules.inventory
      ? input.project.inventoryItemCount
      : null,
    lastActivityAt,
    daysSinceActivity,
    monthlyTrend,
    categoryMix,
    topExpenseCategory,
    healthScore,
    healthLabel,
    insights: insights.slice(0, 4),
    achievements,
    ...setupJourney,
  };
}
