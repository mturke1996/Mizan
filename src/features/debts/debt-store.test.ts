import { createDebtStore } from "./debt-store";

describe("createDebtStore", () => {
  it("derives partial and written-off states from append-only signed entries", () => {
    const store = createDebtStore();
    const debtId = store.getState().createDebt({
      direction: "receivable",
      partyName: "محمد",
      partyPhone: "0910000000",
      principalMinor: 10_000n,
      currencyCode: "LYD",
      dueOn: "2026-07-20",
      projectId: null,
      note: "فاتورة",
      clientId: "create-1",
    });

    store.getState().postEntry({
      debtId,
      entryType: "payment",
      amountMinor: -4_000n,
      occurredOn: "2026-07-13",
      note: "دفعة أولى",
      clientId: "payment-1",
    });

    expect(store.getState().debts[0]).toMatchObject({
      balanceMinor: 6_000n,
      paidMinor: 4_000n,
      status: "partial",
    });

    store.getState().postEntry({
      debtId,
      entryType: "write_off",
      amountMinor: -6_000n,
      occurredOn: "2026-07-14",
      note: "شطب الرصيد",
      clientId: "write-off-1",
    });

    expect(store.getState().debts[0]).toMatchObject({
      balanceMinor: 0n,
      writtenOffMinor: 6_000n,
      status: "written_off",
    });
    expect(store.getState().entriesByDebt[debtId]).toHaveLength(3);
  });

  it("applies adjustments, rejects overpayment, and enforces workspace-wide replay", () => {
    const store = createDebtStore();
    const debtId = store.getState().createDebt({
      direction: "payable",
      partyName: "مورد",
      principalMinor: 5_000n,
      currencyCode: "LYD",
      clientId: "create-adj",
    });

    store.getState().postEntry({
      debtId,
      entryType: "adjustment",
      amountMinor: 1_000n,
      occurredOn: "2026-07-13",
      note: "زيادة فاتورة",
      clientId: "adj-1",
    });
    expect(store.getState().debts[0]?.balanceMinor).toBe(6_000n);

    expect(() =>
      store.getState().postEntry({
        debtId,
        entryType: "payment",
        amountMinor: -7_000n,
        occurredOn: "2026-07-13",
        clientId: "pay-over",
      }),
    ).toThrow("لا يمكن أن تتجاوز الحركة رصيد الدين");

    const first = store.getState().postEntry({
      debtId,
      entryType: "payment",
      amountMinor: -2_000n,
      occurredOn: "2026-07-14",
      financialEventId: "evt-1",
      clientId: "pay-1",
    });
    const replay = store.getState().postEntry({
      debtId,
      entryType: "payment",
      amountMinor: -2_000n,
      occurredOn: "2026-07-14",
      financialEventId: "evt-1",
      clientId: "pay-1",
    });
    expect(replay.id).toBe(first.id);

    expect(() =>
      store.getState().postEntry({
        debtId,
        entryType: "payment",
        amountMinor: -2_000n,
        occurredOn: "2026-07-14",
        financialEventId: "evt-2",
        clientId: "pay-1",
      }),
    ).toThrow("تعارضت إعادة المحاولة مع حركة سابقة");
  });
});
