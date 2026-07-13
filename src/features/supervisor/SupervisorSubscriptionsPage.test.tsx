import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { SupervisorCustomerRow } from "./customer-admin-types";
import { SupervisorSubscriptionsPage } from "./SupervisorSubscriptionsPage";

const row: SupervisorCustomerRow = {
  userId: "user-1",
  email: "a@example.com",
  displayName: "أحمد",
  accountStatus: "active",
  lastSignInAt: null,
  workspaceId: "ws-1",
  workspaceName: "مساحة أحمد",
  currencyCode: "LYD",
  workspaceStatus: "active",
  subscriptionId: "sub-1",
  subscriptionStatus: "active",
  planId: "plan-1",
  planName: "أساسي",
  trialEndsAt: null,
  currentPeriodEndsAt: "2026-08-01T00:00:00.000Z",
  scheduledStatus: null,
  scheduledStatusAt: null,
  effectiveSubscriptionStatus: "active",
  pendingPayments: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const fetchCustomers = vi.fn();
const fetchAdminPlans = vi.fn();
const renewSubscription = vi.fn();
const changeSubscriptionPlan = vi.fn();
const setSubscriptionState = vi.fn();
const scheduleSubscriptionState = vi.fn();

vi.mock("./customer-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./customer-admin-api")>(
    "./customer-admin-api",
  );
  return {
    ...actual,
    fetchCustomers: (...args: unknown[]) => fetchCustomers(...args),
  };
});

vi.mock("./billing-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./billing-admin-api")>(
    "./billing-admin-api",
  );
  return {
    ...actual,
    fetchAdminPlans: (...args: unknown[]) => fetchAdminPlans(...args),
    renewSubscription: (...args: unknown[]) => renewSubscription(...args),
    changeSubscriptionPlan: (...args: unknown[]) =>
      changeSubscriptionPlan(...args),
    setSubscriptionState: (...args: unknown[]) => setSubscriptionState(...args),
    scheduleSubscriptionState: (...args: unknown[]) =>
      scheduleSubscriptionState(...args),
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupervisorSubscriptionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorSubscriptionsPage", () => {
  beforeEach(() => {
    fetchCustomers.mockReset();
    fetchAdminPlans.mockReset();
    renewSubscription.mockReset();
    changeSubscriptionPlan.mockReset();
    setSubscriptionState.mockReset();
    scheduleSubscriptionState.mockReset();
    fetchCustomers.mockResolvedValue({ rows: [row], total: 1 });
    fetchAdminPlans.mockResolvedValue([
      {
        planId: "plan-1",
        code: "basic",
        name: "أساسي",
        priceMinor: 50000,
        currencyCode: "LYD",
        billingInterval: "monthly",
        intervalCount: 1,
        trialDays: 0,
        isPublic: true,
        isActive: true,
        features: { manual_payment: true },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        subscriptionCounts: {
          trialing: 0,
          active: 1,
          grace: 0,
          frozen: 0,
          expired: 0,
          cancelled: 0,
        },
      },
    ]);
    renewSubscription.mockResolvedValue(undefined);
    changeSubscriptionPlan.mockResolvedValue(undefined);
    setSubscriptionState.mockResolvedValue(undefined);
    scheduleSubscriptionState.mockResolvedValue(undefined);
  });

  it("renders status filters and renew actions", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "الاشتراكات" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تجريبي" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ينتهي خلال 7 أيام" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("أحمد")).toHaveLength(2);
  });

  it("renews via action dialog with clientId", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText("أحمد");
    await user.click(screen.getAllByRole("button", { name: "+1" })[0]!);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.type(screen.getByLabelText("ملاحظة المدير"), "تجديد شهري");
    await user.click(screen.getByRole("button", { name: "تنفيذ" }));

    await waitFor(() => {
      expect(renewSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: "ws-1",
          periodCount: 1,
          note: "تجديد شهري",
          clientId: expect.any(String),
        }),
      );
    });
  });

  it("does not double-submit while pending", async () => {
    const user = userEvent.setup();
    let resolveRenew: () => void = () => undefined;
    renewSubscription.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRenew = resolve;
        }),
    );

    renderPage();
    await screen.findAllByText("أحمد");
    await user.click(screen.getAllByRole("button", { name: "+3" })[0]!);
    await user.type(screen.getByLabelText("ملاحظة المدير"), "تجديد ربع");
    await user.click(screen.getByRole("button", { name: "تنفيذ" }));

    expect(await screen.findByText("جارٍ التنفيذ…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "جارٍ التنفيذ…" }));
    expect(renewSubscription).toHaveBeenCalledTimes(1);
    resolveRenew();
  });
});
