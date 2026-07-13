import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { CustomerControlLedger } from "./CustomerControlLedger";

const fetchCustomerControlLedger = vi.fn();

vi.mock("./supervisor-intelligence-api", async () => {
  const actual = await vi.importActual<
    typeof import("./supervisor-intelligence-api")
  >("./supervisor-intelligence-api");
  return {
    ...actual,
    fetchCustomerControlLedger: (...args: unknown[]) =>
      fetchCustomerControlLedger(...args),
  };
});

function renderLedger() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CustomerControlLedger workspaceId="ws-1" />
    </QueryClientProvider>,
  );
}

describe("CustomerControlLedger", () => {
  beforeEach(() => {
    fetchCustomerControlLedger.mockResolvedValue({
      rows: [
        {
          entryId: "payment_review:1",
          entryType: "payment_review",
          title: "payment_approved",
          occurredAt: "2026-07-01T10:00:00.000Z",
          actorUserId: "sup-1",
          actorName: "مدير",
          metadata: {},
        },
        {
          entryId: "notification:2",
          entryType: "notification",
          title: "تذكير تجديد",
          occurredAt: "2026-07-02T10:00:00.000Z",
          actorUserId: "sup-1",
          actorName: "مدير",
          metadata: {},
        },
      ],
      total: 2,
    });
  });

  it("renders Arabic timeline labels for payment and message entries", async () => {
    renderLedger();
    expect(
      await screen.findByText("مراجعة دفع · موافقة"),
    ).toBeInTheDocument();
    expect(screen.getByText(/رسالة · تذكير تجديد/)).toBeInTheDocument();
  });
});
