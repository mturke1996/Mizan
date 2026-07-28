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
    <div className="space-y-2.5">
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
          <Link
            key={transaction.id}
            to={`/transactions/${transaction.id}`}
            className="pressable group flex items-center justify-between gap-3.5 rounded-2xl border border-border/70 bg-surface p-3.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md dark:border-dark-surface-raised dark:bg-dark-surface"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-inner ${presentation.tone}`}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-sm font-bold text-ink dark:text-dark-ink group-hover:text-primary">
                  {transaction.title}
                </span>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-muted dark:text-dark-muted">
                  <span className="rounded-md bg-surface-subtle px-1.5 py-0.5 font-semibold text-ink dark:bg-dark-surface-raised dark:text-dark-ink">
                    {kindLabel}
                  </span>
                  <span>•</span>
                  <span>
                    {walletNames.get(transaction.walletId) ?? "محفظة"}
                  </span>
                  <span>•</span>
                  <time dateTime={transaction.occurredAt}>
                    {dateFormatter.format(new Date(transaction.occurredAt))}
                  </time>
                </div>
              </div>
            </div>

            <div className="shrink-0 text-left" dir="ltr">
              <strong className={`numeric block text-base font-extrabold tracking-tight ${amountTone}`}>
                {signedAmount > 0n ? "+" : ""}
                {formatMinorAmount(signedAmount, {
                  currency: transaction.currency,
                  locale: "en-US",
                })}
              </strong>
              <span className="block text-[10px] font-bold text-muted dark:text-dark-muted">
                {transaction.currency}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
