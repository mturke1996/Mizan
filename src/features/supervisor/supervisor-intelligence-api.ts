import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";

export interface RateMetric {
  value: number | null;
  sampleSize: number;
}

export interface OperationalMetrics {
  customers: {
    total: number;
    active: number;
    trialing: number;
    grace: number;
    frozen: number;
    expiring7d: number;
  };
  payments: {
    pending: number;
    approved: number;
    rejected: number;
    approvalRate: RateMetric;
    averageReviewMinutes: number | null;
  };
  trials: RateMetric;
}

export interface CurrencyRevenuePoint {
  bucketStart: string;
  currencyCode: string;
  approvedAmountMinor: number;
  approvedCount: number;
}

export interface PlanMixRow {
  planId: string;
  planName: string;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  frozenSubscriptions: number;
}

export interface ActionQueueItem {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  workspaceId: string;
  customerName: string;
  title: string;
  description: string;
  dueAt: string | null;
  href: string;
}

export type CampaignSegment =
  | "all_active"
  | "trialing"
  | "expiring_7d"
  | "grace"
  | "frozen";

export interface NotificationCampaign {
  id: string;
  segment: CampaignSegment;
  title: string;
  body: string;
  recipientCount: number;
  readCount: number;
  actorName: string | null;
  createdAt: string;
}

export interface CampaignSendResult {
  campaignId: string;
  segment: CampaignSegment;
  title: string;
  body: string;
  recipientCount: number;
}

export interface CustomerNotificationRow {
  id: string;
  workspaceId: string | null;
  kind: string;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface AuditEventRow {
  id: string;
  workspaceId: string | null;
  workspaceName: string | null;
  customerName: string | null;
  actorUserId: string | null;
  actorName: string | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditListFilters {
  query?: string;
  actionPrefix?: string;
  workspaceId?: string;
  actorUserId?: string;
  from?: string | null;
  to?: string | null;
  limit: number;
  offset: number;
}

export interface ControlLedgerEntry {
  entryId: string;
  entryType: string;
  title: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
}

export interface PaginatedRows<T> {
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

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asSeverity(value: unknown): ActionQueueItem["severity"] {
  const raw = asString(value, "info");
  if (raw === "critical" || raw === "warning" || raw === "info") return raw;
  return "info";
}

function asSegment(value: unknown): CampaignSegment {
  const raw = asString(value, "all_active");
  if (
    raw === "all_active" ||
    raw === "trialing" ||
    raw === "expiring_7d" ||
    raw === "grace" ||
    raw === "frozen"
  ) {
    return raw;
  }
  return "all_active";
}

export function formatRateMetric(rate: RateMetric): string {
  if (rate.value == null || rate.sampleSize <= 0) {
    return "بيانات غير كافية";
  }
  return `${new Intl.NumberFormat("ar-LY-u-nu-latn", {
    maximumFractionDigits: 1,
  }).format(rate.value)}%`;
}

export function mapOperationalMetrics(raw: unknown): OperationalMetrics {
  const payload = asRecord(raw);
  const customers = asRecord(payload.customers);
  const payments = asRecord(payload.payments);
  const trials = asRecord(payload.trials);

  return {
    customers: {
      total: asNumber(customers.total),
      active: asNumber(customers.active),
      trialing: asNumber(customers.trialing),
      grace: asNumber(customers.grace),
      frozen: asNumber(customers.frozen),
      expiring7d: asNumber(customers.expiring_7d),
    },
    payments: {
      pending: asNumber(payments.pending),
      approved: asNumber(payments.approved),
      rejected: asNumber(payments.rejected),
      approvalRate: {
        value: asNullableNumber(payments.approval_rate),
        sampleSize: asNumber(payments.approval_sample_size),
      },
      averageReviewMinutes: asNullableNumber(payments.average_review_minutes),
    },
    trials: {
      value: asNullableNumber(trials.conversion_rate),
      sampleSize: asNumber(trials.sample_size),
    },
  };
}

export function mapCurrencyRevenuePoint(raw: unknown): CurrencyRevenuePoint {
  const row = asRecord(raw);
  return {
    bucketStart: asString(row.bucket_start),
    currencyCode: asString(row.currency_code),
    approvedAmountMinor: asNumber(row.approved_amount_minor),
    approvedCount: asNumber(row.approved_count),
  };
}

export function mapPlanMixRow(raw: unknown): PlanMixRow {
  const row = asRecord(raw);
  return {
    planId: asString(row.plan_id),
    planName: asString(row.plan_name),
    activeSubscriptions: asNumber(row.active_subscriptions),
    trialingSubscriptions: asNumber(row.trialing_subscriptions),
    frozenSubscriptions: asNumber(row.frozen_subscriptions),
  };
}

export function mapActionQueueItem(raw: unknown): ActionQueueItem {
  const row = asRecord(raw);
  const rawHref = asString(row.action_href ?? row.href);
  return {
    id: asString(row.item_id ?? row.id),
    type: asString(row.item_type ?? row.type),
    severity: asSeverity(row.severity),
    workspaceId: asString(row.workspace_id),
    customerName: asString(row.customer_name),
    title: asString(row.title),
    description: asString(row.description),
    dueAt: asNullableString(row.due_at),
    href: normalizeActionHref(rawHref, asString(row.workspace_id)),
  };
}

/** Maps backend customer deep-links onto the customers list query shape. */
export function normalizeActionHref(
  href: string,
  workspaceId?: string,
): string {
  const customerPath = href.match(
    /^\/supervisor\/customers\/([0-9a-f-]{36})$/i,
  );
  if (customerPath) {
    return `/supervisor/customers?workspace=${customerPath[1]}`;
  }
  if (
    href === "/supervisor/customers" &&
    workspaceId &&
    /^[0-9a-f-]{36}$/i.test(workspaceId)
  ) {
    return `/supervisor/customers?workspace=${workspaceId}`;
  }
  return href;
}

export function mapNotificationCampaign(raw: unknown): NotificationCampaign {
  const row = asRecord(raw);
  return {
    id: asString(row.id),
    segment: asSegment(row.segment),
    title: asString(row.title),
    body: asString(row.body),
    recipientCount: asNumber(row.recipient_count),
    readCount: asNumber(row.read_count),
    actorName: asNullableString(row.actor_name),
    createdAt: asString(row.created_at),
  };
}

export function mapCampaignSendResult(raw: unknown): CampaignSendResult {
  const row = asRecord(raw);
  return {
    campaignId: asString(row.campaign_id),
    segment: asSegment(row.segment),
    title: asString(row.title),
    body: asString(row.body),
    recipientCount: asNumber(row.recipient_count),
  };
}

export function mapCustomerNotificationRow(
  raw: unknown,
): CustomerNotificationRow {
  const row = asRecord(raw);
  return {
    id: asString(row.id),
    workspaceId: asNullableString(row.workspace_id),
    kind: asString(row.kind),
    title: asString(row.title),
    body: asString(row.body),
    metadata: asRecord(row.metadata),
    readAt: asNullableString(row.read_at),
    createdAt: asString(row.created_at),
  };
}

export function mapAuditEventRow(raw: unknown): AuditEventRow {
  const row = asRecord(raw);
  return {
    id: asString(row.id),
    workspaceId: asNullableString(row.workspace_id),
    workspaceName: asNullableString(row.workspace_name),
    customerName: asNullableString(row.customer_name),
    actorUserId: asNullableString(row.actor_user_id),
    actorName: asNullableString(row.actor_name),
    action: asString(row.action),
    targetTable: asNullableString(row.target_table),
    targetId: asNullableString(row.target_id),
    metadata: asRecord(row.metadata),
    createdAt: asString(row.created_at),
  };
}

export function mapControlLedgerEntry(raw: unknown): ControlLedgerEntry {
  const row = asRecord(raw);
  return {
    entryId: asString(row.entry_id),
    entryType: asString(row.entry_type),
    title: asString(row.title),
    occurredAt: asString(row.occurred_at),
    actorUserId: asNullableString(row.actor_user_id),
    actorName: asNullableString(row.actor_name),
    metadata: asRecord(row.metadata),
  };
}

export function groupRevenueByCurrency(
  points: CurrencyRevenuePoint[],
): Map<string, CurrencyRevenuePoint[]> {
  const grouped = new Map<string, CurrencyRevenuePoint[]>();
  for (const point of points) {
    const list = grouped.get(point.currencyCode) ?? [];
    list.push(point);
    grouped.set(point.currencyCode, list);
  }
  return grouped;
}

export async function fetchOperationalMetrics(
  from: string,
  to: string,
): Promise<OperationalMetrics> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_operational_metrics", {
    p_from: from,
    p_to: to,
  });
  if (error) throwIf(error, "تعذر تحميل مؤشرات التشغيل");
  return mapOperationalMetrics(data);
}

export async function fetchRevenueSeries(input: {
  from: string;
  to: string;
  bucket?: "day" | "week" | "month";
}): Promise<CurrencyRevenuePoint[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_revenue_series", {
    p_from: input.from,
    p_to: input.to,
    p_bucket: input.bucket ?? "month",
  });
  if (error) throwIf(error, "تعذر تحميل سلسلة المدفوعات المعتمدة");
  return Array.isArray(data) ? data.map(mapCurrencyRevenuePoint) : [];
}

export async function fetchPlanMix(): Promise<PlanMixRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_plan_mix");
  if (error) throwIf(error, "تعذر تحميل توزيع الخطط");
  return Array.isArray(data) ? data.map(mapPlanMixRow) : [];
}

export async function fetchActionQueue(
  limit = 50,
): Promise<ActionQueueItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_action_queue", {
    p_limit: limit,
  });
  if (error) throwIf(error, "تعذر تحميل طابور القرارات");
  return Array.isArray(data) ? data.map(mapActionQueueItem) : [];
}

export async function sendNotificationCampaign(input: {
  segment: CampaignSegment;
  title: string;
  body: string;
  note: string;
  clientId: string;
}): Promise<CampaignSendResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "supervisor_send_notification_campaign",
    {
      p_segment: input.segment,
      p_title: input.title,
      p_body: input.body,
      p_note: input.note,
      p_client_id: input.clientId,
    },
  );
  if (error) throwIf(error, "تعذر إرسال الحملة");
  if (!data) throw new Error("تعذر إرسال الحملة");
  return mapCampaignSendResult(data);
}

export async function fetchNotificationCampaigns(
  limit = 50,
  offset = 0,
): Promise<NotificationCampaign[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "supervisor_list_notification_campaigns",
    {
      p_limit: limit,
      p_offset: offset,
    },
  );
  if (error) throwIf(error, "تعذر تحميل سجل الحملات");
  return Array.isArray(data) ? data.map(mapNotificationCampaign) : [];
}

export async function fetchCustomerNotifications(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedRows<CustomerNotificationRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "supervisor_list_customer_notifications",
    {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
    },
  );
  if (error) throwIf(error, "تعذر تحميل رسائل العميل");
  const payload = asRecord(data);
  const rows = Array.isArray(payload.rows)
    ? payload.rows.map(mapCustomerNotificationRow)
    : [];
  return { rows, total: asNumber(payload.total) };
}

export async function sendCustomerNotification(input: {
  userId: string;
  workspaceId: string | null;
  title: string;
  body: string;
  note: string;
  clientId: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_send_notification", {
    p_user_id: input.userId,
    p_workspace_id: input.workspaceId,
    p_kind: "system",
    p_title: input.title,
    p_body: input.body,
    p_metadata: {},
    p_note: input.note,
    p_client_id: input.clientId,
  });
  if (error) throwIf(error, "تعذر إرسال الرسالة");
}

export async function fetchAuditEvents(
  filters: AuditListFilters,
): Promise<PaginatedRows<AuditEventRow>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_list_audit_events", {
    p_query: filters.query?.trim() || null,
    p_action_prefix: filters.actionPrefix?.trim() || null,
    p_workspace_id: filters.workspaceId || null,
    p_actor_user_id: filters.actorUserId || null,
    p_from: filters.from || null,
    p_to: filters.to || null,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });
  if (error) throwIf(error, "تعذر تحميل سجل التدقيق");
  const payload = asRecord(data);
  const rows = Array.isArray(payload.rows)
    ? payload.rows.map(mapAuditEventRow)
    : [];
  return { rows, total: asNumber(payload.total) };
}

export async function fetchCustomerControlLedger(
  workspaceId: string,
  limit = 20,
  offset = 0,
): Promise<PaginatedRows<ControlLedgerEntry>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "supervisor_customer_control_ledger",
    {
      p_workspace_id: workspaceId,
      p_limit: limit,
      p_offset: offset,
    },
  );
  if (error) throwIf(error, "تعذر تحميل سجل القرارات");
  const payload = asRecord(data);
  const rows = Array.isArray(payload.rows)
    ? payload.rows.map(mapControlLedgerEntry)
    : [];
  return { rows, total: asNumber(payload.total) };
}

export const intelligenceKeys = {
  all: ["supervisor", "intelligence"] as const,
  operations: (from: string, to: string) =>
    [...intelligenceKeys.all, "operations", from, to] as const,
  revenue: (from: string, to: string, bucket: string) =>
    [...intelligenceKeys.all, "revenue", from, to, bucket] as const,
  planMix: [...(["supervisor", "intelligence", "planMix"] as const)],
  actionQueue: [...(["supervisor", "intelligence", "actionQueue"] as const)],
  campaigns: (page: number) =>
    [...intelligenceKeys.all, "campaigns", page] as const,
  audit: (filters: Record<string, unknown>) =>
    [...intelligenceKeys.all, "audit", filters] as const,
  customerLedger: (workspaceId: string, page: number) =>
    [...intelligenceKeys.all, "customerLedger", workspaceId, page] as const,
  customerNotifications: (userId: string, page: number) =>
    [
      ...intelligenceKeys.all,
      "customerNotifications",
      userId,
      page,
    ] as const,
};
