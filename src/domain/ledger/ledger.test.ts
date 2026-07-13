import {
  calculateProjectSummary,
  calculateWalletBalance,
  createTransferEntries,
} from "./ledger";

describe("calculateWalletBalance", () => {
  it("adds signed ledger entries to the opening balance", () => {
    const balance = calculateWalletBalance(1_000_000n, [
      { amountMinor: 250_000n },
      { amountMinor: -125_000n },
    ]);

    expect(balance).toBe(1_125_000n);
  });
});

describe("createTransferEntries", () => {
  it("creates equal debit and credit entries", () => {
    const entries = createTransferEntries({
      eventId: "transfer-1",
      sourceWalletId: "cash",
      destinationWalletId: "bank",
      amountMinor: 500_000n,
      currency: "LYD",
    });

    expect(entries).toEqual([
      {
        eventId: "transfer-1",
        walletId: "cash",
        amountMinor: -500_000n,
        currency: "LYD",
      },
      {
        eventId: "transfer-1",
        walletId: "bank",
        amountMinor: 500_000n,
        currency: "LYD",
      },
    ]);
  });

  it("rejects transfers to the same wallet", () => {
    expect(() =>
      createTransferEntries({
        eventId: "transfer-1",
        sourceWalletId: "cash",
        destinationWalletId: "cash",
        amountMinor: 500_000n,
        currency: "LYD",
      }),
    ).toThrow("يجب اختيار محفظتين مختلفتين");
  });

  it("rejects zero or negative transfer amounts", () => {
    expect(() =>
      createTransferEntries({
        eventId: "transfer-1",
        sourceWalletId: "cash",
        destinationWalletId: "bank",
        amountMinor: 0n,
        currency: "LYD",
      }),
    ).toThrow("يجب أن يكون المبلغ أكبر من صفر");
  });
});

describe("calculateProjectSummary", () => {
  it("derives income, expense, and profit from project events", () => {
    const summary = calculateProjectSummary([
      { kind: "income", amountMinor: 2_000_000n },
      { kind: "expense", amountMinor: 650_000n },
      { kind: "expense", amountMinor: 150_000n },
    ]);

    expect(summary).toEqual({
      incomeMinor: 2_000_000n,
      expenseMinor: 800_000n,
      profitMinor: 1_200_000n,
    });
  });

  it("rejects zero or negative project event amounts", () => {
    expect(() =>
      calculateProjectSummary([
        { kind: "expense", amountMinor: -100_000n },
      ]),
    ).toThrow("يجب أن تكون مبالغ المشروع أكبر من صفر");
  });
});
