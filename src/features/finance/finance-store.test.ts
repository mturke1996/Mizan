import type { FinanceState } from "@/domain/finance/finance-state";
import { createFinanceStore, demoFinanceState } from "./finance-store";

const initialState: FinanceState = {
  wallets: [
    {
      id: "cash",
      name: "النقدية",
      currency: "LYD",
      balanceMinor: 1_000_000n,
    },
  ],
  transactions: [],
};

describe("createFinanceStore", () => {
  it("deep-freezes the exported demo finance snapshot", () => {
    expect(Object.isFrozen(demoFinanceState)).toBe(true);
    expect(Object.isFrozen(demoFinanceState.wallets)).toBe(true);
    expect(Object.isFrozen(demoFinanceState.wallets[0])).toBe(true);
    expect(Object.isFrozen(demoFinanceState.transactions)).toBe(true);
    expect(Object.isFrozen(demoFinanceState.transactions[0])).toBe(true);
  });

  it("applies wallet transactions through the tested domain reducer", () => {
    const store = createFinanceStore(initialState);

    store.getState().addTransaction({
      id: "income-1",
      kind: "income",
      walletId: "cash",
      amountMinor: 250_000n,
      currency: "LYD",
      title: "دخل",
      occurredAt: "2026-07-13T10:00:00.000Z",
    });

    expect(store.getState().wallets[0]?.balanceMinor).toBe(1_250_000n);
    expect(store.getState().transactions).toHaveLength(1);
  });

  it("isolates replacement state from later caller mutations", () => {
    const store = createFinanceStore();
    const replacement: FinanceState = {
      wallets: [
        {
          id: "bank",
          name: "المصرف",
          currency: "LYD",
          balanceMinor: 2_000_000n,
        },
      ],
      transactions: [
        {
          id: "income-1",
          kind: "income",
          walletId: "bank",
          amountMinor: 500_000n,
          currency: "LYD",
          title: "دفعة",
          occurredAt: "2026-07-13T12:00:00Z",
        },
      ],
    };

    store.getState().replaceState(replacement);
    replacement.wallets[0]!.name = "متغيّر";
    replacement.transactions[0]!.title = "متغيّر";
    replacement.wallets.push({
      id: "cash",
      name: "النقدية",
      currency: "LYD",
      balanceMinor: 0n,
    });

    expect(store.getState().wallets).toEqual([
      expect.objectContaining({ id: "bank", name: "المصرف" }),
    ]);
    expect(store.getState().transactions[0]?.title).toBe("دفعة");
  });

  it("isolates added wallets and transactions from caller mutations", () => {
    const store = createFinanceStore();
    const wallet = {
      id: "cash",
      name: "النقدية",
      currency: "LYD" as const,
      balanceMinor: 1_000_000n,
    };
    store.getState().addWallet(wallet);
    wallet.name = "متغيّر";

    const transaction = {
      id: "income-1",
      kind: "income" as const,
      walletId: "cash",
      amountMinor: 250_000n,
      currency: "LYD" as const,
      title: "دخل",
      occurredAt: "2026-07-13T10:00:00.000Z",
    };
    store.getState().addTransaction(transaction);
    transaction.title = "متغيّر";

    expect(store.getState().wallets[0]?.name).toBe("النقدية");
    expect(store.getState().transactions[0]?.title).toBe("دخل");
  });
});
