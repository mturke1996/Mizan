import { describe, expect, it } from "vitest";
import { computeEconomicPosition } from "./compute-economic-position";
import type { Invoice } from "@/features/workspace/workspace-types";

function invoice(partial: Partial<Invoice> & Pick<Invoice, "status">): Invoice {
  const { status, ...rest } = partial;
  return {
    id: "inv-1",
    workspaceId: "ws-1",
    invoiceNumber: "001",
    businessClientId: null,
    clientName: "عميل",
    clientPhone: null,
    status,
    issueOn: "2026-07-01",
    dueOn: "2026-07-15",
    notes: null,
    taxRatePercent: 0,
    currencyCode: "LYD",
    subtotalMinor: 1000n,
    taxMinor: 0n,
    totalMinor: 1000n,
    paidMinor: 0n,
    createdBy: "user-1",
    clientId: "client-1",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    items: [],
    payments: [],
    ...rest,
  };
}

describe("computeEconomicPosition", () => {
  it("combines cash, invoice AR, debt AR, income outstanding minus debt AP", () => {
    const position = computeEconomicPosition({
      cashMinor: 50_000n,
      invoices: [
        invoice({ status: "sent", totalMinor: 10_000n, paidMinor: 2_000n }),
        invoice({ status: "paid", totalMinor: 5_000n, paidMinor: 5_000n }),
        invoice({ status: "draft", totalMinor: 20_000n, paidMinor: 0n }),
      ],
      debtSummary: { receivableMinor: 8_000n, payableMinor: 3_000n },
      incomeOutstandingMinor: 4_000n,
      currency: "LYD",
    });

    expect(position.invoiceReceivableMinor).toBe(8_000n);
    expect(position.grossAssetsMinor).toBe(70_000n);
    expect(position.netPositionMinor).toBe(67_000n);
  });

  it("ignores invoices in other currencies", () => {
    const position = computeEconomicPosition({
      cashMinor: 0n,
      invoices: [
        invoice({
          status: "sent",
          currencyCode: "USD",
          totalMinor: 100n,
          paidMinor: 0n,
        }),
      ],
      debtSummary: null,
      incomeOutstandingMinor: 0n,
      currency: "LYD",
    });
    expect(position.invoiceReceivableMinor).toBe(0n);
  });
});
