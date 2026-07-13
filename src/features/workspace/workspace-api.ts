import type {
  FinanceTransaction,
  Wallet,
} from "@/domain/finance/finance-state";
import type { CurrencyCode } from "@/domain/ledger/ledger";
import { toSafeMinorNumber } from "@/domain/money/money";
import {
  normalizeProjectModules,
  normalizeProjectType,
} from "@/features/projects/project-blueprints";
import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";
import type { Json } from "@/types/database";
import {
  mapCapitalEntry,
  mapDebtEntry,
  mapDebtParty,
  mapDebtSummary,
  mapDebtWorkspaceSummary,
  mapFinancialEvent,
  mapFinancialEventAttachment,
  mapInventoryItem,
  mapInventoryLocation,
  mapInventoryMovement,
  mapLivestockBatch,
  mapLivestockEvent,
  mapProjectMember,
  mapProjectSummary,
  mapWalletBalance,
  mapWorkerBalance,
  mapWorkLog,
  mapWorkspaceGoal,
} from "./mappers";
import type {
  AchievementUnlock,
  CapitalEntry,
  CapitalEntryType,
  DebtDirection,
  DebtEntry,
  DebtEntryType,
  DebtParty,
  DebtSummary,
  DebtWorkspaceSummary,
  FinancialEventAttachment,
  InventoryItem,
  InventoryLocation,
  InventoryMovement,
  InventoryMovementType,
  LivestockBatch,
  LivestockEvent,
  LivestockEventType,
  ProjectCategorySeed,
  ProjectModules,
  CategoryOption,
  ProjectMember,
  ProjectMemberRole,
  ProjectSummary,
  ProjectType,
  WorkerBalance,
  WorkLogEntry,
  WorkspaceGoal,
  WorkspaceMembership,
} from "./workspace-types";

const PROJECT_TRANSACTION_PAGE_SIZE = 1_000;
const DEBT_LIST_PAGE_SIZE = 500;
const DEBT_ENTRY_PAGE_SIZE = 500;

function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function projectTransactionCursorFilter(
  occurredAt: string,
  id: string,
): string {
  const occurredAtValue = quotePostgrestFilterValue(occurredAt);
  const idValue = quotePostgrestFilterValue(id);
  return [
    `occurred_at.lt.${occurredAtValue}`,
    `and(occurred_at.eq.${occurredAtValue},id.lt.${idValue})`,
  ].join(",");
}

type FinancialEventDetailRow = {
  id: string;
  event_type: string;
  effective_event_type: string;
  is_reversal: boolean;
  currency_code: string;
  occurred_at: string;
  description: string | null;
  category_id: string | null;
  project_id: string | null;
  reversal_of_event_id?: string | null;
  source_wallet_id: string | null;
  destination_wallet_id: string | null;
  amount_minor: string;
  created_at?: string;
};

function filterActiveFinancialEventRows(
  rows: FinancialEventDetailRow[],
): FinancialEventDetailRow[] {
  const reversedIds = new Set(
    rows
      .filter((row) => row.is_reversal && row.reversal_of_event_id)
      .map((row) => row.reversal_of_event_id as string),
  );
  return rows.filter(
    (row) => !row.is_reversal && !reversedIds.has(row.id),
  );
}

function throwArabic(error: { message?: string } | null, fallback: string): never {
  throw new Error(getUserErrorMessage(error, fallback));
}

function requireClientId(clientId: string | undefined): string {
  if (!clientId) {
    throw new Error("clientId مطلوب للعمليات القابلة لإعادة المحاولة");
  }
  return clientId;
}

export async function fetchUserWorkspace(
  userId: string,
): Promise<WorkspaceMembership | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select(
      "role, workspace_id, workspaces!inner(id, name, default_currency_code, status)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) throwArabic(error, "تعذر تحميل مساحة العمل");
  if (!data) return null;

  const workspace = data.workspaces as unknown as {
    id: string;
    name: string;
    default_currency_code: string;
    status: string;
  };

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    currency: workspace.default_currency_code as CurrencyCode,
    role: data.role as WorkspaceMembership["role"],
  };
}

export async function fetchWallets(workspaceId: string): Promise<Wallet[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("wallet_balances")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throwArabic(error, "تعذر تحميل المحافظ");
  return (data ?? []).map(mapWalletBalance);
}

export async function fetchTransactions(
  workspaceId: string,
): Promise<FinanceTransaction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("financial_event_details")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);

  if (error) throwArabic(error, "تعذر تحميل المعاملات");
  return filterActiveFinancialEventRows(data ?? [])
    .map(mapFinancialEvent)
    .filter((item): item is FinanceTransaction => item !== null);
}

export async function fetchDebts(workspaceId: string): Promise<DebtSummary[]> {
  const supabase = getSupabaseClient();
  const rows: DebtSummary[] = [];
  let from = 0;

  while (true) {
    const to = from + DEBT_LIST_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("debt_balances")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throwArabic(error, "تعذر تحميل الديون");
    const page = (data ?? []).map(mapDebtSummary);
    rows.push(...page);
    if (page.length < DEBT_LIST_PAGE_SIZE) break;
    from += DEBT_LIST_PAGE_SIZE;
  }

  return rows;
}

export async function fetchDebtWorkspaceSummary(
  workspaceId: string,
  currencyCode: string,
): Promise<DebtWorkspaceSummary | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("debt_summaries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("currency_code", currencyCode)
    .limit(1);
  if (error) throwArabic(error, "تعذر تحميل ملخص الديون");
  const row = data?.[0];
  return row ? mapDebtWorkspaceSummary(row) : null;
}

export async function fetchDebtDetail(
  workspaceId: string,
  debtId: string,
): Promise<DebtSummary | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("debt_balances")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", debtId)
    .limit(1);
  if (error) throwArabic(error, "تعذر تحميل الدين");
  const row = data?.[0];
  return row ? mapDebtSummary(row) : null;
}

export async function fetchDebtEntries(
  workspaceId: string,
  debtId: string,
): Promise<DebtEntry[]> {
  const supabase = getSupabaseClient();
  const rows: DebtEntry[] = [];
  let from = 0;

  while (true) {
    const to = from + DEBT_ENTRY_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("debt_entry_details")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("debt_id", debtId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throwArabic(error, "تعذر تحميل حركات الدين");
    const page = (data ?? []).map(mapDebtEntry);
    rows.push(...page);
    if (page.length < DEBT_ENTRY_PAGE_SIZE) break;
    from += DEBT_ENTRY_PAGE_SIZE;
  }

  return rows;
}

export async function fetchDebtParties(
  workspaceId: string,
): Promise<DebtParty[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("debt_parties")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });
  if (error) throwArabic(error, "تعذر تحميل أطراف الديون");
  return (data ?? []).map(mapDebtParty);
}

export async function fetchProjectTransactions(
  workspaceId: string,
  projectId: string,
  options: { readonly snapshotCutoff?: string } = {},
): Promise<FinanceTransaction[]> {
  const supabase = getSupabaseClient();
  const rows: FinancialEventDetailRow[] = [];
  const seenEventIds = new Set<string>();
  const snapshotCutoff = options.snapshotCutoff ?? new Date().toISOString();
  let cursor: { readonly occurredAt: string; readonly id: string } | null = null;

  while (true) {
    let query = supabase
      .from("financial_event_details")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .lte("created_at", snapshotCutoff);
    if (cursor) {
      query = query.or(
        projectTransactionCursorFilter(cursor.occurredAt, cursor.id),
      );
    }

    const { data, error } = await query
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PROJECT_TRANSACTION_PAGE_SIZE);

    if (error) throwArabic(error, "تعذر تحميل سجل معاملات المشروع");
    const page = (data ?? []) as FinancialEventDetailRow[];
    for (const row of page) {
      if (seenEventIds.has(row.id)) continue;
      seenEventIds.add(row.id);
      rows.push(row);
    }
    if (page.length < PROJECT_TRANSACTION_PAGE_SIZE) break;

    const lastRow = page.at(-1);
    if (!lastRow) break;
    const nextCursor = {
      occurredAt: lastRow.occurred_at,
      id: lastRow.id,
    };
    if (
      cursor?.occurredAt === nextCursor.occurredAt &&
      cursor.id === nextCursor.id
    ) {
      break;
    }
    cursor = nextCursor;
  }

  return filterActiveFinancialEventRows(rows)
    .map(mapFinancialEvent)
    .filter((item): item is FinanceTransaction => item !== null);
}

export async function fetchProjects(
  workspaceId: string,
  currencyCode: string,
): Promise<ProjectSummary[]> {
  const supabase = getSupabaseClient();
  const [
    projectsResult,
    totalsResult,
    laborResult,
    capitalResult,
    inventoryResult,
  ] = await Promise.all([
    supabase
      .from("project_summaries")
      .select(
        "id, name, description, status, color_token, goal_minor, project_type, modules, parent_project_id",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_financial_totals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("currency_code", currencyCode),
    supabase
      .from("project_labor_summaries")
      .select("*")
      .eq("workspace_id", workspaceId),
    supabase
      .from("project_capital_totals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("currency_code", currencyCode),
    supabase
      .from("project_inventory_totals")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("currency_code", currencyCode),
  ]);

  if (projectsResult.error) {
    throwArabic(projectsResult.error, "تعذر تحميل المشاريع");
  }
  if (totalsResult.error) {
    throwArabic(totalsResult.error, "تعذر تحميل أرصدة المشاريع");
  }
  if (laborResult.error) {
    throwArabic(laborResult.error, "تعذر تحميل مستحقات العمال");
  }
  if (capitalResult.error) {
    throwArabic(capitalResult.error, "تعذر تحميل رأس مال المشاريع");
  }
  if (inventoryResult.error) {
    throwArabic(inventoryResult.error, "تعذر تحميل مخزون المشاريع");
  }

  const totals = new Map(
    (totalsResult.data ?? []).map((row) => [row.project_id, row]),
  );
  const labor = new Map(
    (laborResult.data ?? []).map((row) => [row.project_id, row]),
  );
  const capital = new Map(
    (capitalResult.data ?? []).map((row) => [row.project_id, row]),
  );
  const inventory = new Map(
    (inventoryResult.data ?? []).map((row) => [row.project_id, row]),
  );

  return (projectsResult.data ?? []).map((project) => {
    const total = totals.get(project.id);
    const laborRow = labor.get(project.id);
    const capitalRow = capital.get(project.id);
    const inventoryRow = inventory.get(project.id);
    return mapProjectSummary({
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      color_token: project.color_token,
      goal_minor: project.goal_minor,
      project_type: project.project_type,
      modules: project.modules,
      parent_project_id: project.parent_project_id,
      income_minor: total?.income_minor,
      expense_minor: total?.expense_minor,
      outstanding_minor: laborRow?.outstanding_minor,
      active_workers: laborRow?.active_workers,
      net_capital_minor: capitalRow?.net_capital_minor,
      inventory_value_minor: inventoryRow?.inventory_value_minor,
      inventory_item_count: inventoryRow?.item_count,
    });
  });
}

export async function fetchCategories(
  workspaceId: string,
): Promise<CategoryOption[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("name");

  if (error) throwArabic(error, "تعذر تحميل التصنيفات");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
  }));
}

export async function fetchWorkers(
  workspaceId: string,
  projectId: string,
): Promise<WorkerBalance[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_worker_balance_details")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("name");

  if (error) throwArabic(error, "تعذر تحميل العمال");
  return (data ?? []).map(mapWorkerBalance);
}

export async function fetchWorkLogs(
  workspaceId: string,
  projectId: string,
): Promise<WorkLogEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_work_log_details")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("work_date", { ascending: false })
    .limit(100);

  if (error) throwArabic(error, "تعذر تحميل يوميات العمل");
  return (data ?? []).map(mapWorkLog);
}

export async function fetchCapitalEntries(
  workspaceId: string,
  projectId: string,
): Promise<CapitalEntry[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_capital_entry_details")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throwArabic(error, "تعذر تحميل حركات رأس المال");
  return (data ?? []).map(mapCapitalEntry);
}

export async function fetchInventoryItems(
  workspaceId: string,
  projectId: string,
): Promise<InventoryItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_inventory_item_details")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("status", "active")
    .order("name");

  if (error) throwArabic(error, "تعذر تحميل أصناف المخزون");
  return (data ?? []).map(mapInventoryItem);
}

export async function createDebtRpc(input: {
  workspaceId: string;
  direction: DebtDirection;
  partyName: string;
  partyPhone?: string;
  partyNotes?: string;
  principalMinor: number | bigint;
  currencyCode: string;
  dueOn?: string;
  projectId?: string;
  note?: string;
  clientId: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const principalMinor =
    typeof input.principalMinor === "bigint"
      ? toSafeMinorNumber(input.principalMinor)
      : toSafeMinorNumber(BigInt(input.principalMinor));
  if (principalMinor <= 0) {
    throw new Error("أدخل مبلغ دين أكبر من صفر");
  }
  const { data, error } = await supabase.rpc("create_debt", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_direction: input.direction,
    p_principal_minor: principalMinor,
    p_currency_code: input.currencyCode,
    p_party_name: input.partyName,
    p_party_phone: input.partyPhone ?? null,
    p_party_notes: input.partyNotes ?? null,
    p_due_on: input.dueOn ?? null,
    p_project_id: input.projectId ?? null,
    p_note: input.note ?? null,
  });
  if (error) throwArabic(error, "تعذر إنشاء الدين");
  return data as string;
}

export async function postDebtEntryRpc(input: {
  workspaceId: string;
  debtId: string;
  entryType: Exclude<DebtEntryType, "open">;
  amountMinor: number | bigint;
  occurredOn: string;
  walletId?: string;
  note?: string;
  clientId: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const amountMinor =
    typeof input.amountMinor === "bigint"
      ? toSafeMinorNumber(input.amountMinor)
      : toSafeMinorNumber(BigInt(input.amountMinor));
  if (amountMinor === 0) {
    throw new Error("مبلغ حركة الدين لا يمكن أن يكون صفرًا");
  }
  const { data, error } = await supabase.rpc("post_debt_entry", {
    p_workspace_id: input.workspaceId,
    p_debt_id: input.debtId,
    p_entry_type: input.entryType,
    p_amount_minor: amountMinor,
    p_occurred_on: input.occurredOn,
    p_wallet_id: input.walletId ?? null,
    p_note: input.note ?? null,
    p_client_id: requireClientId(input.clientId),
  });
  if (error) throwArabic(error, "تعذر حفظ حركة الدين");
  return data as string;
}

export async function createWalletRpc(input: {
  workspaceId: string;
  name: string;
  currencyCode: string;
  openingBalanceMinor?: number;
  clientId: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_wallet", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_name: input.name,
    p_currency_code: input.currencyCode,
    p_opening_balance_minor: input.openingBalanceMinor ?? 0,
  });
  if (error) throwArabic(error, "تعذر إنشاء المحفظة");
  return data as string;
}

export async function postTransactionRpc(input: {
  workspaceId: string;
  walletId: string;
  kind: "income" | "expense";
  amountMinor: number;
  description: string;
  categoryId?: string;
  projectId?: string;
  clientId: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("post_transaction", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_wallet_id: input.walletId,
    p_kind: input.kind,
    p_amount_minor: input.amountMinor,
    p_description: input.description,
    p_category_id: input.categoryId ?? null,
    p_project_id: input.projectId ?? null,
  });
  if (error) throwArabic(error, "تعذر حفظ المعاملة");
  return data as string;
}

export async function postTransferRpc(input: {
  workspaceId: string;
  sourceWalletId: string;
  destinationWalletId: string;
  amountMinor: number;
  description?: string;
  clientId: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("post_transfer", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_source_wallet_id: input.sourceWalletId,
    p_destination_wallet_id: input.destinationWalletId,
    p_amount_minor: input.amountMinor,
    p_description: input.description ?? null,
  });
  if (error) throwArabic(error, "تعذر تنفيذ التحويل");
  return data as string;
}

export async function reverseFinancialEventRpc(input: {
  workspaceId: string;
  eventId: string;
  clientId: string;
  reason?: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("reverse_financial_event", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_event_id: input.eventId,
    p_reason: input.reason ?? null,
  });
  if (error) throwArabic(error, "تعذر حذف المعاملة");
  return data as string;
}

export async function replaceTransactionRpc(input: {
  workspaceId: string;
  eventId: string;
  walletId: string;
  kind: "income" | "expense";
  amountMinor: number;
  description: string;
  categoryId?: string;
  projectId?: string | null;
  clientId: string;
  occurredAt?: string;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("replace_transaction", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_event_id: input.eventId,
    p_wallet_id: input.walletId,
    p_kind: input.kind,
    p_amount_minor: input.amountMinor,
    p_description: input.description,
    p_category_id: input.categoryId ?? null,
    p_project_id: input.projectId ?? null,
    p_occurred_at: input.occurredAt ?? null,
  });
  if (error) throwArabic(error, "تعذر تعديل المعاملة");
  return data as string;
}

export async function adjustWalletBalanceRpc(input: {
  workspaceId: string;
  walletId: string;
  targetBalanceMinor: number;
  clientId: string;
  note?: string;
}): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("adjust_wallet_balance", {
    p_workspace_id: input.workspaceId,
    p_client_id: requireClientId(input.clientId),
    p_wallet_id: input.walletId,
    p_target_balance_minor: input.targetBalanceMinor,
    p_note: input.note ?? null,
  });
  if (error) throwArabic(error, "تعذر تعديل رصيد المحفظة");
  return (data as string | null) ?? null;
}

export interface ProjectCreateRpcInput {
  workspaceId: string;
  name: string;
  description?: string;
  goalMinor?: number;
  colorToken?: ProjectSummary["colorToken"];
  projectType?: ProjectType;
  modules?: ProjectModules;
  openingCapitalMinor?: number;
  seedCategories?: ProjectCategorySeed[];
  clientId?: string;
}

export interface ProjectCreateResult {
  readonly id: string | null;
}

function parseCreatedProjectResult(data: unknown): ProjectCreateResult {
  const candidate = Array.isArray(data) ? data[0] : data;
  const rawId =
    typeof candidate === "string"
      ? candidate
      : candidate !== null &&
          typeof candidate === "object" &&
          "id" in candidate &&
          typeof candidate.id === "string"
        ? candidate.id
        : "";
  const id = rawId.trim();
  return { id: id || null };
}

export type LegacyProjectCreateRpcInput = ProjectCreateRpcInput & {
  projectType?: never;
  modules?: never;
  openingCapitalMinor?: never;
  seedCategories?: never;
};

export type IdentifiedProjectCreateRpcInput = ProjectCreateRpcInput & {
  clientId: string;
};

export function createProjectRpc(
  input: LegacyProjectCreateRpcInput,
): Promise<ProjectCreateResult>;
export function createProjectRpc(
  input: IdentifiedProjectCreateRpcInput,
): Promise<ProjectCreateResult>;
export async function createProjectRpc(
  input: ProjectCreateRpcInput,
): Promise<ProjectCreateResult> {
  const supabase = getSupabaseClient();
  const isBlueprintRequest =
    input.projectType !== undefined ||
    input.modules !== undefined ||
    input.openingCapitalMinor !== undefined ||
    input.seedCategories !== undefined;
  if (isBlueprintRequest) {
    const projectType = normalizeProjectType(input.projectType);
    const modules = normalizeProjectModules(input.modules, projectType);
    const { data, error } = await supabase.rpc("create_project", {
      p_workspace_id: input.workspaceId,
      p_name: input.name,
      p_project_type: projectType,
      p_modules: { ...modules },
      p_description: input.description ?? null,
      p_goal_minor: input.goalMinor ?? null,
      p_color_token: input.colorToken ?? "primary",
      p_client_id: requireClientId(input.clientId),
      p_opening_capital_minor: input.openingCapitalMinor ?? null,
      p_seed_categories:
        input.seedCategories?.map((category) => ({ ...category })) ?? null,
    });
    if (error) throwArabic(error, "تعذر إنشاء المشروع");
    return parseCreatedProjectResult(data);
  }

  const { data, error } = await supabase.rpc("create_project", {
    p_workspace_id: input.workspaceId,
    p_name: input.name,
    p_description: input.description ?? null,
    p_goal_minor: input.goalMinor ?? null,
    p_color_token: input.colorToken ?? "primary",
    ...(input.clientId !== undefined
      ? { p_client_id: input.clientId }
      : {}),
  });
  if (error) throwArabic(error, "تعذر إنشاء المشروع");
  return parseCreatedProjectResult(data);
}

export async function updateProjectRpc(input: {
  workspaceId: string;
  projectId: string;
  projectType: ProjectType;
  modules: ProjectModules;
  name?: string;
  description?: string;
  goalMinor?: number;
  colorToken?: ProjectSummary["colorToken"];
  status?: ProjectSummary["status"];
  clearGoal?: boolean;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const projectType = normalizeProjectType(input.projectType);
  const modules = normalizeProjectModules(input.modules, projectType);
  const { data, error } = await supabase.rpc("update_project", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_project_type: projectType,
    p_modules: { ...modules },
    p_name: input.name ?? null,
    p_description: input.description ?? null,
    p_goal_minor: input.goalMinor ?? null,
    p_color_token: input.colorToken ?? null,
    p_status: input.status ?? null,
    p_clear_goal: input.clearGoal ?? false,
  });
  if (error) throwArabic(error, "تعذر تحديث إعدادات المشروع");
  return data;
}

export async function postCapitalEntry(input: {
  workspaceId: string;
  projectId: string;
  entryType: CapitalEntryType;
  amountMinor: number;
  currencyCode?: string;
  note?: string;
  occurredOn?: string;
  clientId: string;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("post_capital_entry", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_entry_type: input.entryType,
    p_amount_minor: input.amountMinor,
    p_currency_code: input.currencyCode ?? null,
    p_note: input.note ?? null,
    p_occurred_on:
      input.occurredOn ?? new Date().toISOString().slice(0, 10),
    p_client_id: requireClientId(input.clientId),
  });
  if (error) throwArabic(error, "تعذر تسجيل حركة رأس المال");
  return data;
}

export async function upsertInventoryItem(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  quantity: number;
  unitLabel: string;
  currencyCode: string;
  unitCostMinor?: number;
  itemId?: string;
  barcode?: string | null;
  locationId?: string | null;
}): Promise<unknown> {
  // The migration exposes no client-id argument here. Its advisory lock plus
  // item-id/active-name upsert makes retrying the same desired state safe.
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_inventory_item", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_item_id: input.itemId ?? null,
    p_name: input.name,
    p_quantity: input.quantity,
    p_unit_label: input.unitLabel,
    p_unit_cost_minor: input.unitCostMinor ?? null,
    p_currency_code: input.currencyCode,
    p_barcode: input.barcode ?? null,
    p_location_id: input.locationId ?? null,
  });
  if (error) throwArabic(error, "تعذر حفظ صنف المخزون");
  return data;
}

export async function archiveInventoryItem(input: {
  workspaceId: string;
  projectId: string;
  itemId: string;
}): Promise<unknown> {
  // Archiving is a desired-state operation and returns an already archived row
  // on retry; the SQL signature intentionally has no client-id argument.
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("archive_inventory_item", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_item_id: input.itemId,
  });
  if (error) throwArabic(error, "تعذر أرشفة صنف المخزون");
  return data;
}

export async function createWorkerRpc(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  dailyWageMinor: number;
  phone?: string;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_project_worker", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_name: input.name,
    p_daily_wage_minor: input.dailyWageMinor,
    p_phone: input.phone ?? null,
  });
  if (error) throwArabic(error, "تعذر إضافة العامل");
  return data;
}

export async function recordDailyWorkRpc(input: {
  workspaceId: string;
  projectId: string;
  workerId: string;
  workDate: string;
  amountMinor?: number;
  note?: string;
  clientId: string;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("record_daily_work", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_worker_id: input.workerId,
    p_work_date: input.workDate,
    p_amount_minor: input.amountMinor ?? null,
    p_note: input.note ?? null,
    p_client_id: input.clientId,
  });
  if (error) throwArabic(error, "تعذر تسجيل يوم العمل");
  return data;
}

export async function postWageMovementRpc(input: {
  workspaceId: string;
  projectId: string;
  workerId: string;
  entryType: "bonus" | "deduction" | "withdrawal" | "adjustment";
  amountMinor: number;
  workDate?: string;
  walletId?: string;
  note?: string;
  clientId: string;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("post_wage_movement", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_worker_id: input.workerId,
    p_entry_type: input.entryType,
    p_amount_minor: input.amountMinor,
    p_work_date: input.workDate ?? new Date().toISOString().slice(0, 10),
    p_wallet_id: input.walletId ?? null,
    p_note: input.note ?? null,
    p_client_id: input.clientId,
  });
  if (error) throwArabic(error, "تعذر تسجيل حركة الأجر");
  return data;
}

export async function refreshOperationalNotificationsRpc(
  workspaceId: string,
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "refresh_operational_notifications",
    {
      p_workspace_id: workspaceId,
    },
  );
  if (error) throwArabic(error, "تعذر تحديث التنبيهات التشغيلية");
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function createWorkspaceInviteRpc(input: {
  workspaceId: string;
  email: string;
  role: "admin" | "member" | "viewer";
  clientId?: string;
}): Promise<{ token: string; email: string; role: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_workspace_invite", {
    p_workspace_id: input.workspaceId,
    p_email: input.email,
    p_role: input.role,
    p_client_id: input.clientId ?? null,
  });
  if (error) throwArabic(error, "تعذر إنشاء دعوة العضو");
  const row = data as unknown as { token: string; email: string; role: string };
  return { token: row.token, email: row.email, role: row.role };
}

export async function acceptWorkspaceInviteRpc(input: {
  token: string;
  clientId?: string;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("accept_workspace_invite", {
    p_token: input.token,
    p_client_id: input.clientId ?? null,
  });
  if (error) throwArabic(error, "تعذر قبول الدعوة");
  return data;
}

export async function upsertWorkspaceGoalRpc(input: {
  workspaceId: string;
  monthKey: string;
  incomeGoalMinor: number;
  currencyCode: string;
  note?: string;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_workspace_goal", {
    p_workspace_id: input.workspaceId,
    p_month_key: input.monthKey,
    p_income_goal_minor: input.incomeGoalMinor,
    p_currency_code: input.currencyCode,
    p_note: input.note ?? null,
  });
  if (error) throwArabic(error, "تعذر حفظ الهدف الشهري");
  return data;
}

export async function fetchWorkspaceGoal(
  workspaceId: string,
  monthKey?: string,
): Promise<WorkspaceGoal | null> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("workspace_goals")
    .select("*")
    .eq("workspace_id", workspaceId);
  if (monthKey) {
    query = query.eq("month_key", monthKey);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throwArabic(error, "تعذر تحميل الهدف الشهري");
  return data ? mapWorkspaceGoal(data) : null;
}

export async function fetchFinancialEventAttachments(
  workspaceId: string,
  eventId: string,
): Promise<FinancialEventAttachment[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("financial_event_attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("financial_event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throwArabic(error, "تعذر تحميل المرفقات");
  return (data ?? []).map(mapFinancialEventAttachment);
}

export async function attachFinancialEventProofRpc(input: {
  workspaceId: string;
  eventId: string;
  objectPath: string;
  fileName: string;
  contentType: string;
  byteSize: number;
}): Promise<FinancialEventAttachment> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("attach_financial_event_proof", {
    p_workspace_id: input.workspaceId,
    p_event_id: input.eventId,
    p_object_path: input.objectPath,
    p_file_name: input.fileName,
    p_content_type: input.contentType,
    p_byte_size: input.byteSize,
  });
  if (error) throwArabic(error, "تعذر ربط المرفق بالمعاملة");
  return mapFinancialEventAttachment(
    data as unknown as Parameters<typeof mapFinancialEventAttachment>[0],
  );
}

export async function uploadFinancialEventAttachment(input: {
  workspaceId: string;
  eventId: string;
  file: File;
}): Promise<FinancialEventAttachment> {
  const supabase = getSupabaseClient();
  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const objectPath = `${input.workspaceId}/${input.eventId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("event-attachments")
    .upload(objectPath, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    throwArabic(uploadError, "تعذر رفع المرفق");
  }
  return attachFinancialEventProofRpc({
    workspaceId: input.workspaceId,
    eventId: input.eventId,
    objectPath,
    fileName: input.file.name.slice(0, 180),
    contentType: input.file.type || "application/octet-stream",
    byteSize: input.file.size,
  });
}

export async function fetchInventoryLocations(
  workspaceId: string,
  projectId: string,
): Promise<InventoryLocation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_inventory_locations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("name");
  if (error) throwArabic(error, "تعذر تحميل مواقع المخزون");
  return (data ?? []).map(mapInventoryLocation);
}

export async function createInventoryLocationRpc(input: {
  workspaceId: string;
  projectId: string;
  name: string;
}): Promise<InventoryLocation> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_inventory_location", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_name: input.name,
  });
  if (error) throwArabic(error, "تعذر إنشاء موقع المخزون");
  return mapInventoryLocation(
    data as unknown as Parameters<typeof mapInventoryLocation>[0],
  );
}

export async function fetchInventoryMovements(
  workspaceId: string,
  projectId: string,
): Promise<InventoryMovement[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_inventory_movements")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throwArabic(error, "تعذر تحميل حركات المخزون");
  return (data ?? []).map(mapInventoryMovement);
}

export async function postInventoryMovementRpc(input: {
  workspaceId: string;
  projectId: string;
  itemId: string;
  movementType: InventoryMovementType;
  quantity: number;
  clientId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  note?: string | null;
  occurredOn?: string | null;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("post_inventory_movement", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_item_id: input.itemId,
    p_movement_type: input.movementType,
    p_quantity: input.quantity,
    p_client_id: requireClientId(input.clientId),
    p_from_location_id: input.fromLocationId ?? null,
    p_to_location_id: input.toLocationId ?? null,
    p_note: input.note ?? null,
    p_occurred_on: input.occurredOn ?? null,
  });
  if (error) throwArabic(error, "تعذر تسجيل حركة المخزون");
  return data;
}

export async function fetchLivestockBatches(
  workspaceId: string,
  projectId: string,
): Promise<LivestockBatch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("livestock_batches")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throwArabic(error, "تعذر تحميل دفعات الحيوانات");
  return (data ?? []).map(mapLivestockBatch);
}

export async function fetchLivestockEvents(
  workspaceId: string,
  projectId: string,
): Promise<LivestockEvent[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("livestock_events")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throwArabic(error, "تعذر تحميل أحداث الحيوانات");
  return (data ?? []).map(mapLivestockEvent);
}

export async function createLivestockBatchRpc(input: {
  workspaceId: string;
  projectId: string;
  name: string;
  headCount?: number;
  species?: string | null;
  note?: string | null;
  clientId?: string | null;
}): Promise<LivestockBatch> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_livestock_batch", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_name: input.name,
    p_head_count: input.headCount ?? 0,
    p_species: input.species ?? null,
    p_note: input.note ?? null,
    p_client_id: input.clientId ?? null,
  });
  if (error) throwArabic(error, "تعذر إنشاء دفعة الحيوانات");
  return mapLivestockBatch(
    data as unknown as Parameters<typeof mapLivestockBatch>[0],
  );
}

export async function postLivestockEventRpc(input: {
  workspaceId: string;
  projectId: string;
  batchId: string;
  eventType: LivestockEventType;
  quantity: number;
  clientId: string;
  note?: string | null;
  occurredOn?: string | null;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("post_livestock_event", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_batch_id: input.batchId,
    p_event_type: input.eventType,
    p_quantity: input.quantity,
    p_client_id: requireClientId(input.clientId),
    p_note: input.note ?? null,
    p_occurred_on: input.occurredOn ?? null,
  });
  if (error) throwArabic(error, "تعذر تسجيل حدث الحيوانات");
  return data;
}

export async function setProjectParentRpc(input: {
  workspaceId: string;
  projectId: string;
  parentProjectId: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("projects")
    .update({ parent_project_id: input.parentProjectId })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.projectId);
  if (error) throwArabic(error, "تعذر تحديث المشروع الأب");
}

export async function fetchProjectMembers(
  workspaceId: string,
  projectId: string,
): Promise<ProjectMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throwArabic(error, "تعذر تحميل أعضاء المشروع");
  return (data ?? []).map(mapProjectMember);
}

export async function upsertProjectMemberRpc(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  role: ProjectMemberRole;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("upsert_project_member", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_user_id: input.userId,
    p_role: input.role,
  });
  if (error) throwArabic(error, "تعذر حفظ عضو المشروع");
  return data;
}

export async function fetchWorkspaceAchievementUnlocks(
  workspaceId: string,
): Promise<AchievementUnlock[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("workspace_achievement_unlocks")
    .select("achievement_id, unlocked_at")
    .eq("workspace_id", workspaceId);
  if (error) throwArabic(error, "تعذر تحميل إنجازات المساحة");
  return (data ?? []).map((row) => ({
    achievementId: row.achievement_id,
    unlockedAt: row.unlocked_at,
  }));
}

export async function fetchProjectAchievementUnlocks(
  workspaceId: string,
  projectId: string,
): Promise<AchievementUnlock[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_achievement_unlocks")
    .select("achievement_id, unlocked_at, project_id")
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId);
  if (error) throwArabic(error, "تعذر تحميل إنجازات المشروع");
  return (data ?? []).map((row) => ({
    achievementId: row.achievement_id,
    unlockedAt: row.unlocked_at,
    projectId: row.project_id,
  }));
}

export async function unlockWorkspaceAchievementRpc(input: {
  workspaceId: string;
  achievementId: string;
  evidence?: Json;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("unlock_workspace_achievement", {
    p_workspace_id: input.workspaceId,
    p_achievement_id: input.achievementId,
    p_evidence: input.evidence ?? {},
  });
  if (error) throwArabic(error, "تعذر تسجيل إنجاز المساحة");
  return data;
}

export async function unlockProjectAchievementRpc(input: {
  workspaceId: string;
  projectId: string;
  achievementId: string;
  evidence?: Json;
}): Promise<unknown> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("unlock_project_achievement", {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_achievement_id: input.achievementId,
    p_evidence: input.evidence ?? {},
  });
  if (error) throwArabic(error, "تعذر تسجيل إنجاز المشروع");
  return data;
}

export async function fetchWorkspaceMemberOptions(
  workspaceId: string,
): Promise<Array<{ userId: string; displayName: string | null; email: string | null }>> {
  const supabase = getSupabaseClient();
  const { data: members, error } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");
  if (error) throwArabic(error, "تعذر تحميل أعضاء المساحة");
  const userIds = (members ?? []).map((row) => row.user_id);
  if (userIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);
  if (profilesError) throwArabic(profilesError, "تعذر تحميل أسماء الأعضاء");
  const names = new Map(
    (profiles ?? []).map((row) => [row.id, row.display_name] as const),
  );
  return userIds.map((userId) => ({
    userId,
    displayName: names.get(userId) ?? null,
    email: null,
  }));
}
