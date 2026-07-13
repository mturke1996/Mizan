import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { SupervisorCustomerRow } from "./customer-admin-types";
import { SupervisorCustomersPage } from "./SupervisorCustomersPage";

const customer: SupervisorCustomerRow = {
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
  subscriptionStatus: "active",
  planId: "11111111-1111-4111-8111-111111111111",
  planName: "أساسي",
  trialEndsAt: null,
  currentPeriodEndsAt: "2026-08-01T00:00:00.000Z",
  scheduledStatus: null,
  scheduledStatusAt: null,
  effectiveSubscriptionStatus: "active",
  pendingPayments: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const fetchCustomers = vi.fn();
const fetchAdminPlans = vi.fn();
const fetchCustomerDetail = vi.fn();

vi.mock("./customer-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./customer-admin-api")>(
    "./customer-admin-api",
  );
  return {
    ...actual,
    fetchCustomers: (...args: unknown[]) => fetchCustomers(...args),
    fetchCustomerDetail: (...args: unknown[]) => fetchCustomerDetail(...args),
    createCustomer: vi.fn(),
    sendCustomerPasswordSetup: vi.fn(),
  };
});

vi.mock("./billing-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./billing-admin-api")>(
    "./billing-admin-api",
  );
  return {
    ...actual,
    fetchAdminPlans: (...args: unknown[]) => fetchAdminPlans(...args),
  };
});

function renderPage(initial = "/supervisor/customers") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/supervisor/customers" element={<SupervisorCustomersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorCustomersPage", () => {
  beforeEach(() => {
    fetchCustomers.mockResolvedValue({ rows: [customer], total: 1 });
    fetchAdminPlans.mockResolvedValue([
      {
        planId: customer.planId,
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
    fetchCustomerDetail.mockResolvedValue(customer);
  });

  it("loads customers and shows table columns", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "العملاء" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "العميل" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "الحساب" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "المساحة" })).toBeInTheDocument();
    expect(screen.getAllByText("أحمد").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "إضافة عميل" })).toBeInTheDocument();
  });

  it("resets page when account filter changes and syncs URL", async () => {
    const user = userEvent.setup();
    renderPage("/supervisor/customers?page=2");

    await screen.findAllByText("أحمد");
    await user.selectOptions(
      screen.getByLabelText("حالة الحساب"),
      "suspended",
    );

    await waitFor(() => {
      expect(fetchCustomers).toHaveBeenCalledWith(
        expect.objectContaining({
          accountStatus: "suspended",
          offset: 0,
        }),
      );
    });
  });

  it("keeps selected customer in URL and opens details", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText("أحمد");
    const rows = screen.getAllByRole("row");
    await user.click(rows.find((row) => within(row).queryByText("أحمد"))!);

    expect(
      await screen.findByRole("heading", { name: "أحمد" }),
    ).toBeInTheDocument();
    expect(fetchCustomerDetail).toHaveBeenCalledWith("user-1");
  });
});
