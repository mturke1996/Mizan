import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";
import type { Json } from "@/types/database";
import type {
  ActionInput,
  AdminPlan,
  BillingInterval,
  ChangePlanInput,
  CreatePlanInput,
  PlanSubscriptionCounts,
  RenewInput,
  ScheduledStateInput,
  StateInput,
  UpdatePlanInput,
} from "./customer-admin-types";

function throwIf(error: { message?: string } | null, fallback: string): never {
  throw new Error(getUserErrorMessage(error, fallback));
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asFeatures(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

const EMPTY_COUNTS: PlanSubscriptionCounts = {
  trialing: 0,
  active: 0,
  grace: 0,
  frozen: 0,
  expired: 0,
  cancelled: 0,
};

function mapSubscriptionCounts(raw: unknown): PlanSubscriptionCounts {
  const counts = (raw ?? {}) as Record<string, unknown>;
  return {
    trialing: asNumber(counts.trialing),
    active: asNumber(counts.active),
    grace: asNumber(counts.grace),
    frozen: asNumber(counts.frozen),
    expired: asNumber(counts.expired),
    cancelled: asNumber(counts.cancelled),
  };
}

export function mapAdminPlan(raw: unknown): AdminPlan {
  const row = (raw ?? {}) as Record<string, unknown>;
  const planId = asString(row.plan_id ?? row.id);
  return {
    planId,
    code: asString(row.code),
    name: asString(row.name),
    priceMinor: asNumber(row.price_minor),
    currencyCode: asString(row.currency_code),
    billingInterval: asString(
      row.billing_interval,
      "none",
    ) as BillingInterval,
    intervalCount:
      row.interval_count == null ? null : asNumber(row.interval_count),
    trialDays: asNumber(row.trial_days),
    isPublic: asBoolean(row.is_public),
    isActive: asBoolean(row.is_active, true),
    features: asFeatures(row.features),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    subscriptionCounts: row.subscription_counts
      ? mapSubscriptionCounts(row.subscription_counts)
      : { ...EMPTY_COUNTS },
  };
}

export async function fetchAdminPlans(
  includeArchived = true,
): Promise<AdminPlan[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_list_plans", {
    p_include_archived: includeArchived,
  });

  if (error) throwIf(error, "تعذر تحميل الخطط");

  const payload = (data ?? {}) as { rows?: unknown };
  const rows = Array.isArray(payload.rows) ? payload.rows.map(mapAdminPlan) : [];
  return rows;
}

export async function createPlan(input: CreatePlanInput): Promise<AdminPlan> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_create_plan", {
    p_code: input.code,
    p_name: input.name,
    p_price_minor: input.priceMinor,
    p_currency_code: input.currencyCode,
    p_billing_interval: input.billingInterval,
    p_interval_count: input.intervalCount,
    p_trial_days: input.trialDays,
    p_is_public: input.isPublic,
    p_features: input.features as Json,
    p_note: input.note,
    p_client_id: input.clientId,
  });

  if (error) throwIf(error, "تعذر إنشاء الخطة");
  if (!data) throw new Error("تعذر إنشاء الخطة");
  return mapAdminPlan(data);
}

export async function updatePlan(input: UpdatePlanInput): Promise<AdminPlan> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_update_plan", {
    p_plan_id: input.planId,
    p_name: input.name,
    p_price_minor: input.priceMinor,
    p_currency_code: input.currencyCode,
    p_billing_interval: input.billingInterval,
    p_interval_count: input.intervalCount,
    p_trial_days: input.trialDays,
    p_is_public: input.isPublic,
    p_features: input.features as Json,
    p_note: input.note,
    p_client_id: input.clientId,
  });

  if (error) throwIf(error, "تعذر تحديث الخطة");
  if (!data) throw new Error("تعذر تحديث الخطة");
  return mapAdminPlan(data);
}

export async function archivePlan(input: ActionInput): Promise<AdminPlan> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_archive_plan", {
    p_plan_id: input.planId,
    p_note: input.note,
    p_client_id: input.clientId,
  });

  if (error) throwIf(error, "تعذر أرشفة الخطة");
  if (!data) throw new Error("تعذر أرشفة الخطة");
  return mapAdminPlan(data);
}

export async function renewSubscription(input: RenewInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_renew_subscription", {
    p_workspace_id: input.workspaceId,
    p_period_count: input.periodCount,
    p_note: input.note,
    p_client_id: input.clientId,
  });

  if (error) throwIf(error, "تعذر تجديد الاشتراك");
}

export async function changeSubscriptionPlan(
  input: ChangePlanInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_change_subscription_plan", {
    p_workspace_id: input.workspaceId,
    p_plan_id: input.planId,
    p_note: input.note,
    p_client_id: input.clientId,
  });

  if (error) throwIf(error, "تعذر تغيير خطة الاشتراك");
}

export async function setSubscriptionState(input: StateInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("supervisor_set_subscription_state", {
    p_workspace_id: input.workspaceId,
    p_target_status: input.targetStatus,
    p_trial_ends_at: input.trialEndsAt,
    p_current_period_ends_at: input.currentPeriodEndsAt,
    p_grace_ends_at: input.graceEndsAt,
    p_note: input.note,
    p_client_id: input.clientId,
  });

  if (error) throwIf(error, "تعذر تحديث حالة الاشتراك");
}

export async function scheduleSubscriptionState(
  input: ScheduledStateInput,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc(
    "supervisor_schedule_subscription_state",
    {
      p_workspace_id: input.workspaceId,
      p_target_status: input.targetStatus,
      p_scheduled_at: input.scheduledAt,
      p_note: input.note,
      p_client_id: input.clientId,
    },
  );

  if (error) throwIf(error, "تعذر جدولة حالة الاشتراك");
}

export const billingAdminKeys = {
  plans: ["supervisor", "plans"] as const,
  plansActive: ["supervisor", "plans", "active"] as const,
};
