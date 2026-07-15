import type { CurrencyCode } from "@/domain/ledger/ledger";

export type ProjectStatus = "active" | "archived";
export type ProjectType =
  | "birds"
  | "animals"
  | "goods"
  | "food"
  | "services"
  | "general"
  | "construction"
  | "rental"
  | "farming"
  | "delivery"
  | "maintenance"
  | "education"
  | "ecommerce"
  | "personal";
export interface ProjectModules {
  readonly transactions: boolean;
  readonly goal: boolean;
  readonly workers: boolean;
  readonly capital: boolean;
  readonly inventory: boolean;
  readonly livestock: boolean;
}
export type ProjectModuleKey = keyof ProjectModules;
export interface ProjectCategorySeed {
  readonly name: string;
  readonly kind: "income" | "expense";
}
export type CategorySeed = ProjectCategorySeed;
export type ProjectSetupStepId =
  | "first_transaction"
  | "set_goal"
  | "first_worker"
  | "opening_capital"
  | "first_inventory_item";
export interface ProjectSetupStep {
  readonly id: ProjectSetupStepId;
  readonly module: ProjectModuleKey;
  readonly title: string;
  readonly description: string;
}
export type SetupStepMetadata = ProjectSetupStep;
export type ProjectColorToken =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface WorkspaceBrand {
  legalName: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  invoiceFooter: string | null;
  logoPath: string | null;
  logoUrl: string | null;
}

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  currency: CurrencyCode;
  role: "owner" | "admin" | "member" | "viewer";
  brand: WorkspaceBrand;
}

export type InvoicePaymentMethod =
  | "cash"
  | "bank_transfer"
  | "check"
  | "mobile_payment"
  | "other";

export interface InvoicePayment {
  id: string;
  workspaceId: string;
  invoiceId: string;
  amountMinor: bigint;
  method: InvoicePaymentMethod;
  notes: string | null;
  walletId: string | null;
  financialEventId: string | null;
  paidOn: string;
  createdBy: string;
  clientId: string;
  createdAt: string;
}

export type DebtDirection = "receivable" | "payable";
export type DebtStatus = "open" | "partial" | "settled" | "written_off";
export type DebtEntryType = "open" | "payment" | "adjustment" | "write_off";

export interface DebtParty {
  id: string;
  workspaceId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtSummary {
  id: string;
  workspaceId: string;
  partyId: string;
  partyName: string;
  partyPhone: string | null;
  direction: DebtDirection;
  principalMinor: bigint;
  balanceMinor: bigint;
  paidMinor: bigint;
  adjustedMinor: bigint;
  writtenOffMinor: bigint;
  currencyCode: string;
  status: DebtStatus;
  dueOn: string | null;
  projectId: string | null;
  projectName: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DebtWorkspaceSummary {
  workspaceId: string;
  currencyCode: string;
  receivableMinor: bigint;
  payableMinor: bigint;
  netMinor: bigint;
  openCount: number;
  overdueCount: number;
}

export interface DebtEntry {
  id: string;
  workspaceId: string;
  debtId: string;
  entryType: DebtEntryType;
  amountMinor: bigint;
  currencyCode: string;
  occurredOn: string;
  note: string | null;
  financialEventId: string | null;
  createdBy: string;
  clientId: string;
  operation: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  projectType: ProjectType;
  modules: ProjectModules;
  parentProjectId?: string | null;
  incomeMinor: bigint;
  expenseMinor: bigint;
  profitMinor: bigint;
  goalMinor?: bigint;
  progress: number;
  mark: string;
  tone: string;
  colorToken: ProjectColorToken;
  outstandingLaborMinor: bigint;
  activeWorkers: number;
  capitalMinor: bigint;
  capitalRecoveredRate: number | null;
  inventoryValueMinor: bigint;
  inventoryItemCount: number;
  cashMode?: ProjectCashMode;
  linkedWalletId?: string | null;
  projectCashBalanceMinor?: bigint;
}

export type CapitalEntryType =
  | "opening"
  | "contribution"
  | "withdrawal"
  | "adjustment";

export interface CapitalEntry {
  id: string;
  workspaceId: string;
  projectId: string;
  entryType: CapitalEntryType;
  amountMinor: bigint;
  currencyCode: string;
  note: string | null;
  occurredOn: string;
  createdBy: string;
  clientId: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  quantity: number;
  unitLabel: string;
  unitCostMinor: bigint | null;
  currencyCode: string;
  status: "active" | "archived";
  barcode: string | null;
  locationId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLocation {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryMovementType = "in" | "out" | "adjust" | "transfer";

export interface InventoryMovement {
  id: string;
  workspaceId: string;
  projectId: string;
  itemId: string;
  movementType: InventoryMovementType;
  quantity: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  note: string | null;
  occurredOn: string;
  createdBy: string;
  clientId: string;
  createdAt: string;
}

export interface LivestockBatch {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  species: string | null;
  headCount: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type LivestockEventType =
  | "hatch"
  | "birth"
  | "death"
  | "sale"
  | "transfer";

export interface LivestockEvent {
  id: string;
  workspaceId: string;
  projectId: string;
  batchId: string;
  eventType: LivestockEventType;
  quantity: number;
  occurredOn: string;
  note: string | null;
  createdBy: string;
  clientId: string;
  createdAt: string;
}

export interface WorkspaceGoal {
  workspaceId: string;
  monthKey: string;
  incomeGoalMinor: bigint;
  currencyCode: string;
  note: string | null;
  updatedBy: string;
  updatedAt: string;
}

export interface FinancialEventAttachment {
  id: string;
  workspaceId: string;
  financialEventId: string;
  objectPath: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  createdBy: string;
  createdAt: string;
}

export type ProjectMemberRole = "manager" | "contributor" | "viewer";

export interface ProjectMember {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
  createdBy: string;
  createdAt: string;
  displayName?: string | null;
  email?: string | null;
}

export interface AchievementUnlock {
  achievementId: string;
  unlockedAt: string;
  projectId?: string;
}

export interface WorkerBalance {
  workerId: string;
  workspaceId: string;
  projectId: string;
  name: string;
  phone: string | null;
  dailyWageMinor: bigint;
  status: "active" | "inactive";
  balanceMinor: bigint;
  earnedMinor: bigint;
  withdrawnMinor: bigint;
  deductedMinor: bigint;
  workDays: number;
}

export interface WorkLogEntry {
  id: string;
  workspaceId: string;
  projectId: string;
  workerId: string;
  entryType:
    | "daily_wage"
    | "bonus"
    | "deduction"
    | "withdrawal"
    | "adjustment";
  workDate: string;
  amountMinor: bigint;
  currencyCode: string;
  note: string | null;
  createdAt: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  kind: "income" | "expense";
}

export type CategoryKind = "income" | "expense";

export interface CategoryRecord {
  id: string;
  name: string;
  kind: CategoryKind;
  isSystem: boolean;
  isActive: boolean;
}

export interface CategoryInput {
  /** Omit for create, provide for update. */
  id?: string;
  name: string;
  kind: CategoryKind;
  /** Defaults to true. Set false to archive. */
  isActive?: boolean;
}

export interface BudgetRecord {
  id: string;
  categoryId: string;
  currencyCode: string;
  limitMinor: bigint;
}

export interface BudgetInput {
  /** Omit for create, provide for update. */
  id?: string;
  categoryId: string;
  currencyCode: string;
  limitMinor: bigint;
}

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurringRecord {
  id: string;
  title: string;
  kind: CategoryKind;
  amountMinor: bigint;
  currencyCode: string;
  walletId: string;
  categoryId: string | null;
  projectId: string | null;
  frequency: RecurringFrequency;
  intervalSteps: number;
  nextDate: string;
  lastPostedAt: string | null;
  isActive: boolean;
}

export interface RecurringInput {
  /** Omit for create, provide for update. */
  id?: string;
  title: string;
  kind: CategoryKind;
  amountMinor: bigint;
  currencyCode: string;
  walletId: string;
  categoryId?: string | null;
  projectId?: string | null;
  frequency: RecurringFrequency;
  intervalSteps: number;
  /** ISO date (YYYY-MM-DD) of the next scheduled posting. */
  nextDate: string;
  isActive?: boolean;
}

export type ProjectCashMode = "off" | "project_cash" | "project_wallet" | "hybrid";

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  phone: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCashBalance {
  projectId: string;
  workspaceId: string;
  balanceMinor: bigint;
  currencyCode: string;
}

export type ProjectCashEntryType =
  | "income"
  | "expense"
  | "transfer_out"
  | "transfer_in";

export interface ProjectCashEntry {
  id: string;
  workspaceId: string;
  projectId: string;
  entryType: ProjectCashEntryType;
  amountMinor: bigint;
  currencyCode: string;
  title: string | null;
  note: string | null;
  walletId: string | null;
  createdBy: string;
  clientId: string;
  createdAt: string;
}

export type IncomePayKind = "daily" | "monthly" | "both";
export type IncomeEntryType =
  | "daily_wage"
  | "bonus"
  | "deduction"
  | "salary_accrual"
  | "withdrawal";

export interface IncomeSource {
  id: string;
  workspaceId: string;
  name: string;
  place: string | null;
  payKind: IncomePayKind;
  dailyWageMinor: bigint | null;
  monthlySalaryMinor: bigint | null;
  currencyCode: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSourceBalance {
  sourceId: string;
  workspaceId: string;
  earnedMinor: bigint;
  withdrawnMinor: bigint;
  deductedMinor: bigint;
  bonusMinor: bigint;
  balanceMinor: bigint;
  workDays: number;
  currencyCode: string;
}

export interface IncomeEntry {
  id: string;
  workspaceId: string;
  sourceId: string;
  entryType: IncomeEntryType;
  amountMinor: bigint;
  currencyCode: string;
  workDate: string;
  walletId: string | null;
  note: string | null;
  createdBy: string;
  clientId: string;
  createdAt: string;
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "cancelled";

export interface InvoiceItem {
  id: string;
  workspaceId: string;
  invoiceId: string;
  sortOrder: number;
  description: string;
  quantity: number;
  unitPriceMinor: bigint;
  lineTotalMinor: bigint;
  createdAt: string;
}

export interface Invoice {
  id: string;
  workspaceId: string;
  invoiceNumber: string;
  businessClientId: string | null;
  clientName: string;
  clientPhone: string | null;
  status: InvoiceStatus;
  issueOn: string;
  dueOn: string | null;
  notes: string | null;
  taxRatePercent: number;
  subtotalMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  paidMinor: bigint;
  currencyCode: string;
  createdBy: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  items?: InvoiceItem[];
  payments?: InvoicePayment[];
}
