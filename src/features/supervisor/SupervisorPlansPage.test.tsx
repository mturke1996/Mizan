import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupervisorPlansPage, PLAN_FEATURES } from "./SupervisorPlansPage";

const fetchAdminPlans = vi.fn();
const createPlan = vi.fn();
const updatePlan = vi.fn();
const archivePlan = vi.fn();

vi.mock("./billing-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./billing-admin-api")>(
    "./billing-admin-api",
  );
  return {
    ...actual,
    fetchAdminPlans: (...args: unknown[]) => fetchAdminPlans(...args),
    createPlan: (...args: unknown[]) => createPlan(...args),
    updatePlan: (...args: unknown[]) => updatePlan(...args),
    archivePlan: (...args: unknown[]) => archivePlan(...args),
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

const existingPlan = {
  planId: "plan-1",
  code: "basic",
  name: "أساسي",
  priceMinor: 50000,
  currencyCode: "LYD",
  billingInterval: "monthly" as const,
  intervalCount: 1,
  trialDays: 14,
  isPublic: true,
  isActive: true,
  features: { manual_payment: true },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  subscriptionCounts: {
    trialing: 1,
    active: 2,
    grace: 0,
    frozen: 0,
    expired: 0,
    cancelled: 0,
  },
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SupervisorPlansPage />
    </QueryClientProvider>,
  );
}

describe("SupervisorPlansPage", () => {
  beforeEach(() => {
    fetchAdminPlans.mockResolvedValue([existingPlan]);
    createPlan.mockResolvedValue(existingPlan);
    updatePlan.mockResolvedValue(existingPlan);
    archivePlan.mockResolvedValue({ ...existingPlan, isActive: false });
  });

  it("exposes only manual_payment feature key", () => {
    expect(PLAN_FEATURES).toEqual(["manual_payment"]);
  });

  it("lists plans with price and subscriber counts", async () => {
    renderPage();

    expect(await screen.findByText("أساسي")).toBeInTheDocument();
    expect(screen.getByText(/عامة/)).toBeInTheDocument();
    expect(screen.getByText(/نشطة/)).toBeInTheDocument();
    expect(screen.getByText(/مشتركون: 3/)).toBeInTheDocument();
  });

  it("shows code only on create and archives with confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("أساسي");
    await user.click(screen.getByRole("button", { name: "خطة جديدة" }));
    expect(screen.getByLabelText("الرمز")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    await user.click(screen.getByRole("button", { name: "تعديل" }));
    expect(screen.queryByLabelText("الرمز")).not.toBeInTheDocument();
    expect(screen.getByText(/ثابت بعد الإنشاء/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    await user.click(screen.getByRole("button", { name: /أرشفة/ }));
    await user.type(screen.getByLabelText("ملاحظة المدير"), "خطة قديمة");
    await user.click(screen.getByRole("button", { name: "أرشفة" }));

    await waitFor(() => {
      expect(archivePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: "plan-1",
          note: "خطة قديمة",
          clientId: expect.any(String),
        }),
      );
    });
  });
});
