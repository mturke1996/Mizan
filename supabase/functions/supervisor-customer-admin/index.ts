/**
 * Supervisor customer admin edge function.
 *
 * Security (approved redesign):
 * 1. JWT-scoped client calls supervisor_prepare_customer_onboarding → intent UUID
 * 2. Same client calls supervisor_issue_customer_onboarding_capability → one-time plaintext capability
 * 3. Service-role admin.createUser puts capability ONLY in app_metadata.mizan_onboarding_capability
 * 4. Never use inviteUserByEmail (cannot set app_metadata)
 * 5. On Auth failure after prepare/issue, cancel via supervisor_cancel_customer_onboarding
 *
 * generateLink({ type: "recovery" }) is used for invite / password_setup_email.
 * It returns an action link; whether Supabase Authemails that link depends on project
 * email configuration. This function does not return the link in the API response.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.110.2";

export type DeliveryMode =
  | "invite"
  | "temporary_password"
  | "password_setup_email";

export type CreateCustomerRequest = {
  action: "create_customer";
  email: string;
  displayName: string;
  workspaceName: string;
  currencyCode: string;
  planId: string;
  subscriptionStatus: "trialing" | "active";
  startsAt: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  deliveryMode: DeliveryMode;
  note: string;
  clientId: string;
};

export type SendPasswordSetupRequest = {
  action: "send_password_setup";
  email: string;
  note: string;
};

export type AdminAction = CreateCustomerRequest | SendPasswordSetupRequest;

export type EnvReader = (key: string) => string | undefined;

export type UserClientFactory = (args: {
  url: string;
  anonKey: string;
  accessToken: string;
}) => SupabaseClient;

export type AdminClientFactory = (args: {
  url: string;
  serviceRoleKey: string;
}) => SupabaseClient;

export type HandlerDeps = {
  getEnv?: EnvReader;
  createUserClient?: UserClientFactory;
  createAdminClient?: AdminClientFactory;
  randomUuid?: () => string;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DELIVERY_MODES = new Set<DeliveryMode>([
  "invite",
  "temporary_password",
  "password_setup_email",
]);

const SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

function defaultGetEnv(key: string): string | undefined {
  return Deno.env.get(key);
}

function defaultCreateUserClient(args: {
  url: string;
  anonKey: string;
  accessToken: string;
}): SupabaseClient {
  return createClient(args.url, args.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function defaultCreateAdminClient(args: {
  url: string;
  serviceRoleKey: string;
}): SupabaseClient {
  return createClient(args.url, args.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ??
    req.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token || null;
}

function resolveAppOrigin(req: Request, getEnv: EnvReader): string {
  const fromEnv = getEnv("APP_ORIGIN")?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromSite = getEnv("SITE_URL")?.trim();
  if (fromSite) return fromSite.replace(/\/$/, "");
  const fromOrigin = req.headers.get("Origin")?.trim();
  if (fromOrigin) return fromOrigin.replace(/\/$/, "");
  return "http://localhost:5173";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function mapRpcError(message: string | undefined): {
  status: number;
  error: string;
} {
  const key = (message ?? "").trim().toLowerCase();
  if (key === "forbidden" || key.includes("permission denied")) {
    return { status: 403, error: "forbidden" };
  }
  if (
    key === "authentication_required" ||
    key.includes("jwt") ||
    key.includes("not authenticated")
  ) {
    return { status: 401, error: "authentication_required" };
  }
  if (
    key === "idempotency_conflict" ||
    key === "onboarding_intent_conflict" ||
    key === "onboarding_intent_expired" ||
    key === "onboarding_user_exists" ||
    key === "inactive_plan" ||
    key === "invalid_subscription_transition" ||
    key === "invalid_plan_interval" ||
    key.startsWith("invalid_") ||
    key.startsWith("onboarding_")
  ) {
    return { status: 400, error: key.split(/\s+/)[0] ?? "invalid_request" };
  }
  return { status: 400, error: key || "invalid_request" };
}

function parseCreateCustomer(
  body: Record<string, unknown>,
): CreateCustomerRequest | { error: string } {
  const email = body.email;
  const displayName = body.displayName;
  const workspaceName = body.workspaceName;
  const currencyCode = body.currencyCode;
  const planId = body.planId;
  const subscriptionStatus = body.subscriptionStatus;
  const startsAt = body.startsAt;
  const trialEndsAt = body.trialEndsAt;
  const currentPeriodEndsAt = body.currentPeriodEndsAt;
  const deliveryMode = body.deliveryMode;
  const note = body.note;
  const clientId = body.clientId;

  if (
    !isNonEmptyString(email) ||
    !isNonEmptyString(displayName) ||
    !isNonEmptyString(workspaceName) ||
    !isNonEmptyString(currencyCode) ||
    !isNonEmptyString(planId) ||
    !isNonEmptyString(startsAt) ||
    !isNonEmptyString(note) ||
    !isNonEmptyString(clientId) ||
    typeof subscriptionStatus !== "string" ||
    !SUBSCRIPTION_STATUSES.has(subscriptionStatus) ||
    typeof deliveryMode !== "string" ||
    !DELIVERY_MODES.has(deliveryMode as DeliveryMode) ||
    (trialEndsAt !== null && typeof trialEndsAt !== "string") ||
    (currentPeriodEndsAt !== null && typeof currentPeriodEndsAt !== "string")
  ) {
    return { error: "invalid_request" };
  }

  return {
    action: "create_customer",
    email: email.trim(),
    displayName: displayName.trim(),
    workspaceName: workspaceName.trim(),
    currencyCode: currencyCode.trim(),
    planId: planId.trim(),
    subscriptionStatus: subscriptionStatus as "trialing" | "active",
    startsAt: startsAt.trim(),
    trialEndsAt: trialEndsAt === null ? null : String(trialEndsAt).trim(),
    currentPeriodEndsAt: currentPeriodEndsAt === null
      ? null
      : String(currentPeriodEndsAt).trim(),
    deliveryMode: deliveryMode as DeliveryMode,
    note: note.trim(),
    clientId: clientId.trim(),
  };
}

function parseSendPasswordSetup(
  body: Record<string, unknown>,
): SendPasswordSetupRequest | { error: string } {
  const email = body.email;
  const note = body.note;
  if (!isNonEmptyString(email) || !isNonEmptyString(note)) {
    return { error: "invalid_request" };
  }
  return {
    action: "send_password_setup",
    email: email.trim(),
    note: note.trim(),
  };
}

async function assertActiveSupervisor(
  userClient: SupabaseClient,
): Promise<{ ok: true } | { status: number; error: string }> {
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { status: 401, error: "authentication_required" };
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("system_role, account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    const mapped = mapRpcError(profileError.message);
    return mapped;
  }

  if (
    !profile ||
    profile.system_role !== "supervisor" ||
    profile.account_status !== "active"
  ) {
    return { status: 403, error: "forbidden" };
  }

  return { ok: true };
}

async function cancelOnboardingBestEffort(
  userClient: SupabaseClient,
  intentId: string,
  note: string,
): Promise<void> {
  try {
    await userClient.rpc("supervisor_cancel_customer_onboarding", {
      p_intent_id: intentId,
      p_note: note,
    });
  } catch {
    // Best-effort compensation; never leak cancel failures to callers.
  }
}

function strongRandomPassword(randomUuid: () => string): string {
  return `M!z9-${randomUuid()}`;
}

async function handleCreateCustomer(
  req: Request,
  body: CreateCustomerRequest,
  deps: Required<
    Pick<
      HandlerDeps,
      "getEnv" | "createUserClient" | "createAdminClient" | "randomUuid"
    >
  >,
): Promise<Response> {
  const accessToken = readBearerToken(req);
  if (!accessToken) {
    return jsonResponse(401, { error: "authentication_required" });
  }

  const supabaseUrl = deps.getEnv("SUPABASE_URL")?.trim();
  const anonKey =
    deps.getEnv("SUPABASE_ANON_KEY")?.trim() ||
    deps.getEnv("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    deps.getEnv("PUBLISHABLE_KEY")?.trim();
  const serviceRoleKey = deps.getEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: "server_misconfigured" });
  }

  const userClient = deps.createUserClient({
    url: supabaseUrl,
    anonKey,
    accessToken,
  });

  const supervisorCheck = await assertActiveSupervisor(userClient);
  if (!("ok" in supervisorCheck)) {
    return jsonResponse(supervisorCheck.status, {
      error: supervisorCheck.error,
    });
  }

  const prepareResult = await userClient.rpc(
    "supervisor_prepare_customer_onboarding",
    {
      p_email: body.email,
      p_display_name: body.displayName,
      p_workspace_name: body.workspaceName,
      p_currency_code: body.currencyCode,
      p_plan_id: body.planId,
      p_subscription_status: body.subscriptionStatus,
      p_starts_at: body.startsAt,
      p_trial_ends_at: body.trialEndsAt,
      p_current_period_ends_at: body.currentPeriodEndsAt,
      p_must_change_password: true,
      p_delivery_mode: body.deliveryMode,
      p_note: body.note,
      p_client_id: body.clientId,
    },
  );

  if (prepareResult.error || !prepareResult.data) {
    const mapped = mapRpcError(prepareResult.error?.message);
    return jsonResponse(mapped.status, { error: mapped.error });
  }

  const intentId = String(prepareResult.data);

  const issueResult = await userClient.rpc(
    "supervisor_issue_customer_onboarding_capability",
    {
      p_intent_id: intentId,
      p_note: body.note,
    },
  );

  if (issueResult.error || !issueResult.data) {
    await cancelOnboardingBestEffort(
      userClient,
      intentId,
      `auth_setup_failed: ${body.note}`.slice(0, 500),
    );
    const mapped = mapRpcError(issueResult.error?.message);
    return jsonResponse(mapped.status, { error: mapped.error });
  }

  const capability = String(issueResult.data);
  const password = strongRandomPassword(deps.randomUuid);
  const returnTemporaryPassword = body.deliveryMode === "temporary_password";
  const appOrigin = resolveAppOrigin(req, deps.getEnv);
  const redirectTo = `${appOrigin}/auth/update-password`;

  const adminClient = deps.createAdminClient({
    url: supabaseUrl,
    serviceRoleKey,
  });

  const createResult = await adminClient.auth.admin.createUser({
    email: body.email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: body.displayName,
    },
    app_metadata: {
      mizan_onboarding_capability: capability,
    },
  });

  if (createResult.error || !createResult.data.user) {
    await cancelOnboardingBestEffort(
      userClient,
      intentId,
      `auth_create_failed: ${body.note}`.slice(0, 500),
    );
    return jsonResponse(500, { error: "auth_create_failed" });
  }

  const userId = createResult.data.user.id;

  if (
    body.deliveryMode === "invite" ||
    body.deliveryMode === "password_setup_email"
  ) {
    const linkResult = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: body.email,
      options: { redirectTo },
    });
    // Do not return the action link. Log only success boolean — never secrets.
    console.info(
      JSON.stringify({
        event: "password_setup_link_generated",
        ok: !linkResult.error,
        deliveryMode: body.deliveryMode,
      }),
    );
    // Link generation failure after user creation is non-fatal for the create
    // response: the user exists and onboarding capability was attached. The
    // supervisor can retry via send_password_setup.
  }

  return jsonResponse(200, {
    userId,
    temporaryPassword: returnTemporaryPassword ? password : null,
  });
}

async function handleSendPasswordSetup(
  req: Request,
  body: SendPasswordSetupRequest,
  deps: Required<
    Pick<HandlerDeps, "getEnv" | "createUserClient" | "createAdminClient">
  >,
): Promise<Response> {
  const accessToken = readBearerToken(req);
  if (!accessToken) {
    return jsonResponse(401, { error: "authentication_required" });
  }

  const supabaseUrl = deps.getEnv("SUPABASE_URL")?.trim();
  const anonKey =
    deps.getEnv("SUPABASE_ANON_KEY")?.trim() ||
    deps.getEnv("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    deps.getEnv("PUBLISHABLE_KEY")?.trim();
  const serviceRoleKey = deps.getEnv("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(500, { error: "server_misconfigured" });
  }

  const userClient = deps.createUserClient({
    url: supabaseUrl,
    anonKey,
    accessToken,
  });

  const supervisorCheck = await assertActiveSupervisor(userClient);
  if (!("ok" in supervisorCheck)) {
    return jsonResponse(supervisorCheck.status, {
      error: supervisorCheck.error,
    });
  }

  // Note is required for auditability; do not echo it in responses.
  if (body.note.trim().length < 3) {
    return jsonResponse(400, { error: "invalid_note" });
  }

  const adminClient = deps.createAdminClient({
    url: supabaseUrl,
    serviceRoleKey,
  });
  const appOrigin = resolveAppOrigin(req, deps.getEnv);
  const redirectTo = `${appOrigin}/auth/update-password`;

  // Anti-enumeration: always return generic success to the supervisor once
  // authenticated, whether or not the email exists / link generation succeeds.
  try {
    const linkResult = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: body.email,
      options: { redirectTo },
    });
    console.info(
      JSON.stringify({
        event: "send_password_setup",
        ok: !linkResult.error,
      }),
    );
  } catch {
    console.info(
      JSON.stringify({
        event: "send_password_setup",
        ok: false,
      }),
    );
  }

  return jsonResponse(200, { ok: true });
}

export async function handleRequest(
  req: Request,
  deps: HandlerDeps = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const getEnv = deps.getEnv ?? defaultGetEnv;
  const createUserClient = deps.createUserClient ?? defaultCreateUserClient;
  const createAdminClient = deps.createAdminClient ??
    defaultCreateAdminClient;
  const randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonResponse(400, { error: "invalid_request" });
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return jsonResponse(400, { error: "invalid_request" });
  }

  const body = raw as Record<string, unknown>;
  const action = body.action;

  if (action === "create_customer") {
    const parsed = parseCreateCustomer(body);
    if ("error" in parsed) {
      return jsonResponse(400, { error: parsed.error });
    }
    return await handleCreateCustomer(req, parsed, {
      getEnv,
      createUserClient,
      createAdminClient,
      randomUuid,
    });
  }

  if (action === "send_password_setup") {
    const parsed = parseSendPasswordSetup(body);
    if ("error" in parsed) {
      return jsonResponse(400, { error: parsed.error });
    }
    return await handleSendPasswordSetup(req, parsed, {
      getEnv,
      createUserClient,
      createAdminClient,
    });
  }

  return jsonResponse(400, { error: "invalid_request" });
}

if (import.meta.main) {
  Deno.serve((req) => handleRequest(req));
}
