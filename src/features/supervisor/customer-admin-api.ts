import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";
import type {
  CreateCustomerInput,
  SupervisorCustomerRow,
} from "./customer-admin-types";

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

export function mapCustomerRow(raw: unknown): SupervisorCustomerRow {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    userId: asString(row.user_id),
    email: asString(row.email),
    displayName: asNullableString(row.display_name),
    accountStatus: asString(row.account_status, "active") as SupervisorCustomerRow["accountStatus"],
    lastSignInAt: asNullableString(row.last_sign_in_at),
    workspaceId: asString(row.workspace_id),
    workspaceName: asString(row.workspace_name),
    currencyCode: asString(row.default_currency_code ?? row.currency_code),
    workspaceStatus: asString(
      row.workspace_status,
      "active",
    ) as SupervisorCustomerRow["workspaceStatus"],
    subscriptionId: asString(row.subscription_id),
    subscriptionStatus: asString(
      row.subscription_status,
      "expired",
    ) as SupervisorCustomerRow["subscriptionStatus"],
    planId: asString(row.plan_id),
    planName: asString(row.plan_name),
    trialEndsAt: asNullableString(row.trial_ends_at),
    currentPeriodEndsAt: asNullableString(row.current_period_ends_at),
    scheduledStatus: (asNullableString(row.scheduled_status) as
      | "cancelled"
      | "expired"
      | null) ?? null,
    scheduledStatusAt: asNullableString(row.scheduled_status_at),
    effectiveSubscriptionStatus: asString(
      row.effective_subscription_status ?? row.subscription_status,
      "expired",
    ) as SupervisorCustomerRow["effectiveSubscriptionStatus"],
    pendingPayments: asNumber(row.pending_payments),
    createdAt: asString(row.created_at),
  };
}

export async function fetchCustomers(filters: {
  query?: string;
  accountStatus?: string;
  subscriptionStatus?: string;
  planId?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: SupervisorCustomerRow[]; total: number }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_list_customers", {
    p_query: filters.query?.trim() || null,
    p_account_status: (filters.accountStatus || null) as
      | "active"
      | "suspended"
      | "disabled"
      | null,
    p_subscription_status: (filters.subscriptionStatus || null) as
      | "trialing"
      | "active"
      | "grace"
      | "frozen"
      | "expired"
      | "cancelled"
      | null,
    p_plan_id: filters.planId || null,
    p_limit: filters.limit,
    p_offset: filters.offset,
  });

  if (error) throwIf(error, "تعذر تحميل العملاء");

  const payload = (data ?? {}) as { rows?: unknown; total?: unknown };
  const rows = Array.isArray(payload.rows) ? payload.rows.map(mapCustomerRow) : [];
  return {
    rows,
    total: asNumber(payload.total),
  };
}

export async function fetchCustomerDetail(
  userId: string,
): Promise<SupervisorCustomerRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("supervisor_get_customer", {
    p_user_id: userId,
  });

  if (error) throwIf(error, "تعذر تحميل تفاصيل العميل");
  if (!data) throw new Error("تعذر تحميل تفاصيل العميل");
  return mapCustomerRow(data);
}

export async function createCustomer(
  input: CreateCustomerInput,
): Promise<{ userId: string; temporaryPassword: string | null }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(
    "supervisor-customer-admin",
    {
      body: {
        action: "create_customer",
        email: input.email,
        displayName: input.displayName,
        workspaceName: input.workspaceName,
        currencyCode: input.currencyCode,
        planId: input.planId,
        subscriptionStatus: input.subscriptionStatus,
        startsAt: input.startsAt,
        trialEndsAt: input.trialEndsAt,
        currentPeriodEndsAt: input.currentPeriodEndsAt,
        deliveryMode: input.deliveryMode,
        note: input.note,
        clientId: input.clientId,
      },
    },
  );

  if (error) throwIf(error, "تعذر إنشاء العميل");

  const payload = (data ?? {}) as {
    error?: string;
    userId?: string;
    temporaryPassword?: string | null;
  };

  if (payload.error) {
    throwIf({ message: payload.error }, "تعذر إنشاء العميل");
  }

  if (!payload.userId) {
    throw new Error("تعذر إنشاء العميل");
  }

  return {
    userId: payload.userId,
    temporaryPassword: payload.temporaryPassword ?? null,
  };
}

export async function sendCustomerPasswordSetup(
  email: string,
  note: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(
    "supervisor-customer-admin",
    {
      body: {
        action: "send_password_setup",
        email,
        note,
      },
    },
  );

  if (error) throwIf(error, "تعذر إرسال رابط تعيين كلمة المرور");

  const payload = (data ?? {}) as { error?: string };
  if (payload.error) {
    throwIf({ message: payload.error }, "تعذر إرسال رابط تعيين كلمة المرور");
  }
}

export const customerAdminKeys = {
  all: ["supervisor", "customers"] as const,
  list: (filters: Record<string, unknown>) =>
    ["supervisor", "customers", "list", filters] as const,
  detail: (userId: string) =>
    ["supervisor", "customers", "detail", userId] as const,
};
