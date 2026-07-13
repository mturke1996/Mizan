import {
  ArrowLeft,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Wallet } from "@/domain/finance/finance-state";
import { formatMinorAmount } from "@/domain/money/money";
import { AppCard } from "@/shared/ui/AppCard";

interface WalletSummaryProps {
  wallets: Wallet[];
}

export function WalletSummary({ wallets }: WalletSummaryProps) {
  return (
    <section aria-labelledby="wallets-title" className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="wallets-title" className="text-lg font-bold text-ink">
          المحافظ والحسابات
        </h2>
        <Link
          to="/wallets"
          className="pressable flex min-h-11 items-center gap-1 rounded-sm px-2 text-sm font-semibold text-primary hover:bg-primary-soft"
        >
          عرض الكل
          <ArrowLeft aria-hidden="true" size={16} />
        </Link>
      </div>

      <AppCard className="divide-y divide-line overflow-hidden shadow-[var(--shadow-card)]">
        {wallets.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm font-bold text-ink">لا محافظ بعد</p>
            <p className="mt-2 text-xs text-muted">
              أضف محفظة ليظهر توزيع السيولة هنا.
            </p>
          </div>
        ) : (
          wallets.slice(0, 4).map((wallet) => (
            <Link
              key={wallet.id}
              to={`/wallets/${wallet.id}`}
              className="pressable flex min-h-18 items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
                <WalletCards aria-hidden="true" size={19} strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {wallet.name}
                </span>
                <span className="text-[11px] text-muted">
                  رصيد متاح · {wallet.currency}
                </span>
              </span>
              <span className="text-left">
                <strong className="numeric block text-sm font-bold text-ink">
                  {formatMinorAmount(wallet.balanceMinor, {
                    currency: wallet.currency,
                    locale: "en-US",
                  })}
                </strong>
                <span className="text-[10px] font-semibold text-muted">
                  {wallet.currency}
                </span>
              </span>
            </Link>
          ))
        )}
      </AppCard>
    </section>
  );
}
