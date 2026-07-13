const rpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import {
  fetchCustomerFinancialSnapshot,
  fetchCustomerWallets,
  mapFinancialSnapshot,
  mapWalletReadRow,
} from "./supervisor-financial-read-api";

describe("supervisor-financial-read-api mapping", () => {
  it("maps currency snapshots without combining currencies", () => {
    const snapshot = mapFinancialSnapshot({
      workspace_id: "ws-1",
      currencies: [
        {
          currency_code: "LYD",
          wallet_balance_minor: "1000",
          project_income_minor: "2000",
          project_expense_minor: "500",
          project_net_minor: "1500",
          worker_balance_minor: "100",
        },
        {
          currency_code: "USD",
          wallet_balance_minor: "50",
          project_income_minor: "0",
          project_expense_minor: "0",
          project_net_minor: "0",
          worker_balance_minor: "0",
        },
      ],
    });

    expect(snapshot.currencies).toHaveLength(2);
    expect(snapshot.currencies[0]?.currencyCode).toBe("LYD");
    expect(snapshot.currencies[1]?.currencyCode).toBe("USD");
  });

  it("maps wallet rows from snake_case", () => {
    const wallet = mapWalletReadRow({
      id: "w1",
      name: "نقدي",
      currency_code: "LYD",
      status: "active",
      balance_minor: "25000",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
    expect(wallet.balanceMinor).toBe("25000");
    expect(wallet.currencyCode).toBe("LYD");
  });
});

describe("supervisor-financial-read-api calls", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("loads snapshot and wallets via audited RPCs", async () => {
    rpc
      .mockResolvedValueOnce({
        data: {
          workspace_id: "ws-1",
          currencies: [
            {
              currency_code: "LYD",
              wallet_balance_minor: "10",
              project_income_minor: "0",
              project_expense_minor: "0",
              project_net_minor: "0",
              worker_balance_minor: "0",
            },
          ],
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          rows: [
            {
              id: "w1",
              name: "نقدي",
              currency_code: "LYD",
              status: "active",
              balance_minor: "10",
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
          ],
          total: 1,
        },
        error: null,
      });

    const snapshot = await fetchCustomerFinancialSnapshot("ws-1");
    const wallets = await fetchCustomerWallets("ws-1", 20, 0);

    expect(rpc).toHaveBeenCalledWith("supervisor_customer_financial_snapshot", {
      p_workspace_id: "ws-1",
    });
    expect(rpc).toHaveBeenCalledWith("supervisor_customer_wallets", {
      p_workspace_id: "ws-1",
      p_limit: 20,
      p_offset: 0,
    });
    expect(snapshot.currencies[0]?.currencyCode).toBe("LYD");
    expect(wallets.total).toBe(1);
  });
});
