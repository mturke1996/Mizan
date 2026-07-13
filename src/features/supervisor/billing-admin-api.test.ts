const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import {
  archivePlan,
  createPlan,
  fetchAdminPlans,
  mapAdminPlan,
  renewSubscription,
  scheduleSubscriptionState,
  setSubscriptionState,
} from "./billing-admin-api";

describe("billing-admin-api mapping", () => {
  it("maps plan list rows from snake_case", () => {
    const mapped = mapAdminPlan({
      plan_id: "plan-1",
      code: "basic",
      name: "أساسي",
      price_minor: 50000,
      currency_code: "LYD",
      billing_interval: "monthly",
      interval_count: 1,
      trial_days: 14,
      is_public: true,
      is_active: true,
      features: { manual_payment: true },
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      subscription_counts: {
        trialing: 1,
        active: 2,
        grace: 0,
        frozen: 0,
        expired: 0,
        cancelled: 1,
      },
    });

    expect(mapped.planId).toBe("plan-1");
    expect(mapped.priceMinor).toBe(50000);
    expect(mapped.subscriptionCounts.active).toBe(2);
  });
});

describe("billing-admin-api calls", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("lists plans via supervisor_list_plans", async () => {
    rpc.mockResolvedValue({
      data: {
        rows: [
          {
            plan_id: "plan-1",
            code: "basic",
            name: "أساسي",
            price_minor: 100,
            currency_code: "LYD",
            billing_interval: "monthly",
            interval_count: 1,
            trial_days: 0,
            is_public: true,
            is_active: true,
            features: {},
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
            subscription_counts: {
              trialing: 0,
              active: 0,
              grace: 0,
              frozen: 0,
              expired: 0,
              cancelled: 0,
            },
          },
        ],
        total: 1,
      },
      error: null,
    });

    const plans = await fetchAdminPlans(true);
    expect(rpc).toHaveBeenCalledWith("supervisor_list_plans", {
      p_include_archived: true,
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]?.code).toBe("basic");
  });

  it("creates a plan via RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "plan-9",
        code: "pro",
        name: "احترافي",
        price_minor: 200,
        currency_code: "LYD",
        billing_interval: "yearly",
        interval_count: 1,
        trial_days: 7,
        is_public: false,
        is_active: true,
        features: { manual_payment: true },
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
      },
      error: null,
    });

    const plan = await createPlan({
      code: "pro",
      name: "احترافي",
      priceMinor: 200,
      currencyCode: "LYD",
      billingInterval: "yearly",
      intervalCount: 1,
      trialDays: 7,
      isPublic: false,
      features: { manual_payment: true },
      note: "إنشاء خطة",
      clientId: "33333333-3333-4333-8333-333333333333",
    });

    expect(rpc).toHaveBeenCalledWith(
      "supervisor_create_plan",
      expect.objectContaining({
        p_code: "pro",
        p_note: "إنشاء خطة",
      }),
    );
    expect(plan.planId).toBe("plan-9");
  });

  it("archives a plan via RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        id: "plan-1",
        code: "basic",
        name: "أساسي",
        price_minor: 100,
        currency_code: "LYD",
        billing_interval: "monthly",
        interval_count: 1,
        trial_days: 0,
        is_public: false,
        is_active: false,
        features: {},
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
      },
      error: null,
    });

    const plan = await archivePlan({
      planId: "plan-1",
      note: "أرشفة",
      clientId: "44444444-4444-4444-8444-444444444444",
    });

    expect(rpc).toHaveBeenCalledWith("supervisor_archive_plan", {
      p_plan_id: "plan-1",
      p_note: "أرشفة",
      p_client_id: "44444444-4444-4444-8444-444444444444",
    });
    expect(plan.isActive).toBe(false);
  });

  it("renews and schedules subscription state", async () => {
    rpc.mockResolvedValue({ data: {}, error: null });

    await renewSubscription({
      workspaceId: "ws-1",
      periodCount: 3,
      note: "تجديد",
      clientId: "55555555-5555-4555-8555-555555555555",
    });
    await setSubscriptionState({
      workspaceId: "ws-1",
      targetStatus: "frozen",
      trialEndsAt: null,
      currentPeriodEndsAt: "2026-08-01T00:00:00.000Z",
      graceEndsAt: null,
      note: "تجميد",
      clientId: "66666666-6666-4666-8666-666666666666",
    });
    await scheduleSubscriptionState({
      workspaceId: "ws-1",
      targetStatus: "cancelled",
      scheduledAt: "2026-08-01T00:00:00.000Z",
      note: "إلغاء مجدول",
      clientId: "77777777-7777-4777-8777-777777777777",
    });

    expect(rpc).toHaveBeenCalledWith(
      "supervisor_renew_subscription",
      expect.objectContaining({ p_period_count: 3 }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "supervisor_set_subscription_state",
      expect.objectContaining({ p_target_status: "frozen" }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "supervisor_schedule_subscription_state",
      expect.objectContaining({ p_target_status: "cancelled" }),
    );
  });

  it("surfaces Arabic errors", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "inactive_plan" },
    });

    await expect(
      createPlan({
        code: "x",
        name: "x",
        priceMinor: 1,
        currencyCode: "LYD",
        billingInterval: "monthly",
        intervalCount: 1,
        trialDays: 0,
        isPublic: true,
        features: {},
        note: "ملاحظة",
        clientId: "88888888-8888-4888-8888-888888888888",
      }),
    ).rejects.toThrow("الخطة غير متاحة أو غير نشطة");
  });
});
