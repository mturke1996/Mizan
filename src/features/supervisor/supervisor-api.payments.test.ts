import { mapPaymentRequestRow } from "./supervisor-api";

describe("mapPaymentRequestRow", () => {
  it("maps enriched payment list rows", () => {
    const mapped = mapPaymentRequestRow({
      payment_request_id: "pay-1",
      workspace_id: "ws-1",
      workspace_name: "مساحة",
      display_name: "أحمد",
      plan_id: "plan-1",
      plan_name: "أساسي",
      period_count: 3,
      amount_minor: 150000,
      currency_code: "LYD",
      status: "pending",
      requester_note: "note",
      review_note: null,
      reviewer_display_name: null,
      reviewed_at: null,
      proof_object_path: "a/b.png",
      created_at: "2026-07-01T00:00:00.000Z",
    });

    expect(mapped).toMatchObject({
      id: "pay-1",
      workspaceName: "مساحة",
      requesterName: "أحمد",
      planName: "أساسي",
      periodCount: 3,
      amountMinor: 150000,
      proofObjectPath: "a/b.png",
    });
  });
});
