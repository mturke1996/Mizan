import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Repeat2,
  SearchX,
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
  FinanceTransaction,
  Wallet,
} from "@/domain/finance/finance-state";
import { signedTransactionAmount } from "@/domain/finance/finance-state";
import { formatMinorAmount } from "@/domain/money/money";
import { AppCard } from "@/shared/ui/AppCard";

interface TransactionListProps {
  transactions: FinanceTransaction[];
  wallets: Wallet[];
  emptyMessage?: string;
}

const dateFormatter = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
  day: "numeric",
  month: "short",
});

const transactionPresentation = {
  income: {
    icon: ArrowDownLeft,
    tone: "bg-success-soft text-success",
    label: "دخل",
  },
  expense: {
    icon: ArrowUpRight,
    tone: "bg-danger-soft text-danger",
    label: "مصروف",
  },
  transfer: {
    icon: Repeat2,
    tone: "bg-info-soft text-info",
    label: "تحويل",
  },
  opening_balance: {
    icon: Landmark,
    tone: "bg-primary-soft text-primary",
    label: "خزينة",
  },
} as const;

export function TransactionList({
  transactions,
  wallets,
  emptyMessage = "لا توجد معاملات بعد",
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <AppCard
        role="status"
        className="flex min-h-56 flex-col items-center justify-center px-6 text-center"
      >
        <span className="mb-4 flex size-12 items-center justify-center rounded-md bg-surface-subtle text-muted">
          <SearchX aria-hidden="true" size={23} />
        </span>
        <p className="font-bold text-ink">{emptyMessage}</p>
        <p className="mt-1 text-sm text-muted">
          غيّر البحث أو الفلتر، أو أضف معاملة جديدة.
        </p>
      </AppCard>
    );
  }

  const walletNames = new Map(
    wallets.map((wallet) => [wallet.id, wallet.name]),
  );

  return (
    <AppCard className="overflow-hidden">
      <ul className="divide-y divide-line">
        {transactions.map((transaction) => {
          const presentation = transactionPresentation[transaction.kind];
          const Icon = presentation.icon;
          const signedAmount = signedTransactionAmount(transaction);
          const kindLabel =
            transaction.kind === "opening_balance"
              ? transaction.flow === "in"
                ? "تمويل خزينة"
                : "سحب خزينة"
              : presentation.label;
          const amountTone =
            signedAmount > 0n
              ? "text-success"
              : transaction.kind === "expense" ||
                  (transaction.kind === "opening_balance" &&
                    transaction.flow === "out")
                ? "text-danger"
                : "text-ink";

          return (
            <li key={transaction.id}>
              <Link
                to={`/transactions/${transaction.id}`}
                className="pressable flex min-h-20 items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
              >
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-sm ${presentation.tone}`}
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {transaction.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <span>{kindLabel}</span>
                    <span aria-hidden="true">•</span>
                    <span>
                      {walletNames.get(transaction.walletId) ?? "محفظة"}
                    </span>
                    <span aria-hidden="true">•</span>
                    <time dateTime={transaction.occurredAt}>
                      {dateFormatter.format(new Date(transaction.occurredAt))}
                    </time>
                  </span>
                </span>
                <span className="shrink-0 text-left">
                  <strong className={`numeric block text-sm ${amountTone}`}>
                    {signedAmount > 0n ? "+" : ""}
                    {formatMinorAmount(signedAmount, {
                      currency: transaction.currency,
                      locale: "en-US",
                    })}
                  </strong>
                  <span className="text-[10px] font-semibold text-muted">
                    {transaction.currency}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </AppCard>
  );
}
