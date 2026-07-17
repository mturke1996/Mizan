import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Repeat2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
  FinanceTransaction,
  Wallet,
} from "@/domain/finance/finance-state";
import { formatMinorAmount } from "@/domain/money/money";
import { TransactionList } from "@/features/transactions/TransactionList";

interface RecentTransactionsProps {
  transactions: FinanceTransaction[];
  wallets: Wallet[];
}

export function RecentTransactions({
  transactions,
  wallets,
}: RecentTransactionsProps) {
  const recent = transactions.slice(0, 5);
  const walletNames = new Map(
    wallets.map((wallet) => [wallet.id, wallet.name]),
  );
  const dateFormatter = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const presentation = {
    income: {
      label: "دخل",
      icon: ArrowDownLeft,
      tone: "bg-success-soft text-success",
    },
    expense: {
      label: "مصروف",
      icon: ArrowUpRight,
      tone: "bg-danger-soft text-danger",
    },
    transfer: {
      label: "تحويل",
      icon: Repeat2,
      tone: "bg-info-soft text-info",
    },
  } as const;

  return (
    <section
      aria-labelledby="transactions-title"
      className="overflow-hidden rounded-[18px] border border-line bg-surface pb-1 shadow-[0_8px_24px_rgb(27_30_60/4%)] md:pb-0"
    >
      <div className="mb-1 flex items-center justify-between border-b border-line px-4 py-3.5 sm:px-5 md:mb-0 md:py-4">
        <h2 id="transactions-title" className="text-sm font-bold text-ink sm:text-base">
          أحدث المعاملات
        </h2>
        <Link
          to="/transactions"
          className="pressable flex min-h-9 items-center gap-1 rounded-xl px-2 text-xs font-bold text-primary hover:bg-primary-soft sm:text-sm"
        >
          عرض الكل
          <ArrowLeft aria-hidden="true" size={15} />
        </Link>
      </div>

      <div className="px-1 md:hidden">
        <TransactionList transactions={recent.slice(0, 4)} wallets={wallets} />
      </div>

      <div className="hidden overflow-x-auto md:block">
        {recent.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <p className="font-bold text-ink">لا توجد معاملات بعد</p>
              <p className="mt-2 text-xs text-muted">
                ابدأ بأول دخل أو مصروف لتظهر الحركة هنا.
              </p>
            </div>
          </div>
        ) : (
          <table className="w-full min-w-[42rem] border-collapse text-right text-xs">
            <thead>
              <tr className="bg-canvas/70 text-[10px] font-semibold text-muted">
                <th scope="col" className="px-5 py-3">
                  البيان
                </th>
                <th scope="col" className="px-4 py-3">
                  النوع
                </th>
                <th scope="col" className="px-4 py-3">
                  المحفظة
                </th>
                <th scope="col" className="px-4 py-3">
                  التاريخ
                </th>
                <th scope="col" className="px-5 py-3 text-left">
                  المبلغ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((transaction) => {
                const item = presentation[transaction.kind];
                const Icon = item.icon;
                const amount =
                  transaction.kind === "expense"
                    ? -transaction.amountMinor
                    : transaction.amountMinor;
                const amountPrefix =
                  transaction.kind === "income"
                    ? "+"
                    : transaction.kind === "expense"
                      ? ""
                      : "";
                const walletLabel =
                  transaction.kind === "transfer"
                    ? `${walletNames.get(transaction.walletId) ?? "محفظة"} ← ${
                        walletNames.get(transaction.destinationWalletId) ??
                        "محفظة"
                      }`
                    : (walletNames.get(transaction.walletId) ?? "محفظة");

                return (
                  <tr
                    key={transaction.id}
                    className="transition-colors hover:bg-canvas/65"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        to={`/transactions/${transaction.id}`}
                        className="flex items-center gap-3"
                      >
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-[9px] ${item.tone}`}
                        >
                          <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
                        </span>
                        <span className="max-w-56 truncate font-semibold text-ink">
                          {transaction.title}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-muted">{item.label}</td>
                    <td className="max-w-48 truncate px-4 py-3.5 text-muted">
                      {walletLabel}
                    </td>
                    <td className="px-4 py-3.5 text-muted">
                      <time dateTime={transaction.occurredAt}>
                        {dateFormatter.format(
                          new Date(transaction.occurredAt),
                        )}
                      </time>
                    </td>
                    <td className="px-5 py-3.5 text-left">
                      <span
                        className={`numeric block font-bold ${
                          transaction.kind === "income"
                            ? "text-success"
                            : transaction.kind === "expense"
                              ? "text-danger"
                              : "text-info"
                        }`}
                      >
                        {amountPrefix}
                        {formatMinorAmount(amount, {
                          currency: transaction.currency,
                          locale: "en-US",
                        })}
                      </span>
                      <span className="text-[9px] font-semibold text-muted">
                        {transaction.currency}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
