import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { PaymentRequestRow } from "./supervisor-api";
import { SupervisorPaymentsPage } from "./SupervisorPaymentsPage";

const pending: PaymentRequestRow = {
  id: "pay-1",
  workspaceId: "ws-1",
  workspaceName: "مساحة أحمد",
  requesterName: "أحمد",
  planId: "plan-1",
  planName: "أساسي",
  periodCount: 1,
  amountMinor: 50000,
  currencyCode: "LYD",
  status: "pending",
  requesterNote: "حوّلت عبر مصرفي",
  reviewNote: null,
  reviewedByName: null,
  reviewedAt: null,
  proofObjectPath: "proofs/a.png",
  createdAt: "2026-07-01T10:00:00.000Z",
};

const fetchPayments = vi.fn();
const fetchAdminPlans = vi.fn();
const reviewPayment = vi.fn();
const createPaymentProofUrl = vi.fn();

vi.mock("./supervisor-api", async () => {
  const actual = await vi.importActual<typeof import("./supervisor-api")>(
    "./supervisor-api",
  );
  return {
    ...actual,
    fetchPayments: (...args: unknown[]) => fetchPayments(...args),
    reviewPayment: (...args: unknown[]) => reviewPayment(...args),
    createPaymentProofUrl: (...args: unknown[]) =>
      createPaymentProofUrl(...args),
    invalidateSupervisor: vi.fn().mockResolvedValue(undefined),
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

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupervisorPaymentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorPaymentsPage", () => {
  beforeEach(() => {
    fetchPayments.mockReset();
    fetchAdminPlans.mockReset();
    reviewPayment.mockReset();
    createPaymentProofUrl.mockReset();
    fetchPayments.mockResolvedValue({ rows: [pending], total: 1 });
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
    reviewPayment.mockResolvedValue(undefined);
    createPaymentProofUrl.mockResolvedValue("https://example.com/proof");
  });

  it("shows status tabs and payment row", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "المدفوعات" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "بانتظار المراجعة" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تمت الموافقة" })).toBeInTheDocument();
    const workspaces = await screen.findAllByText("مساحة أحمد");
    expect(workspaces.length).toBeGreaterThan(0);
  });

  it("approves via dialog when proof exists", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText("مساحة أحمد");
    await user.click(screen.getAllByRole("button", { name: "موافقة" })[0]!);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/أساسي/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "موافقة" }));

    await waitFor(() => {
      expect(reviewPayment).toHaveBeenCalledWith("pay-1", "approve", "");
    });
  });

  it("requires note on reject", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findAllByText("مساحة أحمد");
    await user.click(screen.getAllByRole("button", { name: "رفض" })[0]!);
    await user.click(screen.getByRole("button", { name: "رفض الطلب" }));

    expect(
      await screen.findByText("الملاحظة مطلوبة وبحد أدنى 3 أحرف"),
    ).toBeInTheDocument();
    expect(reviewPayment).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("ملاحظة المدير"), "إثبات غير واضح");
    await user.click(screen.getByRole("button", { name: "رفض الطلب" }));

    await waitFor(() => {
      expect(reviewPayment).toHaveBeenCalledWith(
        "pay-1",
        "reject",
        "إثبات غير واضح",
      );
    });
  });
});
