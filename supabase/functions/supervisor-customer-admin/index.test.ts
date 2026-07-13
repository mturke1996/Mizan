/**
 * Deno tests for supervisor-customer-admin.
 * Run: deno test --allow-env supabase/functions/supervisor-customer-admin/index.test.ts
 */
import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest, type HandlerDeps } from "./index.ts";

type RpcCall = {
  name: string;
  args: Record<string, unknown>;
};

type CreateUserCall = {
  email: string;
  password?: string;
  email_confirm?: boolean;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type GenerateLinkCall = {
  type: string;
  email: string;
  options?: { redirectTo?: string };
};

function baseCreateCustomerBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    action: "create_customer",
    email: "customer@example.com",
    displayName: "عميل تجريبي",
    workspaceName: "مساحة تجريبية",
    currencyCode: "SAR",
    planId: "11111111-1111-1111-1111-111111111111",
    subscriptionStatus: "trialing",
    startsAt: "2026-07-01T00:00:00.000Z",
    trialEndsAt: "2026-07-15T00:00:00.000Z",
    currentPeriodEndsAt: "2026-08-01T00:00:00.000Z",
    deliveryMode: "temporary_password",
    note: "إنشاء عميل للاختبار",
    clientId: "22222222-2222-2222-2222-222222222222",
    ...overrides,
  };
}

function makeEnv(values: Record<string, string> = {}): HandlerDeps["getEnv"] {
  const defaults: Record<string, string> = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
    APP_ORIGIN: "https://app.mizan.test",
    ...values,
  };
  return (key: string) => defaults[key];
}

type MockOptions = {
  profile?: {
    system_role: string;
    account_status: string;
  } | null;
  getUserError?: { message: string } | null;
  prepare?: { data?: string | null; error?: { message: string } | null };
  issue?: { data?: string | null; error?: { message: string } | null };
  cancel?: { error?: { message: string } | null };
  createUser?: {
    data?: { user: { id: string } | null };
    error?: { message: string } | null;
  };
  generateLink?: {
    data?: unknown;
    error?: { message: string } | null;
  };
  listUsers?: never;
};

function createMockDeps(options: MockOptions = {}) {
  const rpcCalls: RpcCall[] = [];
  const createUserCalls: CreateUserCall[] = [];
  const generateLinkCalls: GenerateLinkCall[] = [];
  const inviteUserByEmailCalls: unknown[] = [];
  const cancelCalls: RpcCall[] = [];

  const profile = options.profile === undefined
    ? { system_role: "supervisor", account_status: "active" }
    : options.profile;

  const userClient = {
    auth: {
      getUser: async () => {
        if (options.getUserError) {
          return { data: { user: null }, error: options.getUserError };
        }
        return {
          data: {
            user: {
              id: "supervisor-user-id",
              email: "supervisor@example.com",
            },
          },
          error: null,
        };
      },
    },
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _id: string) => ({
          maybeSingle: async () => ({
            data: profile,
            error: null,
          }),
        }),
      }),
    }),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      if (name === "supervisor_prepare_customer_onboarding") {
        return options.prepare ?? {
          data: "intent-uuid-1",
          error: null,
        };
      }
      if (name === "supervisor_issue_customer_onboarding_capability") {
        return options.issue ?? {
          data: "capability-uuid-plaintext",
          error: null,
        };
      }
      if (name === "supervisor_cancel_customer_onboarding") {
        cancelCalls.push({ name, args });
        return options.cancel ?? { data: null, error: null };
      }
      return { data: null, error: { message: `unexpected_rpc:${name}` } };
    },
  };

  const adminClient = {
    auth: {
      admin: {
        createUser: async (payload: CreateUserCall) => {
          createUserCalls.push(payload);
          return (
            options.createUser ?? {
              data: { user: { id: "new-customer-user-id" } },
              error: null,
            }
          );
        },
        generateLink: async (payload: GenerateLinkCall) => {
          generateLinkCalls.push(payload);
          return (
            options.generateLink ?? {
              data: { properties: { action_link: "https://secret.link" } },
              error: null,
            }
          );
        },
        inviteUserByEmail: async (...args: unknown[]) => {
          inviteUserByEmailCalls.push(args);
          return { data: null, error: { message: "invite_forbidden_in_tests" } };
        },
      },
    },
  };

  const deps: HandlerDeps = {
    getEnv: makeEnv(),
    createUserClient: () => userClient as never,
    createAdminClient: () => adminClient as never,
    randomUuid: () => "fixed-uuid-0000-0000-0000-000000000001",
  };

  return {
    deps,
    rpcCalls,
    createUserCalls,
    generateLinkCalls,
    inviteUserByEmailCalls,
    cancelCalls,
  };
}

function postJson(
  body: unknown,
  headers: Record<string, string> = {
    Authorization: "Bearer supervisor-jwt",
  },
): Request {
  return new Request("http://localhost/functions/v1/supervisor-customer-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("401 when Authorization is missing", async () => {
  const { deps } = createMockDeps();
  const res = await handleRequest(
    postJson(baseCreateCustomerBody(), {}),
    deps,
  );
  assertEquals(res.status, 401);
  const json = await res.json();
  assertEquals(json.error, "authentication_required");
});

Deno.test("403 when profile is not an active supervisor", async () => {
  const { deps } = createMockDeps({
    profile: { system_role: "member", account_status: "active" },
  });
  const res = await handleRequest(postJson(baseCreateCustomerBody()), deps);
  assertEquals(res.status, 403);
  const json = await res.json();
  assertEquals(json.error, "forbidden");
});

Deno.test("403 when prepare RPC returns forbidden", async () => {
  const { deps, rpcCalls } = createMockDeps({
    prepare: { data: null, error: { message: "forbidden" } },
  });
  const res = await handleRequest(postJson(baseCreateCustomerBody()), deps);
  assertEquals(res.status, 403);
  const json = await res.json();
  assertEquals(json.error, "forbidden");
  assertEquals(
    rpcCalls.some((c) => c.name === "supervisor_prepare_customer_onboarding"),
    true,
  );
});

Deno.test("400 when body is invalid", async () => {
  const { deps } = createMockDeps();
  const res = await handleRequest(
    postJson({ action: "create_customer", email: "x" }),
    deps,
  );
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "invalid_request");
});

Deno.test(
  "create_customer temporary_password sets app_metadata capability and returns password",
  async () => {
    const mock = createMockDeps();
    const res = await handleRequest(
      postJson(baseCreateCustomerBody({ deliveryMode: "temporary_password" })),
      mock.deps,
    );
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.userId, "new-customer-user-id");
    assertEquals(
      json.temporaryPassword,
      "M!z9-fixed-uuid-0000-0000-0000-000000000001",
    );

    assertEquals(mock.createUserCalls.length, 1);
    const createCall = mock.createUserCalls[0];
    assertExists(createCall);
    assertEquals(
      createCall.app_metadata?.mizan_onboarding_capability,
      "capability-uuid-plaintext",
    );
    assertEquals(createCall.user_metadata?.display_name, "عميل تجريبي");
    assertEquals(createCall.email_confirm, true);
    // Capability must never land in user_metadata
    assertEquals(
      createCall.user_metadata?.mizan_onboarding_capability,
      undefined,
    );
    assertEquals(mock.inviteUserByEmailCalls.length, 0);
    assertEquals(mock.generateLinkCalls.length, 0);
  },
);

Deno.test(
  "create_customer invite does not return password and does not call inviteUserByEmail",
  async () => {
    const mock = createMockDeps();
    const res = await handleRequest(
      postJson(baseCreateCustomerBody({ deliveryMode: "invite" })),
      mock.deps,
    );
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.userId, "new-customer-user-id");
    assertEquals(json.temporaryPassword, null);

    assertEquals(mock.createUserCalls.length, 1);
    const createCall = mock.createUserCalls[0];
    assertExists(createCall);
    assertEquals(
      createCall.app_metadata?.mizan_onboarding_capability,
      "capability-uuid-plaintext",
    );
    assertEquals(mock.inviteUserByEmailCalls.length, 0);
    assertEquals(mock.generateLinkCalls.length, 1);
    assertEquals(mock.generateLinkCalls[0]?.type, "recovery");
    assertEquals(
      mock.generateLinkCalls[0]?.options?.redirectTo,
      "https://app.mizan.test/auth/update-password",
    );
    // Response must not leak recovery link
    assertEquals("action_link" in json, false);
    assertEquals(JSON.stringify(json).includes("secret.link"), false);
  },
);

Deno.test(
  "create_customer password_setup_email uses createUser + generateLink recovery",
  async () => {
    const mock = createMockDeps();
    const res = await handleRequest(
      postJson(
        baseCreateCustomerBody({ deliveryMode: "password_setup_email" }),
      ),
      mock.deps,
    );
    assertEquals(res.status, 200);
    const json = await res.json();
    assertEquals(json.temporaryPassword, null);
    assertEquals(mock.inviteUserByEmailCalls.length, 0);
    assertEquals(mock.generateLinkCalls.length, 1);
    assertEquals(mock.generateLinkCalls[0]?.type, "recovery");
  },
);

Deno.test("Auth createUser failure cancels onboarding intent", async () => {
  const mock = createMockDeps({
    createUser: {
      data: { user: null },
      error: { message: "Auth create failed" },
    },
  });
  const res = await handleRequest(postJson(baseCreateCustomerBody()), mock.deps);
  assertEquals(res.status, 500);
  const json = await res.json();
  assertEquals(json.error, "auth_create_failed");
  assertEquals(mock.cancelCalls.length, 1);
  assertEquals(
    mock.cancelCalls[0]?.name,
    "supervisor_cancel_customer_onboarding",
  );
  assertEquals(mock.cancelCalls[0]?.args.p_intent_id, "intent-uuid-1");
  assertEquals(mock.inviteUserByEmailCalls.length, 0);
});

Deno.test("prepare sets must_change_password true for all delivery modes", async () => {
  for (const deliveryMode of [
    "invite",
    "temporary_password",
    "password_setup_email",
  ] as const) {
    const mock = createMockDeps();
    await handleRequest(
      postJson(baseCreateCustomerBody({ deliveryMode })),
      mock.deps,
    );
    const prepare = mock.rpcCalls.find(
      (c) => c.name === "supervisor_prepare_customer_onboarding",
    );
    assertExists(prepare);
    assertEquals(prepare.args.p_must_change_password, true);
    assertEquals(prepare.args.p_delivery_mode, deliveryMode);
  }
});

Deno.test("send_password_setup returns ok even when user is missing", async () => {
  const mock = createMockDeps({
    generateLink: {
      data: null,
      error: { message: "User not found" },
    },
  });
  const res = await handleRequest(
    postJson({
      action: "send_password_setup",
      email: "missing@example.com",
      note: "إعادة تعيين كلمة المرور",
    }),
    mock.deps,
  );
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.ok, true);
});

Deno.test("send_password_setup requires note and supervisor auth", async () => {
  const { deps } = createMockDeps();
  const bad = await handleRequest(
    postJson({ action: "send_password_setup", email: "a@b.com" }),
    deps,
  );
  assertEquals(bad.status, 400);

  const unauth = await handleRequest(
    postJson(
      {
        action: "send_password_setup",
        email: "a@b.com",
        note: "ملاحظة كافية",
      },
      {},
    ),
    deps,
  );
  assertEquals(unauth.status, 401);
});

Deno.test("OPTIONS returns CORS preflight", async () => {
  const res = await handleRequest(
    new Request("http://localhost/functions/v1/supervisor-customer-admin", {
      method: "OPTIONS",
    }),
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});
