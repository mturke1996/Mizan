import type { FinanceTransaction } from "@/domain/finance/finance-state";
import type {
  Invoice,
  ProjectSummary,
} from "@/features/workspace/workspace-types";

export interface PeriodPnL {
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
  byCategory: Array<{
    categoryId: string | null;
    name: string;
    incomeMinor: bigint;
    expenseMinor: bigint;
  }>;
}

export interface CashFlowMonth {
  monthKey: string;
  incomeMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

export interface AgingBucket {
  label: string;
  count: number;
  amountMinor: bigint;
}

export interface ProjectProfitRow {
  projectId: string;
  name: string;
  incomeMinor: bigint;
  expenseMinor: bigint;
  profitMinor: bigint;
  outstandingLaborMinor: bigint;
}

function monthKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

function inRange(iso: string, from: Date, to: Date): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return date >= from && date <= to;
}

export function computePeriodPnL(input: {
  transactions: FinanceTransaction[];
  currency: string;
  from: Date;
  to: Date;
  categoryNames?: Map<string, string>;
}): PeriodPnL {
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  const map = new Map<
    string,
    { incomeMinor: bigint; expenseMinor: bigint }
  >();

  for (const tx of input.transactions) {
    if (tx.currency !== input.currency) continue;
    if (tx.kind === "transfer") continue;
    if (!inRange(tx.occurredAt, input.from, input.to)) continue;
    const key = tx.categoryId ?? "__none__";
    const row = map.get(key) ?? { incomeMinor: 0n, expenseMinor: 0n };
    if (tx.kind === "income") {
      incomeMinor += tx.amountMinor;
      row.incomeMinor += tx.amountMinor;
    } else {
      expenseMinor += tx.amountMinor;
      row.expenseMinor += tx.amountMinor;
    }
    map.set(key, row);
  }

  const byCategory = [...map.entries()]
    .map(([categoryId, amounts]) => ({
      categoryId: categoryId === "__none__" ? null : categoryId,
      name:
        categoryId === "__none__"
          ? "بدون تصنيف"
          : (input.categoryNames?.get(categoryId) ?? "تصنيف"),
      ...amounts,
    }))
    .sort((a, b) => {
      const aTotal = a.incomeMinor + a.expenseMinor;
      const bTotal = b.incomeMinor + b.expenseMinor;
      return aTotal === bTotal ? 0 : aTotal > bTotal ? -1 : 1;
    });

  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
    byCategory,
  };
}

export function computeCashFlowMonths(input: {
  transactions: FinanceTransaction[];
  currency: string;
  timeZone?: string;
  months?: number;
  now?: Date;
}): CashFlowMonth[] {
  const timeZone = input.timeZone ?? "Africa/Tripoli";
  const now = input.now ?? new Date();
  const count = input.months ?? 6;
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const cursor = new Date(now);
    cursor.setUTCMonth(cursor.getUTCMonth() - i);
    keys.push(monthKey(cursor, timeZone));
  }
  const buckets = new Map(
    keys.map((key) => [
      key,
      { incomeMinor: 0n, expenseMinor: 0n },
    ]),
  );

  for (const tx of input.transactions) {
    if (tx.currency !== input.currency) continue;
    if (tx.kind === "transfer") continue;
    const key = monthKey(new Date(tx.occurredAt), timeZone);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (tx.kind === "income") bucket.incomeMinor += tx.amountMinor;
    else bucket.expenseMinor += tx.amountMinor;
  }

  return keys.map((monthKeyValue) => {
    const bucket = buckets.get(monthKeyValue)!;
    return {
      monthKey: monthKeyValue,
      incomeMinor: bucket.incomeMinor,
      expenseMinor: bucket.expenseMinor,
      netMinor: bucket.incomeMinor - bucket.expenseMinor,
    };
  });
}

export function computeInvoiceAging(input: {
  invoices: Invoice[];
  currency: string;
  now?: Date;
}): AgingBucket[] {
  const now = input.now ?? new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const buckets: AgingBucket[] = [
    { label: "حالي (0–30)", count: 0, amountMinor: 0n },
    { label: "31–60 يوم", count: 0, amountMinor: 0n },
    { label: "61–90 يوم", count: 0, amountMinor: 0n },
    { label: "+90 يوم", count: 0, amountMinor: 0n },
  ];

  for (const invoice of input.invoices) {
    if (invoice.currencyCode !== input.currency) continue;
    if (
      invoice.status !== "sent" &&
      invoice.status !== "partially_paid" &&
      invoice.status !== "overdue"
    ) {
      continue;
    }
    const remaining = invoice.totalMinor - invoice.paidMinor;
    if (remaining <= 0n) continue;
    const anchor = invoice.dueOn ?? invoice.issueOn;
    const due = new Date(`${anchor}T00:00:00Z`).getTime();
    const days = Math.max(0, Math.floor((today - due) / 86_400_000));
    const index = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
    buckets[index]!.count += 1;
    buckets[index]!.amountMinor += remaining;
  }

  return buckets;
}

export function computeProjectProfitRows(input: {
  projects: ProjectSummary[];
}): ProjectProfitRow[] {
  return input.projects
    .filter((project) => project.status === "active")
    .map((project) => ({
      projectId: project.id,
      name: project.name,
      incomeMinor: project.incomeMinor,
      expenseMinor: project.expenseMinor,
      profitMinor: project.incomeMinor - project.expenseMinor,
      outstandingLaborMinor: project.outstandingLaborMinor,
    }))
    .sort((a, b) =>
      a.profitMinor === b.profitMinor
        ? 0
        : a.profitMinor > b.profitMinor
          ? -1
          : 1,
    );
}
