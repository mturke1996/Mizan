import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";

export interface PlatformStats {
  total_workspaces: number;
  total_users: number;
  trialing_count: number;
  active_count: number;
  frozen_count: number;
  churned_count: number;
  pending_payments: number;
  pending_amount_minor: string;
  suspended_users: number;
}

export interface WorkspaceOverview {
  workspace_id: string;
  workspace_name: string;
  owner_user_id: string | null;
  owner_display_name: string | null;
  owner_account_status: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_ends_at: string | null;
  plan_name: string | null;
  pending_payments: number;
  workspace_created_at?: string;
}

export interface PaymentRequestRow {
  id: string;
  workspaceId: string;
  workspaceName: string;
  requesterName: string | null;
  planId: string;
  planName: string;
  periodCount: number;
  amountMinor: number;
  currencyCode: string;
  status: "pending" | "approved" | "rejected";
  requesterNote: string | null;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  proofObjectPath: string | null;
  createdAt: string;
}

export interface PaymentListFilters {
  status?: "pending" | "approved" | "rejected" | null;
  query?: string;
  planId?: string;
  currencyCode?: string;
  from?: string | null;
  to?: string | null;
  limit: number;
  offset: number;
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

export function mapPaymentRequestRow(raw: unknown): PaymentRequestRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asString(row.payment_request_id ?? row.id),
    workspaceId: asString(row.workspace_id),
    workspaceName: asString(row.workspace_name),
    requesterName: asNullableString(row.display_name ?? row.requester_name),
    planId: asString(row.plan_id),
    planName: asString(row.plan_name),
    periodCount: asNumber(row.period_count, 1),
    amountMinor: asNumber(row.amount_minor),
    currencyCode: asString(row.currency_code),
    status: asString(row.status, "pending") as PaymentRequestRow["status"],
    requesterNote: asNullableString(row.requester_note),
    reviewNote: asNullableString(row.review_note),
    reviewedByName: asNullableString(
      row.reviewer_display_name ?? row.reviewed_by_name,
    ),
    reviewedAt: asNullableString(row.reviewed_at),
    proofObjectPath: asNullableString(row.proof_object_path),
    createdAt: asString(row.created_at),
  };
}

export interface UserDirectoryRow {
  user_id: string;
  display_name: string | null;
  account_status: string;
  system_role: string;
  created_at: string;
  workspace_id: string | null;
  workspace_name: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
}

export interface ActivityRow {
  id: string;
  workspace_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

function throwIf(error: { message?: string } | null, fallback: string): never {
  throw new Error(getUserErrorMessage(error, fallback));
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("supervisor_platform_stats")
    .select("*")
    .single();
  if (error) throwIf(error, "تعذر تحميل إحصائيات المنصة");
  return data as PlatformStats;
}

export async function fetchWorkspaceOverview(): Promise<WorkspaceOverview[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("supervisor_workspace_overview")
    .select("*")
    .order("workspace_created_at", { ascending: false });
  if (error) throwIf(error, "تعذر تحميل المساحات");
  return (data ?? []) as WorkspaceOverview[];
}

export async function fetchPayments(
  filters: PaymentListFilters,
): Promise<{ rows: PaymentRequestRow[]; total: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_list_payments", {
    p_status: filters.status ?? null,
    p_query: filters.query?.trim() || null,
    p_plan_id: filters.planId || null,
    p_currency_code: filters.currencyCode || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });

  if (error) throwIf(error, "تعذر تحميل طلبات الدفع");

  const payload = (data ?? {}) as { rows?: unknown; total?: unknown };
  const rows = Array.isArray(payload.rows)
    ? payload.rows.map(mapPaymentRequestRow)
    : [];
  return {
    rows,
    total: asNumber(payload.total),
  };
}

export async function fetchPendingPayments(): Promise<PaymentRequestRow[]> {
  const result = await fetchPayments({
    status: "pending",
    limit: 100,
    offset: 0,
  });
  return result.rows;
}

export async function createPaymentProofUrl(objectPath: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(objectPath, 60);
  if (error) throwIf(error, "تعذر فتح إثبات الدفع");
  if (!data?.signedUrl) throw new Error("تعذر إنشاء رابط إثبات الدفع");
  return data.signedUrl;
}

export async function fetchUserDirectory(): Promise<UserDirectoryRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("supervisor_user_directory")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throwIf(error, "تعذر تحميل المستخدمين");
  return (data ?? []) as UserDirectoryRow[];
}

export async function fetchRecentActivity(): Promise<ActivityRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("subscription_events")
    .select(
      "id, workspace_id, event_type, from_status, to_status, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throwIf(error, "تعذر تحميل السجل");
  return (data ?? []) as ActivityRow[];
}

export async function supervisorFreeze(workspaceId: string, note?: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_freeze_workspace", {
    p_workspace_id: workspaceId,
    p_note: note ?? null,
  });
  if (error) throwIf(error, "تعذر التجميد");
}

export async function supervisorUnfreeze(workspaceId: string, note?: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_unfreeze_workspace", {
    p_workspace_id: workspaceId,
    p_note: note ?? null,
  });
  if (error) throwIf(error, "تعذر إلغاء التجميد");
}

export async function supervisorExtendTrial(
  workspaceId: string,
  extraDays: number,
  note?: string,
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_extend_trial", {
    p_workspace_id: workspaceId,
    p_extra_days: extraDays,
    p_note: note ?? null,
  });
  if (error) throwIf(error, "تعذر تمديد التجربة");
}

export async function supervisorSetAccountStatus(
  userId: string,
  status: "active" | "suspended" | "disabled",
  note?: string,
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_set_account_status", {
    p_user_id: userId,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) throwIf(error, "تعذر تحديث حالة الحساب");
}

export async function reviewPayment(
  paymentRequestId: string,
  decision: "approve" | "reject",
  reviewNote?: string,
) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("review_payment_request", {
    p_payment_request_id: paymentRequestId,
    p_decision: decision,
    p_review_note: reviewNote ?? null,
  });
  if (error) throwIf(error, "تعذر مراجعة الدفع");
}

export const supervisorKeys = {
  stats: ["supervisor", "stats"] as const,
  workspaces: ["supervisor", "workspaces"] as const,
  payments: ["supervisor", "payments"] as const,
  paymentsList: (filters: Record<string, unknown>) =>
    ["supervisor", "payments", "list", filters] as const,
  users: ["supervisor", "users"] as const,
  activity: ["supervisor", "activity"] as const,
};

export function invalidateSupervisor(queryClient: {
  invalidateQueries: (input: { queryKey: readonly string[] }) => Promise<void>;
}) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: supervisorKeys.stats }),
    queryClient.invalidateQueries({ queryKey: supervisorKeys.workspaces }),
    queryClient.invalidateQueries({ queryKey: supervisorKeys.payments }),
    queryClient.invalidateQueries({ queryKey: supervisorKeys.users }),
    queryClient.invalidateQueries({ queryKey: supervisorKeys.activity }),
    queryClient.invalidateQueries({ queryKey: ["supervisor", "customers"] }),
    queryClient.invalidateQueries({ queryKey: ["supervisor", "plans"] }),
  ]);
}
