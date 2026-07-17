import type { FinanceTransaction } from "@/domain/finance/finance-state";
import type {
  Client,
  DebtSummary,
  Invoice,
} from "@/features/workspace/workspace-types";

const OPEN_INVOICE = new Set(["sent", "partially_paid", "overdue"]);

export interface ClientProfile {
  client: Client;
  invoiceCount: number;
  openInvoiceCount: number;
  invoiceReceivableMinor: bigint;
  invoicePaidMinor: bigint;
  debtReceivableMinor: bigint;
  debtPayableMinor: bigint;
  invoices: Invoice[];
  debts: DebtSummary[];
  relatedTransactions: FinanceTransaction[];
  netExposureMinor: bigint;
}

export function computeClientProfile(input: {
  client: Client;
  invoices: Invoice[];
  debts: DebtSummary[];
  transactions: FinanceTransaction[];
  currency: string;
}): ClientProfile {
  const { client, currency } = input;
  const nameKey = client.name.trim().toLowerCase();

  const invoices = input.invoices.filter(
    (invoice) =>
      invoice.currencyCode === currency &&
      (invoice.businessClientId === client.id ||
        invoice.clientName.trim().toLowerCase() === nameKey),
  );

  let invoiceReceivableMinor = 0n;
  let invoicePaidMinor = 0n;
  let openInvoiceCount = 0;
  for (const invoice of invoices) {
    invoicePaidMinor += invoice.paidMinor;
    if (!OPEN_INVOICE.has(invoice.status)) continue;
    const remaining = invoice.totalMinor - invoice.paidMinor;
    if (remaining > 0n) {
      invoiceReceivableMinor += remaining;
      openInvoiceCount += 1;
    }
  }

  const debts = input.debts.filter(
    (debt) =>
      debt.currencyCode === currency &&
      (debt.partyPhone === client.phone ||
        debt.partyName.trim().toLowerCase() === nameKey),
  );

  let debtReceivableMinor = 0n;
  let debtPayableMinor = 0n;
  for (const debt of debts) {
    if (debt.status === "settled" || debt.status === "written_off") continue;
    if (debt.direction === "receivable") {
      debtReceivableMinor += debt.balanceMinor;
    } else {
      debtPayableMinor += debt.balanceMinor;
    }
  }

  const relatedTransactions = input.transactions
    .filter((tx) => {
      if (tx.currency !== currency) return false;
      const title = tx.title.toLowerCase();
      return title.includes(nameKey) || title.includes(client.name.trim());
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 40);

  const netExposureMinor =
    invoiceReceivableMinor + debtReceivableMinor - debtPayableMinor;

  return {
    client,
    invoiceCount: invoices.length,
    openInvoiceCount,
    invoiceReceivableMinor,
    invoicePaidMinor,
    debtReceivableMinor,
    debtPayableMinor,
    invoices: [...invoices].sort((a, b) =>
      b.issueOn.localeCompare(a.issueOn),
    ),
    debts,
    relatedTransactions,
    netExposureMinor,
  };
}
