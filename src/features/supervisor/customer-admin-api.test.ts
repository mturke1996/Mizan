const rpc = vi.fn();
const invoke = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc,
    functions: { invoke },
  }),
}));

import {
  createCustomer,
  fetchCustomerDetail,
  fetchCustomers,
  mapCustomerRow,
  sendCustomerPasswordSetup,
} from "./customer-admin-api";

describe("customer-admin-api mapping", () => {
  it("maps snake_case RPC rows to camelCase", () => {
    const mapped = mapCustomerRow({
      user_id: "user-1",
      email: "a@example.com",
      display_name: "أحمد",
      account_status: "active",
      last_sign_in_at: "2026-07-01T10:00:00.000Z",
      workspace_id: "ws-1",
      workspace_name: "مساحة أحمد",
      default_currency_code: "LYD",
      workspace_status: "active",
      subscription_id: "sub-1",
      subscription_status: "trialing",
      plan_id: "plan-1",
      plan_name: "تجريبي",
      trial_ends_at: "2026-07-20T00:00:00.000Z",
      current_period_ends_at: "2026-07-20T00:00:00.000Z",
      scheduled_status: "cancelled",
      scheduled_status_at: "2026-07-20T00:00:00.000Z",
      effective_subscription_status: "trialing",
      pending_payments: 2,
      created_at: "2026-06-01T00:00:00.000Z",
    });

    expect(mapped).toEqual({
      userId: "user-1",
      email: "a@example.com",
      displayName: "أحمد",
      accountStatus: "active",
      lastSignInAt: "2026-07-01T10:00:00.000Z",
      workspaceId: "ws-1",
      workspaceName: "مساحة أحمد",
      currencyCode: "LYD",
      workspaceStatus: "active",
      subscriptionId: "sub-1",
      subscriptionStatus: "trialing",
      planId: "plan-1",
      planName: "تجريبي",
      trialEndsAt: "2026-07-20T00:00:00.000Z",
      currentPeriodEndsAt: "2026-07-20T00:00:00.000Z",
      scheduledStatus: "cancelled",
      scheduledStatusAt: "2026-07-20T00:00:00.000Z",
      effectiveSubscriptionStatus: "trialing",
      pendingPayments: 2,
      createdAt: "2026-06-01T00:00:00.000Z",
    });
  });

  it("keeps nullables as null", () => {
    const mapped = mapCustomerRow({
      user_id: "user-2",
      email: "b@example.com",
      display_name: null,
      account_status: "suspended",
      last_sign_in_at: null,
      workspace_id: "ws-2",
      workspace_name: "مساحة",
      default_currency_code: "USD",
      workspace_status: "active",
      subscription_id: "sub-2",
      subscription_status: "active",
      plan_id: "plan-2",
      plan_name: "أساسي",
      trial_ends_at: null,
      current_period_ends_at: null,
      scheduled_status: null,
      scheduled_status_at: null,
      effective_subscription_status: "active",
      pending_payments: 0,
      created_at: "2026-06-02T00:00:00.000Z",
    });

    expect(mapped.displayName).toBeNull();
    expect(mapped.lastSignInAt).toBeNull();
    expect(mapped.trialEndsAt).toBeNull();
    expect(mapped.scheduledStatus).toBeNull();
    expect(mapped.scheduledStatusAt).toBeNull();
  });
});

describe("customer-admin-api calls", () => {
  beforeEach(() => {
    rpc.mockReset();
    invoke.mockReset();
  });

  it("fetches customers via supervisor_list_customers", async () => {
    rpc.mockResolvedValue({
      data: {
        rows: [
          {
            user_id: "user-1",
            email: "a@example.com",
            display_name: null,
            account_status: "active",
            last_sign_in_at: null,
            workspace_id: "ws-1",
            workspace_name: "مساحة",
            default_currency_code: "LYD",
            workspace_status: "active",
            subscription_id: "sub-1",
            subscription_status: "active",
            plan_id: "plan-1",
            plan_name: "أساسي",
            trial_ends_at: null,
            current_period_ends_at: "2026-08-01T00:00:00.000Z",
            scheduled_status: null,
            scheduled_status_at: null,
            effective_subscription_status: "active",
            pending_payments: 0,
            created_at: "2026-06-01T00:00:00.000Z",
          },
        ],
        total: 1,
      },
      error: null,
    });

    const result = await fetchCustomers({
      query: "أحمد",
      limit: 20,
      offset: 0,
    });

    expect(rpc).toHaveBeenCalledWith("supervisor_list_customers", {
      p_query: "أحمد",
      p_account_status: null,
      p_subscription_status: null,
      p_plan_id: null,
      p_limit: 20,
      p_offset: 0,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]?.userId).toBe("user-1");
  });

  it("fetches customer detail via supervisor_get_customer", async () => {
    rpc.mockResolvedValue({
      data: {
        user_id: "user-1",
        email: "a@example.com",
        display_name: "أحمد",
        account_status: "active",
        last_sign_in_at: null,
        workspace_id: "ws-1",
        workspace_name: "مساحة",
        default_currency_code: "LYD",
        workspace_status: "active",
        subscription_id: "sub-1",
        subscription_status: "active",
        plan_id: "plan-1",
        plan_name: "أساسي",
        trial_ends_at: null,
        current_period_ends_at: null,
        scheduled_status: null,
        scheduled_status_at: null,
        effective_subscription_status: "active",
        pending_payments: 0,
        created_at: "2026-06-01T00:00:00.000Z",
      },
      error: null,
    });

    const row = await fetchCustomerDetail("user-1");
    expect(rpc).toHaveBeenCalledWith("supervisor_get_customer", {
      p_user_id: "user-1",
    });
    expect(row.displayName).toBe("أحمد");
  });

  it("creates a customer through the edge function", async () => {
    invoke.mockResolvedValue({
      data: { userId: "user-9", temporaryPassword: "M!z9-secret" },
      error: null,
    });

    const result = await createCustomer({
      email: "new@example.com",
      displayName: "عميل جديد",
      workspaceName: "مساحة جديدة",
      currencyCode: "LYD",
      planId: "11111111-1111-4111-8111-111111111111",
      subscriptionStatus: "trialing",
      startsAt: "2026-07-13T00:00:00.000Z",
      trialEndsAt: "2026-07-27T00:00:00.000Z",
      currentPeriodEndsAt: "2026-07-27T00:00:00.000Z",
      deliveryMode: "temporary_password",
      note: "إنشاء تجريبي",
      clientId: "22222222-2222-4222-8222-222222222222",
    });

    expect(invoke).toHaveBeenCalledWith("supervisor-customer-admin", {
      body: expect.objectContaining({
        action: "create_customer",
        email: "new@example.com",
        deliveryMode: "temporary_password",
      }),
    });
    expect(result).toEqual({
      userId: "user-9",
      temporaryPassword: "M!z9-secret",
    });
  });

  it("sends password setup via the edge function", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await sendCustomerPasswordSetup("a@example.com", "إعادة تعيين");

    expect(invoke).toHaveBeenCalledWith("supervisor-customer-admin", {
      body: {
        action: "send_password_setup",
        email: "a@example.com",
        note: "إعادة تعيين",
      },
    });
  });

  it("surfaces Arabic errors from RPC failures", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "forbidden" },
    });

    await expect(
      fetchCustomers({ limit: 10, offset: 0 }),
    ).rejects.toThrow("ليست لديك صلاحية لتنفيذ هذا الإجراء");
  });
});
