import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";
import type { Tables } from "@/types/database";

export type SubscriptionPlan = Pick<
  Tables<"subscription_plans">,
  | "id"
  | "code"
  | "name"
  | "price_minor"
  | "currency_code"
  | "billing_interval"
  | "interval_count"
  | "features"
>;

export type WorkspaceSubscription = Tables<"workspace_subscriptions">;
export type PaymentRequest = Tables<"payment_requests">;

export interface SubscriptionSummary {
  subscription: WorkspaceSubscription | null;
  currentPlan: SubscriptionPlan | null;
  availablePlans: SubscriptionPlan[];
  requests: PaymentRequest[];
}

const paymentProofTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;

function throwArabic(error: { message?: string } | null, fallback: string): never {
  throw new Error(getUserErrorMessage(error, fallback));
}

export function validatePaymentProof(file: File): string | null {
  if (!(file.type in paymentProofTypes)) {
    return "اختر صورة JPG أو PNG أو ملف PDF";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "حجم إثبات الدفع يجب ألا يتجاوز 10 ميجابايت";
  }
  return null;
}

export async function updateOwnProfile(input: {
  userId: string;
  displayName: string;
  timezone: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.displayName.trim(),
      timezone: input.timezone,
    })
    .eq("id", input.userId);

  if (error) throwArabic(error, "تعذر تحديث الملف الشخصي");
}

export async function fetchSubscriptionSummary(
  workspaceId: string,
): Promise<SubscriptionSummary> {
  const supabase = getSupabaseClient();
  const [subscriptionResult, plansResult, requestsResult] = await Promise.all([
    supabase
      .from("workspace_subscriptions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("subscription_plans")
      .select(
        "id, code, name, price_minor, currency_code, billing_interval, interval_count, features",
      )
      .eq("is_active", true)
      .eq("is_public", true)
      .order("price_minor", { ascending: true }),
    supabase
      .from("payment_requests")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (subscriptionResult.error) {
    throwArabic(subscriptionResult.error, "تعذر تحميل حالة الاشتراك");
  }
  if (plansResult.error) {
    throwArabic(plansResult.error, "تعذر تحميل خطط الاشتراك");
  }
  if (requestsResult.error) {
    throwArabic(requestsResult.error, "تعذر تحميل طلبات الدفع");
  }

  const availablePlans = (plansResult.data ?? []) as SubscriptionPlan[];
  const subscription =
    (subscriptionResult.data as WorkspaceSubscription | null) ?? null;

  return {
    subscription,
    currentPlan:
      availablePlans.find((plan) => plan.id === subscription?.plan_id) ?? null,
    availablePlans,
    requests: (requestsResult.data ?? []) as PaymentRequest[],
  };
}

async function uploadAndAttachPaymentProof(input: {
  workspaceId: string;
  requestId: string;
  file: File;
}): Promise<void> {
  const validationError = validatePaymentProof(input.file);
  if (validationError) throw new Error(validationError);

  const supabase = getSupabaseClient();
  const extension =
    paymentProofTypes[input.file.type as keyof typeof paymentProofTypes];
  const objectPath = `${input.workspaceId}/${input.requestId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(objectPath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) {
    throwArabic(uploadError, "تعذر رفع إثبات الدفع");
  }

  const { error: attachError } = await supabase.rpc("attach_payment_proof", {
    p_payment_request_id: input.requestId,
    p_object_path: objectPath,
  });

  if (attachError) {
    await supabase.storage.from("payment-proofs").remove([objectPath]);
    throwArabic(attachError, "تعذر ربط إثبات الدفع بالطلب");
  }
}

export async function createPaymentRequestWithProof(input: {
  workspaceId: string;
  planId: string;
  periodCount: number;
  note?: string;
  file: File;
}): Promise<string> {
  const validationError = validatePaymentProof(input.file);
  if (validationError) throw new Error(validationError);

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("create_payment_request", {
    p_workspace_id: input.workspaceId,
    p_client_id: crypto.randomUUID(),
    p_plan_id: input.planId,
    p_period_count: input.periodCount,
    p_requester_note: input.note?.trim() || null,
  });

  if (error) throwArabic(error, "تعذر إنشاء طلب الدفع");
  const requestId = data as string;
  await uploadAndAttachPaymentProof({
    workspaceId: input.workspaceId,
    requestId,
    file: input.file,
  });
  return requestId;
}

export async function attachPaymentProof(input: {
  workspaceId: string;
  requestId: string;
  file: File;
}): Promise<void> {
  await uploadAndAttachPaymentProof(input);
}
