import type { CurrencyCode } from "@/domain/ledger/ledger";

export type ProjectStatus = "active" | "archived";
export type ProjectType =
  | "birds"
  | "animals"
  | "goods"
  | "food"
  | "services"
  | "general";
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

export interface WorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  currency: CurrencyCode;
  role: "owner" | "admin" | "member" | "viewer";
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
