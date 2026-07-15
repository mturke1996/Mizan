import type { DebtWorkspaceSummary } from "@/features/workspace/workspace-types";
import type { Invoice } from "@/features/workspace/workspace-types";

export interface EconomicPosition {
  /** Sum of wallet balances in workspace currency. */
  cashMinor: bigint;
  /** Unpaid invoice totals (sent / partial / overdue). */
  invoiceReceivableMinor: bigint;
  /** Open debts owed to the workspace. */
  debtReceivableMinor: bigint;
  /** Open debts the workspace owes. */
  debtPayableMinor: bigint;
  /** Accrued personal income not yet withdrawn to a wallet. */
  incomeOutstandingMinor: bigint;
  /** cash + invoice AR + debt AR + income outstanding */
  grossAssetsMinor: bigint;
  /** debt AP */
  grossLiabilitiesMinor: bigint;
  /** grossAssets − grossLiabilities */
  netPositionMinor: bigint;
}

const OPEN_INVOICE_STATUSES = new Set([
  "sent",
  "partially_paid",
  "overdue",
]);

export function computeEconomicPosition(input: {
  cashMinor: bigint;
  invoices: Invoice[];
  debtSummary: Pick<DebtWorkspaceSummary, "receivableMinor" | "payableMinor"> | null;
  incomeOutstandingMinor: bigint;
  currency: string;
}): EconomicPosition {
  let invoiceReceivableMinor = 0n;
  for (const invoice of input.invoices) {
    if (invoice.currencyCode !== input.currency) continue;
    if (!OPEN_INVOICE_STATUSES.has(invoice.status)) continue;
    const remaining = invoice.totalMinor - invoice.paidMinor;
    if (remaining > 0n) invoiceReceivableMinor += remaining;
  }

  const debtReceivableMinor = input.debtSummary?.receivableMinor ?? 0n;
  const debtPayableMinor = input.debtSummary?.payableMinor ?? 0n;
  const incomeOutstandingMinor = input.incomeOutstandingMinor;

  const grossAssetsMinor =
    input.cashMinor +
    invoiceReceivableMinor +
    debtReceivableMinor +
    incomeOutstandingMinor;
  const grossLiabilitiesMinor = debtPayableMinor;
  const netPositionMinor = grossAssetsMinor - grossLiabilitiesMinor;

  return {
    cashMinor: input.cashMinor,
    invoiceReceivableMinor,
    debtReceivableMinor,
    debtPayableMinor,
    incomeOutstandingMinor,
    grossAssetsMinor,
    grossLiabilitiesMinor,
    netPositionMinor,
  };
}
