import { describe, expect, it } from "vitest";
import { computeClientProfile } from "./compute-client-profile";
import type { Client, Invoice } from "@/features/workspace/workspace-types";

const client: Client = {
  id: "c1",
  workspaceId: "ws",
  name: "متجر النور",
  phone: "0910000000",
  createdBy: "u1",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function invoice(
  partial: Partial<Invoice> & Pick<Invoice, "status" | "totalMinor" | "paidMinor">,
): Invoice {
  return {
    id: "i1",
    workspaceId: "ws",
    invoiceNumber: "001",
    businessClientId: "c1",
    clientName: "متجر النور",
    clientPhone: null,
    issueOn: "2026-07-01",
    dueOn: "2026-07-15",
    notes: null,
    taxRatePercent: 0,
    subtotalMinor: partial.totalMinor,
    taxMinor: 0n,
    currencyCode: "LYD",
    createdBy: "u1",
    clientId: "cid",
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...partial,
  };
}

describe("computeClientProfile", () => {
  it("aggregates open invoice AR and debts by client", () => {
    const profile = computeClientProfile({
      client,
      currency: "LYD",
      invoices: [
        invoice({ status: "sent", totalMinor: 10_000n, paidMinor: 2_000n }),
        invoice({ status: "paid", totalMinor: 5_000n, paidMinor: 5_000n }),
      ],
      debts: [
        {
          id: "d1",
          workspaceId: "ws",
          partyId: "p1",
          partyName: "متجر النور",
          partyPhone: "0910000000",
          direction: "receivable",
          principalMinor: 3_000n,
          balanceMinor: 3_000n,
          paidMinor: 0n,
          adjustedMinor: 0n,
          writtenOffMinor: 0n,
          currencyCode: "LYD",
          status: "open",
          dueOn: null,
          projectId: null,
          projectName: null,
          note: null,
          createdBy: "u1",
          createdAt: "2026-07-01T00:00:00Z",
          updatedAt: "2026-07-01T00:00:00Z",
        },
      ],
      transactions: [],
    });

    expect(profile.invoiceReceivableMinor).toBe(8_000n);
    expect(profile.debtReceivableMinor).toBe(3_000n);
    expect(profile.netExposureMinor).toBe(11_000n);
    expect(profile.openInvoiceCount).toBe(1);
  });
});
