export type CurrencyCode = "LYD" | "USD" | "EUR" | (string & {});

export interface BalanceEntry {
  amountMinor: bigint;
}

export interface TransferInput {
  eventId: string;
  sourceWalletId: string;
  destinationWalletId: string;
  amountMinor: bigint;
  currency: CurrencyCode;
}

export interface LedgerEntry {
  eventId: string;
  walletId: string;
  amountMinor: bigint;
  currency: CurrencyCode;
}

export interface ProjectEvent {
  kind: "income" | "expense";
  amountMinor: bigint;
}

export interface ProjectSummary {
  incomeMinor: bigint;
  expenseMinor: bigint;
  profitMinor: bigint;
}

export function calculateWalletBalance(
  openingBalanceMinor: bigint,
  entries: readonly BalanceEntry[],
): bigint {
  return entries.reduce(
    (balance, entry) => balance + entry.amountMinor,
    openingBalanceMinor,
  );
}

export function createTransferEntries(input: TransferInput): LedgerEntry[] {
  if (input.sourceWalletId === input.destinationWalletId) {
    throw new Error("يجب اختيار محفظتين مختلفتين");
  }

  if (input.amountMinor <= 0n) {
    throw new Error("يجب أن يكون المبلغ أكبر من صفر");
  }

  return [
    {
      eventId: input.eventId,
      walletId: input.sourceWalletId,
      amountMinor: -input.amountMinor,
      currency: input.currency,
    },
    {
      eventId: input.eventId,
      walletId: input.destinationWalletId,
      amountMinor: input.amountMinor,
      currency: input.currency,
    },
  ];
}

export function calculateProjectSummary(
  events: readonly ProjectEvent[],
): ProjectSummary {
  const summary = events.reduce(
    (totals, event) => {
      if (event.amountMinor <= 0n) {
        throw new Error("يجب أن تكون مبالغ المشروع أكبر من صفر");
      }

      if (event.kind === "income") {
        totals.incomeMinor += event.amountMinor;
      } else {
        totals.expenseMinor += event.amountMinor;
      }

      return totals;
    },
    { incomeMinor: 0n, expenseMinor: 0n },
  );

  return {
    ...summary,
    profitMinor: summary.incomeMinor - summary.expenseMinor,
  };
}
