import type {
  FinanceTransaction,
  Wallet,
} from "@/domain/finance/finance-state";
import type { CurrencyCode } from "@/domain/ledger/ledger";
import {
  getDefaultProjectModules,
  normalizeProjectModules,
  normalizeProjectType,
  parseProjectModules,
} from "@/features/projects/project-blueprints";
import type {
  CapitalEntry,
  Client,
  DebtEntry,
  DebtParty,
  DebtSummary,
  DebtWorkspaceSummary,
  FinancialEventAttachment,
  IncomeEntry,
  IncomeSource,
  IncomeSourceBalance,
  InventoryItem,
  InventoryLocation,
  InventoryMovement,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceStatus,
  LivestockBatch,
  LivestockEvent,
  ProjectCashBalance,
  ProjectCashEntry,
  ProjectCashMode,
  ProjectColorToken,
  ProjectMember,
  ProjectSummary,
  WorkerBalance,
  WorkLogEntry,
  WorkspaceGoal,
} from "./workspace-types";

const COLOR_TONES: Record<ProjectColorToken, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function parseMinorText(
  value: unknown,
  fieldName = "amount_minor",
): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (Number.isSafeInteger(value)) return BigInt(value);
    throw new Error(
      `خطأ سلامة البيانات: ${fieldName} يجب أن يكون عدداً صحيحاً آمناً`,
    );
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  throw new Error(
    `خطأ سلامة البيانات: ${fieldName} يجب أن يكون نصاً صحيحاً بأساس عشري`,
  );
}

function parseMinorOrZero(value: unknown, fieldName: string): bigint {
  return value === undefined ? 0n : parseMinorText(value, fieldName);
}

export function mapWalletBalance(row: {
  id: string;
  name: string;
  currency_code: string;
  balance_minor: string;
  status: string;
}): Wallet {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency_code as CurrencyCode,
    balanceMinor: parseMinorText(row.balance_minor),
  };
}

export function mapDebtParty(row: {
  id: string;
  workspace_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): DebtParty {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    phone: row.phone,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDebtSummary(row: {
  id: string;
  workspace_id: string;
  party_id: string;
  party_name: string;
  party_phone: string | null;
  direction: DebtSummary["direction"];
  principal_minor: unknown;
  balance_minor: unknown;
  paid_minor: unknown;
  adjusted_minor: unknown;
  written_off_minor: unknown;
  currency_code: string;
  status: DebtSummary["status"];
  due_on: string | null;
  project_id: string | null;
  project_name: string | null;
  note: string | null;
  archived_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): DebtSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    partyId: row.party_id,
    partyName: row.party_name,
    partyPhone: row.party_phone,
    direction: row.direction,
    principalMinor: parseMinorText(
      row.principal_minor,
      "debt_balances.principal_minor",
    ),
    balanceMinor: parseMinorText(
      row.balance_minor,
      "debt_balances.balance_minor",
    ),
    paidMinor: parseMinorText(row.paid_minor, "debt_balances.paid_minor"),
    adjustedMinor: parseMinorText(
      row.adjusted_minor,
      "debt_balances.adjusted_minor",
    ),
    writtenOffMinor: parseMinorText(
      row.written_off_minor,
      "debt_balances.written_off_minor",
    ),
    currencyCode: row.currency_code,
    status: row.status,
    dueOn: row.due_on,
    projectId: row.project_id,
    projectName: row.project_name,
    note: row.note,
    archivedAt: row.archived_at ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapDebtWorkspaceSummary(row: {
  workspace_id: string;
  currency_code: string;
  receivable_minor: unknown;
  payable_minor: unknown;
  net_minor: unknown;
  open_count: unknown;
  overdue_count: unknown;
}): DebtWorkspaceSummary {
  return {
    workspaceId: row.workspace_id,
    currencyCode: row.currency_code,
    receivableMinor: parseMinorText(
      row.receivable_minor,
      "debt_summaries.receivable_minor",
    ),
    payableMinor: parseMinorText(
      row.payable_minor,
      "debt_summaries.payable_minor",
    ),
    netMinor: parseMinorText(row.net_minor, "debt_summaries.net_minor"),
    openCount: Number(row.open_count ?? 0),
    overdueCount: Number(row.overdue_count ?? 0),
  };
}

export function mapDebtEntry(row: {
  id: string;
  workspace_id: string;
  debt_id: string;
  entry_type: DebtEntry["entryType"];
  amount_minor: unknown;
  currency_code: string;
  occurred_on: string;
  note: string | null;
  financial_event_id: string | null;
  created_by: string;
  client_id: string;
  operation: string;
  created_at: string;
}): DebtEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    debtId: row.debt_id,
    entryType: row.entry_type,
    amountMinor: parseMinorText(
      row.amount_minor,
      "debt_entry_details.amount_minor",
    ),
    currencyCode: row.currency_code,
    occurredOn: row.occurred_on,
    note: row.note,
    financialEventId: row.financial_event_id,
    createdBy: row.created_by,
    clientId: row.client_id,
    operation: row.operation,
    createdAt: row.created_at,
  };
}

export function mapFinancialEvent(row: {
  id: string;
  event_type: string;
  effective_event_type: string;
  is_reversal: boolean;
  currency_code: string;
  occurred_at: string;
  description: string | null;
  category_id: string | null;
  project_id: string | null;
  source_wallet_id: string | null;
  destination_wallet_id: string | null;
  amount_minor: string;
}): FinanceTransaction | null {
  const amountMinor = parseMinorText(row.amount_minor);
  const eventType = row.effective_event_type;
  const currency = row.currency_code as CurrencyCode;
  const title = row.description?.trim() || "معاملة";
  const base = {
    id: row.id,
    amountMinor,
    currency,
    title,
    occurredAt: row.occurred_at,
    ...(row.project_id ? { projectId: row.project_id } : {}),
    ...(row.category_id ? { categoryId: row.category_id } : {}),
  };

  if (eventType === "income") {
    if (!row.destination_wallet_id) return null;
    return {
      ...base,
      kind: "income",
      walletId: row.destination_wallet_id,
    };
  }

  if (eventType === "expense") {
    if (!row.source_wallet_id) return null;
    return {
      ...base,
      kind: "expense",
      walletId: row.source_wallet_id,
    };
  }

  if (eventType === "transfer") {
    if (!row.source_wallet_id || !row.destination_wallet_id) return null;
    return {
      ...base,
      kind: "transfer",
      walletId: row.source_wallet_id,
      destinationWalletId: row.destination_wallet_id,
    };
  }

  if (eventType === "opening_balance") {
    if (row.destination_wallet_id) {
      return {
        ...base,
        kind: "opening_balance",
        walletId: row.destination_wallet_id,
        flow: "in",
      };
    }
    if (row.source_wallet_id) {
      return {
        ...base,
        kind: "opening_balance",
        walletId: row.source_wallet_id,
        flow: "out",
      };
    }
    return null;
  }

  return null;
}

export function mapProjectSummary(input: {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  color_token?: string | null;
  project_type?: unknown;
  modules?: unknown;
  parent_project_id?: string | null;
  goal_minor?: unknown;
  income_minor?: unknown;
  expense_minor?: unknown;
  outstanding_minor?: unknown;
  active_workers?: unknown;
  capital_minor?: unknown;
  net_capital_minor?: unknown;
  inventory_value_minor?: unknown;
  inventory_item_count?: unknown;
  item_count?: unknown;
  cash_mode?: string | null;
  linked_wallet_id?: string | null;
  project_cash_balance_minor?: unknown;
}): ProjectSummary {
  const incomeMinor = parseMinorOrZero(input.income_minor, "income_minor");
  const expenseMinor = parseMinorOrZero(input.expense_minor, "expense_minor");
  const goalMinor = input.goal_minor == null
    ? undefined
    : parseMinorText(input.goal_minor, "goal_minor");
  const colorToken = (
    ["primary", "success", "warning", "danger", "info"].includes(
      input.color_token ?? "",
    )
      ? input.color_token
      : "primary"
  ) as ProjectColorToken;
  const projectType = normalizeProjectType(input.project_type);
  const fallbackModules = getDefaultProjectModules(projectType);
  const activeWorkers = parseCount(input.active_workers);
  const parsedModules = parseProjectModules(input.modules);
  const normalizedModules =
    parsedModules ??
    normalizeProjectModules(input.modules, fallbackModules);
  const modules =
    parsedModules === null
      ? {
          ...normalizedModules,
          goal: goalMinor !== undefined || normalizedModules.goal,
          workers:
            activeWorkers > 0 ||
            parseMinorOrZero(input.outstanding_minor, "outstanding_minor") !==
              0n ||
            normalizedModules.workers,
        }
      : normalizedModules;
  const hasCapitalMinor = input.capital_minor !== undefined;
  const capitalMinor = parseMinorOrZero(
    hasCapitalMinor ? input.capital_minor : input.net_capital_minor,
    hasCapitalMinor ? "capital_minor" : "net_capital_minor",
  );
  const profitMinor = incomeMinor - expenseMinor;
  const outstandingLaborMinor = parseMinorOrZero(
    input.outstanding_minor,
    "outstanding_minor",
  );

  let progress = 0;
  if (goalMinor && goalMinor > 0n) {
    const raw = Number((incomeMinor * 100n) / goalMinor);
    progress = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
  }

  return {
    id: input.id,
    name: input.name,
    description: input.description?.trim() || "بدون وصف",
    status: input.status,
    projectType,
    modules,
    parentProjectId: input.parent_project_id ?? null,
    incomeMinor,
    expenseMinor,
    profitMinor,
    ...(goalMinor !== undefined ? { goalMinor } : {}),
    progress,
    mark: input.name.trim().charAt(0) || "م",
    tone: COLOR_TONES[colorToken],
    colorToken,
    outstandingLaborMinor,
    activeWorkers,
    capitalMinor,
    capitalRecoveredRate:
      capitalMinor > 0n
        ? safePercent(
            modules.workers && outstandingLaborMinor > 0n
              ? profitMinor - outstandingLaborMinor
              : profitMinor,
            capitalMinor,
          )
        : null,
    inventoryValueMinor: parseMinorOrZero(
      input.inventory_value_minor,
      "inventory_value_minor",
    ),
    inventoryItemCount: parseCount(
      input.inventory_item_count ?? input.item_count,
    ),
    cashMode: (input.cash_mode as ProjectCashMode | null) ?? "hybrid",
    ...(input.linked_wallet_id !== undefined
      ? { linkedWalletId: input.linked_wallet_id }
      : {}),
    ...(input.project_cash_balance_minor != null
      ? {
          projectCashBalanceMinor: parseMinorOrZero(
            input.project_cash_balance_minor,
            "project_cash_balance_minor",
          ),
        }
      : {}),
  };
}

function parseCount(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function safePercent(part: bigint, total: bigint): number {
  const scaled = (part * 10_000n) / total;
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (scaled > limit) return Number.MAX_SAFE_INTEGER / 100;
  if (scaled < -limit) return -Number.MAX_SAFE_INTEGER / 100;
  return Number(scaled) / 100;
}

export function mapCapitalEntry(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  entry_type: CapitalEntry["entryType"];
  amount_minor: unknown;
  currency_code: string;
  note: string | null;
  occurred_on: string;
  created_by: string;
  client_id: string;
  created_at: string;
}): CapitalEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    entryType: row.entry_type,
    amountMinor: parseMinorText(
      row.amount_minor,
      "project_capital_entries.amount_minor",
    ),
    currencyCode: row.currency_code,
    note: row.note,
    occurredOn: row.occurred_on,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

export function mapInventoryItem(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  quantity: unknown;
  unit_label: string;
  unit_cost_minor: unknown;
  currency_code: string;
  status: InventoryItem["status"];
  barcode?: string | null;
  location_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): InventoryItem {
  const quantity = Number(row.quantity);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
    unitLabel: row.unit_label,
    unitCostMinor:
      row.unit_cost_minor == null
        ? null
        : parseMinorText(
            row.unit_cost_minor,
            "project_inventory_items.unit_cost_minor",
          ),
    currencyCode: row.currency_code,
    status: row.status,
    barcode: row.barcode ?? null,
    locationId: row.location_id ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkerBalance(row: {
  worker_id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  phone: string | null;
  daily_wage_minor: unknown;
  status: "active" | "inactive";
  balance_minor: unknown;
  earned_minor: unknown;
  withdrawn_minor: unknown;
  deducted_minor: unknown;
  work_days: number;
}): WorkerBalance {
  return {
    workerId: row.worker_id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    phone: row.phone,
    dailyWageMinor: parseMinorText(
      row.daily_wage_minor,
      "project_worker_balance_details.daily_wage_minor",
    ),
    status: row.status,
    balanceMinor: parseMinorText(
      row.balance_minor,
      "project_worker_balance_details.balance_minor",
    ),
    earnedMinor: parseMinorText(
      row.earned_minor,
      "project_worker_balance_details.earned_minor",
    ),
    withdrawnMinor: parseMinorText(
      row.withdrawn_minor,
      "project_worker_balance_details.withdrawn_minor",
    ),
    deductedMinor: parseMinorText(
      row.deducted_minor,
      "project_worker_balance_details.deducted_minor",
    ),
    workDays: row.work_days ?? 0,
  };
}

export function mapWorkLog(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  worker_id: string;
  entry_type: WorkLogEntry["entryType"];
  work_date: string;
  amount_minor: unknown;
  currency_code: string;
  note: string | null;
  created_at: string;
}): WorkLogEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    workerId: row.worker_id,
    entryType: row.entry_type,
    workDate: row.work_date,
    amountMinor: parseMinorText(
      row.amount_minor,
      "project_work_log_details.amount_minor",
    ),
    currencyCode: row.currency_code,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapInventoryLocation(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}): InventoryLocation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInventoryMovement(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  item_id: string;
  movement_type: InventoryMovement["movementType"];
  quantity: unknown;
  from_location_id: string | null;
  to_location_id: string | null;
  note: string | null;
  occurred_on: string;
  created_by: string;
  client_id: string;
  created_at: string;
}): InventoryMovement {
  const quantity = Number(row.quantity);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    itemId: row.item_id,
    movementType: row.movement_type,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    fromLocationId: row.from_location_id,
    toLocationId: row.to_location_id,
    note: row.note,
    occurredOn: row.occurred_on,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

export function mapLivestockBatch(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  name: string;
  species: string | null;
  head_count: number;
  note: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): LivestockBatch {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    name: row.name,
    species: row.species,
    headCount: row.head_count,
    note: row.note,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLivestockEvent(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  batch_id: string;
  event_type: LivestockEvent["eventType"];
  quantity: number;
  occurred_on: string;
  note: string | null;
  created_by: string;
  client_id: string;
  created_at: string;
}): LivestockEvent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    batchId: row.batch_id,
    eventType: row.event_type,
    quantity: row.quantity,
    occurredOn: row.occurred_on,
    note: row.note,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

export function mapWorkspaceGoal(row: {
  workspace_id: string;
  month_key: string;
  income_goal_minor: unknown;
  currency_code: string;
  note: string | null;
  updated_by: string;
  updated_at: string;
}): WorkspaceGoal {
  return {
    workspaceId: row.workspace_id,
    monthKey: row.month_key,
    incomeGoalMinor: parseMinorText(
      row.income_goal_minor,
      "workspace_goals.income_goal_minor",
    ),
    currencyCode: row.currency_code,
    note: row.note,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export function mapFinancialEventAttachment(row: {
  id: string;
  workspace_id: string;
  financial_event_id: string;
  object_path: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  created_by: string;
  created_at: string;
}): FinancialEventAttachment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    financialEventId: row.financial_event_id,
    objectPath: row.object_path,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function mapProjectMember(row: {
  workspace_id: string;
  project_id: string;
  user_id: string;
  role: ProjectMember["role"];
  created_by: string;
  created_at: string;
  display_name?: string | null;
  email?: string | null;
}): ProjectMember {
  return {
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    userId: row.user_id,
    role: row.role,
    createdBy: row.created_by,
    createdAt: row.created_at,
    displayName: row.display_name ?? null,
    email: row.email ?? null,
  };
}

export function mapClient(row: {
  id: string;
  workspace_id: string;
  name: string;
  phone: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}): Client {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    phone: row.phone,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseQuantity(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseTaxRate(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function mapInvoiceItem(row: {
  id: string;
  workspace_id: string;
  invoice_id: string;
  sort_order: number;
  description: string;
  quantity: unknown;
  unit_price_minor: unknown;
  line_total_minor: unknown;
  created_at: string;
}): InvoiceItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    invoiceId: row.invoice_id,
    sortOrder: row.sort_order,
    description: row.description,
    quantity: parseQuantity(row.quantity),
    unitPriceMinor: parseMinorOrZero(
      row.unit_price_minor,
      "invoice_items.unit_price_minor",
    ),
    lineTotalMinor: parseMinorOrZero(
      row.line_total_minor,
      "invoice_items.line_total_minor",
    ),
    createdAt: row.created_at,
  };
}

export function mapInvoice(row: {
  id: string;
  workspace_id: string;
  invoice_number: string;
  business_client_id: string | null;
  client_name: string;
  client_phone: string | null;
  status: InvoiceStatus;
  issue_on: string;
  due_on: string | null;
  notes: string | null;
  tax_rate_percent: unknown;
  subtotal_minor: unknown;
  tax_minor: unknown;
  total_minor: unknown;
  paid_minor?: unknown;
  currency_code: string;
  created_by: string;
  client_id: string;
  created_at: string;
  updated_at: string;
}): Invoice {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    invoiceNumber: row.invoice_number,
    businessClientId: row.business_client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    status: row.status,
    issueOn: row.issue_on,
    dueOn: row.due_on,
    notes: row.notes,
    taxRatePercent: parseTaxRate(row.tax_rate_percent),
    subtotalMinor: parseMinorOrZero(row.subtotal_minor, "invoices.subtotal_minor"),
    taxMinor: parseMinorOrZero(row.tax_minor, "invoices.tax_minor"),
    totalMinor: parseMinorOrZero(row.total_minor, "invoices.total_minor"),
    paidMinor: parseMinorOrZero(row.paid_minor ?? 0, "invoices.paid_minor"),
    currencyCode: row.currency_code,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapInvoicePayment(row: {
  id: string;
  workspace_id: string;
  invoice_id: string;
  amount_minor: unknown;
  method: string;
  notes: string | null;
  wallet_id: string | null;
  financial_event_id: string | null;
  paid_on: string;
  created_by: string;
  client_id: string;
  created_at: string;
}): InvoicePayment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    invoiceId: row.invoice_id,
    amountMinor: parseMinorOrZero(row.amount_minor, "invoice_payments.amount_minor"),
    method: row.method as InvoicePayment["method"],
    notes: row.notes,
    walletId: row.wallet_id,
    financialEventId: row.financial_event_id,
    paidOn: row.paid_on,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

export function mapProjectCashBalance(row: {
  project_id: string;
  workspace_id: string;
  balance_minor: unknown;
  currency_code: string;
}): ProjectCashBalance {
  return {
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    balanceMinor: parseMinorOrZero(row.balance_minor, "project_cash_balances.balance_minor"),
    currencyCode: row.currency_code,
  };
}

export function mapProjectCashEntry(row: {
  id: string;
  workspace_id: string;
  project_id: string;
  entry_type: ProjectCashEntry["entryType"];
  amount_minor: unknown;
  currency_code: string;
  title: string;
  note: string | null;
  wallet_id: string | null;
  created_by: string;
  client_id: string;
  created_at: string;
}): ProjectCashEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    entryType: row.entry_type,
    amountMinor: parseMinorText(row.amount_minor, "project_cash_entries.amount_minor"),
    currencyCode: row.currency_code,
    title: row.title,
    note: row.note,
    walletId: row.wallet_id,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}

export function mapIncomeSource(row: {
  id: string;
  workspace_id: string;
  name: string;
  place_label: string | null;
  pay_kind: IncomeSource["payKind"];
  default_daily_wage_minor: unknown;
  monthly_salary_minor: unknown;
  currency_code: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}): IncomeSource {
  const daily = parseMinorOrZero(
    row.default_daily_wage_minor,
    "income_sources.default_daily_wage_minor",
  );
  const monthly = parseMinorOrZero(
    row.monthly_salary_minor,
    "income_sources.monthly_salary_minor",
  );
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    place: row.place_label,
    payKind: row.pay_kind,
    dailyWageMinor: daily > 0n ? daily : null,
    monthlySalaryMinor: monthly > 0n ? monthly : null,
    currencyCode: row.currency_code,
    isActive: row.status === "active",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapIncomeSourceBalance(row: {
  source_id: string;
  workspace_id: string;
  earned_daily_minor?: unknown;
  earned_salary_minor?: unknown;
  withdrawn_minor: unknown;
  deduction_minor?: unknown;
  deducted_minor?: unknown;
  bonus_minor: unknown;
  outstanding_minor?: unknown;
  balance_minor?: unknown;
  daily_count?: unknown;
  work_days?: unknown;
  currency_code: string;
}): IncomeSourceBalance {
  const earnedDaily = parseMinorOrZero(
    row.earned_daily_minor,
    "income_source_balances.earned_daily_minor",
  );
  const earnedSalary = parseMinorOrZero(
    row.earned_salary_minor,
    "income_source_balances.earned_salary_minor",
  );
  return {
    sourceId: row.source_id,
    workspaceId: row.workspace_id,
    earnedMinor: earnedDaily + earnedSalary,
    withdrawnMinor: parseMinorOrZero(
      row.withdrawn_minor,
      "income_source_balances.withdrawn_minor",
    ),
    deductedMinor: parseMinorOrZero(
      row.deduction_minor ?? row.deducted_minor,
      "income_source_balances.deduction_minor",
    ),
    bonusMinor: parseMinorOrZero(
      row.bonus_minor,
      "income_source_balances.bonus_minor",
    ),
    balanceMinor: parseMinorOrZero(
      row.outstanding_minor ?? row.balance_minor,
      "income_source_balances.outstanding_minor",
    ),
    workDays: Number(row.daily_count ?? row.work_days ?? 0),
    currencyCode: row.currency_code,
  };
}

export function mapIncomeEntry(row: {
  id: string;
  workspace_id: string;
  source_id: string;
  entry_type: IncomeEntry["entryType"];
  amount_minor: unknown;
  currency_code: string;
  work_on: string | null;
  wallet_id: string | null;
  note: string | null;
  reason?: string | null;
  created_by: string;
  client_id: string;
  created_at: string;
}): IncomeEntry {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    sourceId: row.source_id,
    entryType: row.entry_type,
    amountMinor: parseMinorText(row.amount_minor, "income_entries.amount_minor"),
    currencyCode: row.currency_code,
    workDate: row.work_on ?? row.created_at.slice(0, 10),
    walletId: row.wallet_id,
    note: row.note ?? row.reason ?? null,
    createdBy: row.created_by,
    clientId: row.client_id,
    createdAt: row.created_at,
  };
}
