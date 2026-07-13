import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SupervisorCustomerRow } from "./customer-admin-types";
import { CustomerDetailsPanel } from "./CustomerDetailsPanel";

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
  subscriptionStatus: "trialing",
  planId: "plan-1",
  planName: "تجريبي",
  trialEndsAt: "2026-07-20T00:00:00.000Z",
  currentPeriodEndsAt: "2026-07-20T00:00:00.000Z",
  scheduledStatus: null,
  scheduledStatusAt: null,
  effectiveSubscriptionStatus: "trialing",
  pendingPayments: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const fetchCustomerDetail = vi.fn();
const supervisorSetAccountStatus = vi.fn();
const sendCustomerPasswordSetup = vi.fn();
const fetchPayments = vi.fn();

vi.mock("./customer-admin-api", async () => {
  const actual = await vi.importActual<typeof import("./customer-admin-api")>(
    "./customer-admin-api",
  );
  return {
    ...actual,
    fetchCustomerDetail: (...args: unknown[]) => fetchCustomerDetail(...args),
    sendCustomerPasswordSetup: (...args: unknown[]) =>
      sendCustomerPasswordSetup(...args),
  };
});

vi.mock("./supervisor-api", async () => {
  const actual = await vi.importActual<typeof import("./supervisor-api")>(
    "./supervisor-api",
  );
  return {
    ...actual,
    supervisorSetAccountStatus: (...args: unknown[]) =>
      supervisorSetAccountStatus(...args),
    fetchPayments: (...args: unknown[]) => fetchPayments(...args),
    invalidateSupervisor: vi.fn().mockResolvedValue(undefined),
  };
});

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CustomerDetailsPanel onClose={vi.fn()} userId="user-1" />
    </QueryClientProvider>,
  );
}

describe("CustomerDetailsPanel", () => {
  beforeEach(() => {
    fetchCustomerDetail.mockResolvedValue(customer);
    fetchPayments.mockResolvedValue({ rows: [], total: 0 });
    supervisorSetAccountStatus.mockResolvedValue(undefined);
    sendCustomerPasswordSetup.mockResolvedValue(undefined);
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("1024"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it("renders summary tabs and account actions", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("سارة")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "الملخص" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "الحساب والمساحة" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "الرسائل" })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "البيانات المالية — قراءة فقط" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "سجل القرارات" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "الحساب والمساحة" }));
    expect(
      screen.getByRole("button", { name: "إرسال رابط تعيين كلمة المرور" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("إعادة إرسال الدعوة")).not.toBeInTheDocument();
  });

  it("requires a note when suspending", async () => {
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("سارة");
    await user.click(screen.getByRole("tab", { name: "الحساب والمساحة" }));
    await user.click(screen.getByRole("button", { name: "إيقاف" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "إيقاف" }));
    expect(
      await screen.findByText("الملاحظة مطلوبة وبحد أدنى 3 أحرف"),
    ).toBeInTheDocument();
    expect(supervisorSetAccountStatus).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("ملاحظة المدير"), "إيقاف مؤقت");
    await user.click(screen.getByRole("button", { name: "إيقاف" }));

    await waitFor(() => {
      expect(supervisorSetAccountStatus).toHaveBeenCalledWith(
        "user-1",
        "suspended",
        "إيقاف مؤقت",
      );
    });
  });
});
