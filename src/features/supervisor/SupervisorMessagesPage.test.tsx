import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SupervisorMessagesPage } from "./SupervisorMessagesPage";

const fetchOperationalMetrics = vi.fn();
const fetchNotificationCampaigns = vi.fn();
const sendNotificationCampaign = vi.fn();

vi.mock("./supervisor-intelligence-api", async () => {
  const actual = await vi.importActual<
    typeof import("./supervisor-intelligence-api")
  >("./supervisor-intelligence-api");
  return {
    ...actual,
    fetchOperationalMetrics: (...args: unknown[]) =>
      fetchOperationalMetrics(...args),
    fetchNotificationCampaigns: (...args: unknown[]) =>
      fetchNotificationCampaigns(...args),
    sendNotificationCampaign: (...args: unknown[]) =>
      sendNotificationCampaign(...args),
  };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupervisorMessagesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorMessagesPage", () => {
  beforeEach(() => {
    fetchOperationalMetrics.mockResolvedValue({
      customers: {
        total: 5,
        active: 2,
        trialing: 1,
        grace: 1,
        frozen: 1,
        expiring7d: 0,
      },
      payments: {
        pending: 0,
        approved: 0,
        rejected: 0,
        approvalRate: { value: null, sampleSize: 0 },
        averageReviewMinutes: null,
      },
      trials: { value: null, sampleSize: 0 },
    });
    fetchNotificationCampaigns.mockResolvedValue([]);
    sendNotificationCampaign.mockResolvedValue({
      campaignId: "c1",
      segment: "grace",
      title: "تنبيه",
      body: "جدد الاشتراك",
      recipientCount: 1,
    });
  });

  it("shows segment recipient preview and campaign editor", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("محرر الحملة")).toBeInTheDocument();
    expect(screen.getByText("إشارات سريعة")).toBeInTheDocument();
    expect(await screen.findByText(/2 مستلم/)).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue("النشطون"), "grace");
    expect(await screen.findByText(/1 مستلم/)).toBeInTheDocument();
  });
});
