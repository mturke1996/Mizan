import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { CustomerFinancialReadPanel } from "./CustomerFinancialReadPanel";

const fetchCustomerFinancialSnapshot = vi.fn();
const fetchCustomerWallets = vi.fn();
const fetchCustomerTransactions = vi.fn();
const fetchCustomerProjects = vi.fn();
const fetchCustomerWorkers = vi.fn();

vi.mock("./supervisor-financial-read-api", async () => {
  const actual = await vi.importActual<
    typeof import("./supervisor-financial-read-api")
  >("./supervisor-financial-read-api");
  return {
    ...actual,
    fetchCustomerFinancialSnapshot: (...args: unknown[]) =>
      fetchCustomerFinancialSnapshot(...args),
    fetchCustomerWallets: (...args: unknown[]) => fetchCustomerWallets(...args),
    fetchCustomerTransactions: (...args: unknown[]) =>
      fetchCustomerTransactions(...args),
    fetchCustomerProjects: (...args: unknown[]) =>
      fetchCustomerProjects(...args),
    fetchCustomerWorkers: (...args: unknown[]) => fetchCustomerWorkers(...args),
  };
});

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CustomerFinancialReadPanel workspaceId="ws-1" />
    </QueryClientProvider>,
  );
}

describe("CustomerFinancialReadPanel", () => {
  beforeEach(() => {
    fetchCustomerFinancialSnapshot.mockResolvedValue({
      workspaceId: "ws-1",
      currencies: [
        {
          currencyCode: "LYD",
          walletBalanceMinor: "1000",
          projectIncomeMinor: "0",
          projectExpenseMinor: "0",
          projectNetMinor: "0",
          workerBalanceMinor: "0",
        },
      ],
    });
    fetchCustomerWallets.mockResolvedValue({ rows: [], total: 0 });
    fetchCustomerTransactions.mockResolvedValue({ rows: [], total: 0 });
    fetchCustomerProjects.mockResolvedValue({ rows: [], total: 0 });
    fetchCustomerWorkers.mockResolvedValue({ rows: [], total: 0 });
  });

  it("shows read-only badge and no write actions", async () => {
    renderPanel();
    expect(
      await screen.findByText("قراءة فقط · كل فتح مسجل"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/تعديل/)).not.toBeInTheDocument();
    expect(screen.queryByText(/حذف/)).not.toBeInTheDocument();
    expect(screen.queryByText(/عكس/)).not.toBeInTheDocument();
    expect(screen.queryByText(/إضافة معاملة/)).not.toBeInTheDocument();
  });
});
