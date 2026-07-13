const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import {
  fetchActionQueue,
  fetchOperationalMetrics,
  fetchRevenueSeries,
  formatRateMetric,
  groupRevenueByCurrency,
  mapActionQueueItem,
  mapOperationalMetrics,
  normalizeActionHref,
  sendNotificationCampaign,
} from "./supervisor-intelligence-api";

describe("supervisor-intelligence-api mapping", () => {
  it("maps null approval rate with sample size", () => {
    const mapped = mapOperationalMetrics({
      customers: {
        total: 3,
        active: 1,
        trialing: 1,
        grace: 0,
        frozen: 1,
        expiring_7d: 0,
      },
      payments: {
        pending: 2,
        approved: 0,
        rejected: 0,
        approval_rate: null,
        approval_sample_size: 0,
        average_review_minutes: null,
      },
      trials: {
        conversion_rate: null,
        sample_size: 0,
      },
    });

    expect(mapped.payments.approvalRate.value).toBeNull();
    expect(mapped.payments.approvalRate.sampleSize).toBe(0);
    expect(formatRateMetric(mapped.payments.approvalRate)).toBe(
      "بيانات غير كافية",
    );
    expect(formatRateMetric(mapped.trials)).toBe("بيانات غير كافية");
  });

  it("formats numeric rates with sample size context", () => {
    expect(
      formatRateMetric({ value: 66.666, sampleSize: 3 }),
    ).toContain("%");
  });

  it("maps action queue hrefs without summing currencies", () => {
    const item = mapActionQueueItem({
      item_id: "grace:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      item_type: "subscription_grace",
      severity: "critical",
      workspace_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customer_name: "سارة",
      title: "اشتراك في المهلة",
      description: "يتطلب قرارًا",
      due_at: "2026-07-14T00:00:00.000Z",
      action_href:
        "/supervisor/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(item.href).toBe(
      "/supervisor/customers?workspace=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(item.severity).toBe("critical");
  });

  it("normalizes customer deep links from action queue", () => {
    expect(
      normalizeActionHref(
        "/supervisor/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ),
    ).toBe(
      "/supervisor/customers?workspace=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });

  it("groups revenue points by currency and never merges LYD with USD", () => {
    const grouped = groupRevenueByCurrency([
      {
        bucketStart: "2026-06-01",
        currencyCode: "LYD",
        approvedAmountMinor: 1000,
        approvedCount: 1,
      },
      {
        bucketStart: "2026-06-01",
        currencyCode: "USD",
        approvedAmountMinor: 200,
        approvedCount: 1,
      },
    ]);
    expect(grouped.get("LYD")).toHaveLength(1);
    expect(grouped.get("USD")).toHaveLength(1);
    expect(grouped.size).toBe(2);
  });
});

describe("supervisor-intelligence-api calls", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("fetches operational metrics via RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        customers: {
          total: 1,
          active: 1,
          trialing: 0,
          grace: 0,
          frozen: 0,
          expiring_7d: 0,
        },
        payments: {
          pending: 0,
          approved: 1,
          rejected: 1,
          approval_rate: 50,
          approval_sample_size: 2,
          average_review_minutes: 12,
        },
        trials: { conversion_rate: 100, sample_size: 1 },
      },
      error: null,
    });

    const metrics = await fetchOperationalMetrics(
      "2026-01-01T00:00:00.000Z",
      "2026-07-01T00:00:00.000Z",
    );
    expect(rpc).toHaveBeenCalledWith("supervisor_operational_metrics", {
      p_from: "2026-01-01T00:00:00.000Z",
      p_to: "2026-07-01T00:00:00.000Z",
    });
    expect(metrics.payments.approvalRate.value).toBe(50);
    expect(metrics.payments.approvalRate.sampleSize).toBe(2);
  });

  it("fetches revenue series and action queue", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            bucket_start: "2026-06-01",
            currency_code: "LYD",
            approved_amount_minor: 50000,
            approved_count: 2,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            item_id: "pending_payment:p1",
            item_type: "pending_payment",
            severity: "warning",
            workspace_id: "ws-1",
            customer_name: "أحمد",
            title: "طلب دفع معلّق",
            description: "بانتظار المراجعة",
            due_at: null,
            action_href: "/supervisor/payments",
          },
        ],
        error: null,
      });

    const series = await fetchRevenueSeries({
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-07-01T00:00:00.000Z",
      bucket: "month",
    });
    const queue = await fetchActionQueue(20);

    expect(series[0]?.currencyCode).toBe("LYD");
    expect(queue[0]?.href).toBe("/supervisor/payments");
  });

  it("sends notification campaigns with client id", async () => {
    rpc.mockResolvedValue({
      data: {
        campaign_id: "camp-1",
        segment: "grace",
        title: "تنبيه",
        body: "يرجى التجديد",
        recipient_count: 3,
      },
      error: null,
    });

    const result = await sendNotificationCampaign({
      segment: "grace",
      title: "تنبيه",
      body: "يرجى التجديد",
      note: "حملة مهلة",
      clientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(rpc).toHaveBeenCalledWith("supervisor_send_notification_campaign", {
      p_segment: "grace",
      p_title: "تنبيه",
      p_body: "يرجى التجديد",
      p_note: "حملة مهلة",
      p_client_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(result.recipientCount).toBe(3);
  });
});
