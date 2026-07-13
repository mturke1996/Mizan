import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SupervisorOperationsPage } from "./SupervisorOperationsPage";

const fetchOperationalMetrics = vi.fn();
const fetchActionQueue = vi.fn();
const fetchRevenueSeries = vi.fn();
const fetchPlanMix = vi.fn();
const fetchAuditEvents = vi.fn();

vi.mock("./supervisor-intelligence-api", async () => {
  const actual = await vi.importActual<
    typeof import("./supervisor-intelligence-api")
  >("./supervisor-intelligence-api");
  return {
    ...actual,
    fetchOperationalMetrics: (...args: unknown[]) =>
      fetchOperationalMetrics(...args),
    fetchActionQueue: (...args: unknown[]) => fetchActionQueue(...args),
    fetchRevenueSeries: (...args: unknown[]) => fetchRevenueSeries(...args),
    fetchPlanMix: (...args: unknown[]) => fetchPlanMix(...args),
    fetchAuditEvents: (...args: unknown[]) => fetchAuditEvents(...args),
  };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupervisorOperationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorOperationsPage", () => {
  beforeEach(() => {
    fetchOperationalMetrics.mockResolvedValue({
      customers: {
        total: 10,
        active: 4,
        trialing: 3,
        grace: 1,
        frozen: 2,
        expiring7d: 1,
      },
      payments: {
        pending: 2,
        approved: 0,
        rejected: 0,
        approvalRate: { value: null, sampleSize: 0 },
        averageReviewMinutes: null,
      },
      trials: { value: null, sampleSize: 0 },
    });
    fetchActionQueue.mockResolvedValue([
      {
        id: "pending_payment:p1",
        type: "pending_payment",
        severity: "warning",
        workspaceId: "ws-1",
        customerName: "أحمد",
        title: "طلب دفع معلّق",
        description: "بانتظار المراجعة",
        dueAt: null,
        href: "/supervisor/payments",
      },
    ]);
    fetchRevenueSeries.mockResolvedValue([
      {
        bucketStart: "2026-06-01",
        currencyCode: "LYD",
        approvedAmountMinor: 10000,
        approvedCount: 1,
      },
      {
        bucketStart: "2026-06-01",
        currencyCode: "USD",
        approvedAmountMinor: 2000,
        approvedCount: 1,
      },
    ]);
    fetchPlanMix.mockResolvedValue([
      {
        planId: "plan-1",
        planName: "أساسي",
        activeSubscriptions: 2,
        trialingSubscriptions: 1,
        frozenSubscriptions: 0,
      },
    ]);
    fetchAuditEvents.mockResolvedValue({ rows: [], total: 0 });
  });

  it("shows insufficient data for null rates with sample size", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "معدل الموافقة" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("بيانات غير كافية").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/حجم العينة: 0/).length).toBeGreaterThan(0);
  });

  it("keeps LYD and USD revenue separate and links action queue", async () => {
    renderPage();
    expect(await screen.findByText("LYD")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /طلب دفع معلّق/i });
    expect(link).toHaveAttribute("href", "/supervisor/payments");
  });
});
