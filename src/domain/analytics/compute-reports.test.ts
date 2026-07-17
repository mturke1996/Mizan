import { describe, expect, it } from "vitest";
import {
  computeCashFlowMonths,
  computeInvoiceAging,
  computePeriodPnL,
} from "./compute-reports";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import type { Invoice } from "@/features/workspace/workspace-types";

const tx = (
  partial: Pick<FinanceTransaction, "kind" | "amountMinor" | "occurredAt"> &
    Partial<FinanceTransaction>,
): FinanceTransaction =>
  ({
    id: "t1",
    walletId: "w1",
    currency: "LYD",
    title: "test",
    ...partial,
  }) as FinanceTransaction;

describe("compute-reports", () => {
  it("builds period P&L from income and expense", () => {
    const pnl = computePeriodPnL({
      currency: "LYD",
      from: new Date("2026-07-01T00:00:00Z"),
      to: new Date("2026-07-31T23:59:59Z"),
      transactions: [
        tx({
          kind: "income",
          amountMinor: 10_000n,
          occurredAt: "2026-07-10T10:00:00Z",
          categoryId: "cat-1",
        }),
        tx({
          kind: "expense",
          amountMinor: 3_000n,
          occurredAt: "2026-07-12T10:00:00Z",
          categoryId: "cat-2",
        }),
      ],
      categoryNames: new Map([
        ["cat-1", "مبيعات"],
        ["cat-2", "تشغيل"],
      ]),
    });
    expect(pnl.incomeMinor).toBe(10_000n);
    expect(pnl.expenseMinor).toBe(3_000n);
    expect(pnl.netMinor).toBe(7_000n);
  });

  it("ages open invoices into buckets", () => {
    const aging = computeInvoiceAging({
      currency: "LYD",
      now: new Date("2026-07-17T12:00:00Z"),
      invoices: [
        {
          id: "1",
          workspaceId: "ws",
          invoiceNumber: "A",
          businessClientId: null,
          clientName: "x",
          clientPhone: null,
          status: "overdue",
          issueOn: "2026-04-01",
          dueOn: "2026-04-01",
          notes: null,
          taxRatePercent: 0,
          subtotalMinor: 100n,
          taxMinor: 0n,
          totalMinor: 100n,
          paidMinor: 0n,
          currencyCode: "LYD",
          createdBy: "u",
          clientId: "c",
          createdAt: "2026-04-01T00:00:00Z",
          updatedAt: "2026-04-01T00:00:00Z",
        } satisfies Invoice,
      ],
    });
    expect(aging[3]?.count).toBe(1);
    expect(aging[3]?.amountMinor).toBe(100n);
  });

  it("returns cash flow months", () => {
    const months = computeCashFlowMonths({
      currency: "LYD",
      months: 2,
      now: new Date("2026-07-15T00:00:00Z"),
      transactions: [
        tx({
          kind: "income",
          amountMinor: 5_000n,
          occurredAt: "2026-07-02T00:00:00Z",
        }),
      ],
    });
    expect(months).toHaveLength(2);
    expect(months.at(-1)?.incomeMinor).toBe(5_000n);
  });
});
