import {
  addWallet,
  addWalletTransaction,
  applyTreasuryMovement,
  transferBetweenWallets,
  type FinanceState,
} from "./finance-state";

function createState(): FinanceState {
  return {
    wallets: [
      {
        id: "cash",
        name: "النقدية",
        currency: "LYD",
        balanceMinor: 1_000_000n,
      },
      {
        id: "bank",
        name: "المصرف",
        currency: "LYD",
        balanceMinor: 2_000_000n,
      },
    ],
    transactions: [],
  };
}

describe("addWalletTransaction", () => {
  it("credits an income to its wallet and records the transaction", () => {
    const next = addWalletTransaction(createState(), {
      id: "income-1",
      kind: "income",
      walletId: "cash",
      amountMinor: 250_000n,
      currency: "LYD",
      title: "دفعة عميل",
      occurredAt: "2026-07-13T10:00:00.000Z",
    });

    expect(next.wallets[0]?.balanceMinor).toBe(1_250_000n);
    expect(next.transactions[0]?.id).toBe("income-1");
  });

  it("debits an expense from its wallet", () => {
    const next = addWalletTransaction(createState(), {
      id: "expense-1",
      kind: "expense",
      walletId: "cash",
      amountMinor: 125_000n,
      currency: "LYD",
      title: "مستلزمات",
      occurredAt: "2026-07-13T10:00:00.000Z",
    });

    expect(next.wallets[0]?.balanceMinor).toBe(875_000n);
  });

  it("rejects a transaction in a different wallet currency", () => {
    expect(() =>
      addWalletTransaction(createState(), {
        id: "income-1",
        kind: "income",
        walletId: "cash",
        amountMinor: 250_000n,
        currency: "USD",
        title: "دفعة عميل",
        occurredAt: "2026-07-13T10:00:00.000Z",
      }),
    ).toThrow("عملة المعاملة لا تطابق عملة المحفظة");
  });
});

describe("addWallet", () => {
  it("adds a wallet with its opening balance", () => {
    const next = addWallet(createState(), {
      id: "savings",
      name: "الادخار",
      currency: "LYD",
      balanceMinor: 500_000n,
    });

    expect(next.wallets.at(-1)?.name).toBe("الادخار");
    expect(next.wallets.at(-1)?.balanceMinor).toBe(500_000n);
  });

  it("rejects duplicate wallet identifiers", () => {
    expect(() =>
      addWallet(createState(), {
        id: "cash",
        name: "نقدية أخرى",
        currency: "LYD",
        balanceMinor: 0n,
      }),
    ).toThrow("المحفظة موجودة بالفعل");
  });
});

describe("applyTreasuryMovement", () => {
  it("funds a wallet without treating it as income", () => {
    const next = applyTreasuryMovement(createState(), {
      id: "treasury-1",
      walletId: "cash",
      amountMinor: 250_000n,
      direction: "fund",
      occurredAt: "2026-07-17T10:00:00.000Z",
    });

    expect(next.wallets[0]?.balanceMinor).toBe(1_250_000n);
    expect(next.transactions[0]).toMatchObject({
      kind: "opening_balance",
      flow: "in",
      amountMinor: 250_000n,
    });
  });

  it("rejects a withdraw larger than the wallet balance", () => {
    expect(() =>
      applyTreasuryMovement(createState(), {
        id: "treasury-2",
        walletId: "cash",
        amountMinor: 1_500_000n,
        direction: "withdraw",
        occurredAt: "2026-07-17T10:00:00.000Z",
      }),
    ).toThrow("الرصيد غير كافٍ لإتمام المعاملة");
  });
});

describe("transferBetweenWallets", () => {
  it("moves value while preserving the combined balance", () => {
    const next = transferBetweenWallets(createState(), {
      id: "transfer-1",
      sourceWalletId: "cash",
      destinationWalletId: "bank",
      amountMinor: 400_000n,
      currency: "LYD",
      title: "تحويل إلى المصرف",
      occurredAt: "2026-07-13T10:00:00.000Z",
    });

    expect(next.wallets[0]?.balanceMinor).toBe(600_000n);
    expect(next.wallets[1]?.balanceMinor).toBe(2_400_000n);
    expect(
      next.wallets.reduce(
        (total, wallet) => total + wallet.balanceMinor,
        0n,
      ),
    ).toBe(3_000_000n);
    expect(next.transactions[0]?.kind).toBe("transfer");
  });

  it("rejects a transfer larger than the source balance", () => {
    expect(() =>
      transferBetweenWallets(createState(), {
        id: "transfer-1",
        sourceWalletId: "cash",
        destinationWalletId: "bank",
        amountMinor: 1_500_000n,
        currency: "LYD",
        title: "تحويل إلى المصرف",
        occurredAt: "2026-07-13T10:00:00.000Z",
      }),
    ).toThrow("الرصيد غير كافٍ لإتمام التحويل");
  });
});
