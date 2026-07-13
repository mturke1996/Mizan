import { formatMinorAmount } from "@/domain/money/money";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import type { ProjectSummary } from "@/features/workspace/workspace-types";

export type ProjectSummaryPeriod = "day" | "week";

export interface ProjectOpsSummaryInput {
  readonly analytics: ProjectAnalyticsSnapshot;
  readonly currency: string;
  readonly period: ProjectSummaryPeriod;
  readonly project: ProjectSummary;
  readonly periodIncomeMinor: bigint;
  readonly periodExpenseMinor: bigint;
}

export function buildProjectWhatsAppSummary(
  input: ProjectOpsSummaryInput,
): string {
  const periodLabel = input.period === "day" ? "اليوم" : "هذا الأسبوع";
  const formatMoney = (value: bigint) =>
    formatMinorAmount(value, {
      currency: input.currency,
      locale: "en-US",
    });
  const profit = input.periodIncomeMinor - input.periodExpenseMinor;
  const lines = [
    `📊 ملخص مشروع «${input.project.name}» — ${periodLabel}`,
    "",
    `الدخل: ${formatMoney(input.periodIncomeMinor)}`,
    `المصروف: ${formatMoney(input.periodExpenseMinor)}`,
    `الصافي: ${formatMoney(profit)}`,
  ];
  if (input.project.modules.workers) {
    lines.push(
      `مستحقات العمال: ${formatMoney(input.analytics.outstandingLaborMinor)}`,
    );
  }
  if (input.project.modules.capital && input.analytics.capitalMinor != null) {
    lines.push(
      `رأس المال: ${formatMoney(input.analytics.capitalMinor)}`,
      `استرداد رأس المال: ${
        input.analytics.capitalRecoveredRate == null
          ? "غير متاح"
          : `${input.analytics.capitalRecoveredRate.toFixed(1)}%`
      }`,
    );
  }
  lines.push("", "— من ميزان");
  return lines.join("\n");
}

export function sumPeriodTotals(
  transactions: ReadonlyArray<{
    kind: string;
    amountMinor: bigint;
    occurredAt: string;
  }>,
  projectId: string,
  fromIso: string,
): { incomeMinor: bigint; expenseMinor: bigint } {
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const transaction of transactions) {
    if (transaction.occurredAt < fromIso) continue;
    if (
      "projectId" in transaction &&
      (transaction as { projectId?: string }).projectId !== projectId
    ) {
      continue;
    }
    if (transaction.kind === "income") incomeMinor += transaction.amountMinor;
    if (transaction.kind === "expense") expenseMinor += transaction.amountMinor;
  }
  return { incomeMinor, expenseMinor };
}
