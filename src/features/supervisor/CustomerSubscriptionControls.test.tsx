import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SupervisorCustomerRow } from "./customer-admin-types";
import { CustomerSubscriptionControls } from "./CustomerSubscriptionControls";

const renewSubscription = vi.fn();
const setSubscriptionState = vi.fn();
const changeSubscriptionPlan = vi.fn();
const scheduleSubscriptionState = vi.fn();
const fetchAdminPlans = vi.fn();

vi.mock("./billing-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./billing-admin-api")>(
    "./billing-admin-api",
  );
  return {
    ...actual,
    renewSubscription: (...args: unknown[]) => renewSubscription(...args),
    setSubscriptionState: (...args: unknown[]) => setSubscriptionState(...args),
    changeSubscriptionPlan: (...args: unknown[]) =>
      changeSubscriptionPlan(...args),
    scheduleSubscriptionState: (...args: unknown[]) =>
      scheduleSubscriptionState(...args),
    fetchAdminPlans: (...args: unknown[]) => fetchAdminPlans(...args),
  };
});

vi.mock("./supervisor-api", async () => {
  const actual = await vi.importActual<typeof import("./supervisor-api")>(
    "./supervisor-api",
  );
  return {
    ...actual,
    invalidateSupervisor: vi.fn().mockResolvedValue(undefined),
  };
});

const customer: SupervisorCustomerRow = {
  userId: "user-1",
  email: "a@example.com",
  displayName: "سارة",
  accountStatus: "active",
  lastSignInAt: null,
  workspaceId: "ws-1",
  workspaceName: "مساحة سارة",
  currencyCode: "LYD",
  workspaceStatus: "active",
  subscriptionId: "sub-1",
  subscriptionStatus: "active",
  planId: "plan-1",
  planName: "أساسي",
  trialEndsAt: null,
  currentPeriodEndsAt: "2026-08-20T00:00:00.000Z",
  scheduledStatus: null,
  scheduledStatusAt: null,
  effectiveSubscriptionStatus: "active",
  pendingPayments: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderControls(row: SupervisorCustomerRow = customer) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CustomerSubscriptionControls customer={row} />
    </QueryClientProvider>,
  );
}

describe("CustomerSubscriptionControls", () => {
  beforeEach(() => {
    renewSubscription.mockReset().mockResolvedValue(undefined);
    setSubscriptionState.mockReset().mockResolvedValue(undefined);
    changeSubscriptionPlan.mockReset().mockResolvedValue(undefined);
    scheduleSubscriptionState.mockReset().mockResolvedValue(undefined);
    fetchAdminPlans.mockResolvedValue([
      {
        planId: "plan-1",
        code: "basic",
        name: "أساسي",
        priceMinor: 1000,
        currencyCode: "LYD",
        billingInterval: "monthly",
        intervalCount: 1,
        trialDays: 0,
        isPublic: true,
        isActive: true,
        features: {},
        createdAt: "",
        updatedAt: "",
        subscriptionCounts: {
          trialing: 0,
          active: 0,
          grace: 0,
          frozen: 0,
          expired: 0,
          cancelled: 0,
        },
      },
    ]);
  });

  it("renews a subscription without requiring a payment request", async () => {
    const user = userEvent.setup();
    renderControls();

    expect(screen.getByText("تحكم مباشر بالاشتراك")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /\+1\s*فترة/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("ملاحظة المدير"),
      "تمديد يدوي بدون وصل",
    );
    await user.click(screen.getByRole("button", { name: "تنفيذ" }));

    await waitFor(() => {
      expect(renewSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          periodCount: 1,
          note: "تمديد يدوي بدون وصل",
        }),
      );
    });
  });

  it("freezes the subscription from the customer panel", async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole("button", { name: "تجميد الاشتراك" }));
    await user.type(screen.getByLabelText("ملاحظة المدير"), "إيقاف مؤقت");
    await user.click(screen.getByRole("button", { name: "تنفيذ" }));

    await waitFor(() => {
      expect(setSubscriptionState).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          targetStatus: "frozen",
          note: "إيقاف مؤقت",
        }),
      );
    });
  });
});
