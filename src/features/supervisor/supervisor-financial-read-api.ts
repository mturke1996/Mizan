import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";

export type FinancialResource =
  | "snapshot"
  | "wallets"
  | "transactions"
  | "projects"
  | "workers";

export interface CurrencyFinancialSnapshot {
  currencyCode: string;
  walletBalanceMinor: string;
  projectIncomeMinor: string;
  projectExpenseMinor: string;
  projectNetMinor: string;
  workerBalanceMinor: string;
}

export interface FinancialSnapshot {
  workspaceId: string;
  currencies: CurrencyFinancialSnapshot[];
}

export interface WalletReadRow {
  id: string;
  name: string;
  currencyCode: string;
  status: string;
  balanceMinor: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionReadRow {
  id: string;
  eventType: string;
  currencyCode: string;
  occurredAt: string;
  description: string | null;
  categoryId: string | null;
  projectId: string | null;
  reversalOfEventId: string | null;
  createdBy: string | null;
  sourceWalletId: string | null;
  destinationWalletId: string | null;
  amountMinor: string;
  createdAt: string;
}

export interface ProjectTotalsRead {
  currencyCode: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
}

export interface ProjectReadRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  totals: ProjectTotalsRead[];
}

export interface WorkerReadRow {
  workerId: string;
  projectId: string;
  name: string;
  phone: string | null;
  dailyWageMinor: string;
  status: string;
  balanceMinor: string;
  earnedMinor: string;
  withdrawnMinor: string;
  deductedMinor: string;
  workDays: number;
}

export interface PaginatedFinancialRows<T> {
  rows: T[];
  total: number;
}

function throwIf(error: { message?: string } | null, fallback: string): never {
  throw new Error(getUserErrorMessage(error, fallback));
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asMinorString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "0";
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mapCurrencyFinancialSnapshot(
  raw: unknown,
): CurrencyFinancialSnapshot {
  const row = asRecord(raw);
  return {
    currencyCode: asString(row.currency_code),
    walletBalanceMinor: asMinorString(row.wallet_balance_minor),
    projectIncomeMinor: asMinorString(row.project_income_minor),
    projectExpenseMinor: asMinorString(row.project_expense_minor),
    projectNetMinor: asMinorString(row.project_net_minor),
    workerBalanceMinor: asMinorString(row.worker_balance_minor),
  };
}

export function mapFinancialSnapshot(raw: unknown): FinancialSnapshot {
  const payload = asRecord(raw);
  const currencies = Array.isArray(payload.currencies)
    ? payload.currencies.map(mapCurrencyFinancialSnapshot)
    : [];
  return {
    workspaceId: asString(payload.workspace_id),
    currencies,
  };
}

export function mapWalletReadRow(raw: unknown): WalletReadRow {
  const row = asRecord(raw);
  return {
    id: asString(row.id),
    name: asString(row.name),
    currencyCode: asString(row.currency_code),
    status: asString(row.status),
    balanceMinor: asMinorString(row.balance_minor),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function mapTransactionReadRow(raw: unknown): TransactionReadRow {
  const row = asRecord(raw);
  return {
    id: asString(row.id),
    eventType: asString(row.event_type),
    currencyCode: asString(row.currency_code),
    occurredAt: asString(row.occurred_at),
    description: asNullableString(row.description),
    categoryId: asNullableString(row.category_id),
    projectId: asNullableString(row.project_id),
    reversalOfEventId: asNullableString(row.reversal_of_event_id),
    createdBy: asNullableString(row.created_by),
    sourceWalletId: asNullableString(row.source_wallet_id),
    destinationWalletId: asNullableString(row.destination_wallet_id),
    amountMinor: asMinorString(row.amount_minor),
    createdAt: asString(row.created_at),
  };
}

export function mapProjectReadRow(raw: unknown): ProjectReadRow {
  const row = asRecord(raw);
  const totals = Array.isArray(row.totals)
    ? row.totals.map((item) => {
        const total = asRecord(item);
        return {
          currencyCode: asString(total.currency_code),
          incomeMinor: asMinorString(total.income_minor),
          expenseMinor: asMinorString(total.expense_minor),
          netMinor: asMinorString(total.net_minor),
        };
      })
    : [];
  return {
    id: asString(row.id),
    name: asString(row.name),
    status: asString(row.status),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    totals,
  };
}

export function mapWorkerReadRow(raw: unknown): WorkerReadRow {
  const row = asRecord(raw);
  return {
    workerId: asString(row.worker_id),
    projectId: asString(row.project_id),
    name: asString(row.name),
    phone: asNullableString(row.phone),
    dailyWageMinor: asMinorString(row.daily_wage_minor),
    status: asString(row.status),
    balanceMinor: asMinorString(row.balance_minor),
    earnedMinor: asMinorString(row.earned_minor),
    withdrawnMinor: asMinorString(row.withdrawn_minor),
    deductedMinor: asMinorString(row.deducted_minor),
    workDays: asNumber(row.work_days),
  };
}

function mapPaginated<T>(
  data: unknown,
  mapper: (raw: unknown) => T,
): PaginatedFinancialRows<T> {
  const payload = asRecord(data);
  const rows = Array.isArray(payload.rows) ? payload.rows.map(mapper) : [];
  return { rows, total: asNumber(payload.total) };
}

export async function fetchCustomerFinancialSnapshot(
  workspaceId: string,
): Promise<FinancialSnapshot> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "supervisor_customer_financial_snapshot",
    { p_workspace_id: workspaceId },
  );
  if (error) throwIf(error, "تعذر تحميل الملخص المالي");
  return mapFinancialSnapshot(data);
}

export async function fetchCustomerWallets(
  workspaceId: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedFinancialRows<WalletReadRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_customer_wallets", {
    p_workspace_id: workspaceId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throwIf(error, "تعذر تحميل المحافظ");
  return mapPaginated(data, mapWalletReadRow);
}

export async function fetchCustomerTransactions(
  workspaceId: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedFinancialRows<TransactionReadRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "supervisor_customer_transactions",
    {
      p_workspace_id: workspaceId,
      p_limit: limit,
      p_offset: offset,
    },
  );
  if (error) throwIf(error, "تعذر تحميل المعاملات");
  return mapPaginated(data, mapTransactionReadRow);
}

export async function fetchCustomerProjects(
  workspaceId: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedFinancialRows<ProjectReadRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_customer_projects", {
    p_workspace_id: workspaceId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throwIf(error, "تعذر تحميل المشاريع");
  return mapPaginated(data, mapProjectReadRow);
}

export async function fetchCustomerWorkers(
  workspaceId: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedFinancialRows<WorkerReadRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_customer_workers", {
    p_workspace_id: workspaceId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throwIf(error, "تعذر تحميل العمال");
  return mapPaginated(data, mapWorkerReadRow);
}

export const financialReadKeys = {
  all: ["supervisor", "financialRead"] as const,
  customerFinance: (
    workspaceId: string,
    resource: FinancialResource,
    page: number,
  ) =>
    [
      ...financialReadKeys.all,
      "customerFinance",
      workspaceId,
      resource,
      page,
    ] as const,
};
