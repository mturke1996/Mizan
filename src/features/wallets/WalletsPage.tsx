import {
  ArrowLeftRight,
  Plus,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

const WALLET_TONES = [
  "bg-primary",
  "bg-success",
  "bg-warning",
  "bg-info",
  "bg-danger",
] as const;

function sharePercent(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.max(0, Math.min(100, Number((part * 100n) / total)));
}

export function WalletsPage() {
  const { currency } = useWorkspace();
  const { wallets, transactions, isLoading, walletsError, refresh } =
    useFinanceView();
  const currencyWallets = [...wallets]
    .filter((wallet) => wallet.currency === currency)
    .sort((a, b) => (a.balanceMinor === b.balanceMinor ? 0 : a.balanceMinor > b.balanceMinor ? -1 : 1));
  const otherWallets = wallets.filter((wallet) => wallet.currency !== currency);
  const totalBalance = currencyWallets.reduce(
    (total, wallet) => total + wallet.balanceMinor,
    0n,
  );
  const hasTransferPair = wallets.some((wallet) =>
    wallets.some(
      (candidate) =>
        candidate.id !== wallet.id && candidate.currency === wallet.currency,
    ),
  );
  const largest = currencyWallets[0];
  const recent = [...transactions]
    .filter(
      (tx) =>
        tx.currency === currency &&
        wallets.some(
          (wallet) =>
            wallet.id === tx.walletId ||
            (tx.kind === "transfer" && wallet.id === tx.destinationWalletId),
        ),
    )
    .slice(0, 5);

  return (
    <div className="page-enter px-4 pb-6 sm:px-6" dir="rtl">
      <PageHeader
        title="المحافظ"
        subtitle="خزائنك الفعلية — رصيد واضح وتحويل فوري."
        action={
          <Link
            to="/wallets/new"
            aria-label="إضافة محفظة"
            className="pressable flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          >
            <Plus aria-hidden="true" size={18} />
            إضافة
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3" role="status">
          <AppCard className="h-44 animate-pulse rounded-[24px] bg-surface-subtle" />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((item) => (
              <AppCard
                key={item}
                className="h-16 animate-pulse bg-surface-subtle"
              />
            ))}
          </div>
          <span className="sr-only">جاري تحميل المحافظ</span>
        </div>
      ) : walletsError ? (
        <ErrorState message={walletsError} onRetry={() => void refresh()} />
      ) : wallets.length === 0 ? (
        <AppCard className="rounded-[24px] p-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <WalletCards aria-hidden="true" size={26} />
          </span>
          <h2 className="mt-4 text-lg font-bold text-ink">ابدأ بمحفظتك الأولى</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            ابدأ بمحفظة نقدية أو مصرفية لتتبع الرصيد والتحويلات بدقة.
          </p>
          <Link
            to="/wallets/new"
            className="pressable mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-on"
          >
            <Plus aria-hidden="true" size={17} />
            إنشاء محفظة
          </Link>
        </AppCard>
      ) : (
        <>
          <section
            aria-labelledby="wallet-total-title"
            className="relative mb-4 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_14px_40px_rgb(27_30_60/7%)]"
          >
            <div className="relative overflow-hidden bg-[linear-gradient(155deg,rgb(67_56_202/16%),rgb(16_185_129/8%)_55%,rgb(245_158_11/10%))] px-5 py-6 sm:px-6">
              <div className="pointer-events-none absolute -start-12 top-0 size-44 rounded-full bg-primary/15 blur-3xl" />
              <div className="pointer-events-none absolute -end-10 bottom-0 size-40 rounded-full bg-success/15 blur-3xl" />
              <div className="relative">
                <p
                  id="wallet-total-title"
                  className="text-[11px] font-semibold tracking-wide text-muted"
                >
                  إجمالي السيولة · {currency}
                </p>
                <p className="mt-2 flex flex-wrap items-baseline gap-2">
                  <strong
                    className="numeric text-[38px] leading-none font-black tracking-tight text-ink sm:text-[42px]"
                    dir="ltr"
                  >
                    {formatMinorAmount(totalBalance, {
                      currency,
                      locale: "en-US",
                    })}
                  </strong>
                </p>
                <p className="mt-3 text-xs text-muted">
                  {currencyWallets.length} محفظة نشطة
                  {largest ? (
                    <>
                      {" "}
                      · الأكبر: <span className="font-bold text-ink">{largest.name}</span>
                    </>
                  ) : null}
                </p>

                {currencyWallets.length > 0 && totalBalance > 0n ? (
                  <div
                    className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-surface/55"
                    aria-hidden="true"
                  >
                    {currencyWallets.map((wallet, index) => {
                      const pct = sharePercent(wallet.balanceMinor, totalBalance);
                      if (pct <= 0) return null;
                      return (
                        <span
                          key={wallet.id}
                          className={WALLET_TONES[index % WALLET_TONES.length]}
                          style={{ width: `${pct}%` }}
                          title={`${wallet.name} ${pct}%`}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="mb-5 grid grid-cols-3 gap-2">
            <Link
              to={hasTransferPair ? "/transfer" : "/wallets/new"}
              className="pressable flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-2 text-center shadow-[0_6px_18px_rgb(27_30_60/4%)]"
            >
              <ArrowLeftRight className="text-primary" size={18} />
              <span className="text-[11px] font-bold text-ink">
                {hasTransferPair ? "تحويل" : "فعّل التحويل"}
              </span>
            </Link>
            <Link
              to="/transactions/new"
              className="pressable flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-2 text-center shadow-[0_6px_18px_rgb(27_30_60/4%)]"
            >
              <TrendingUp className="text-success" size={18} />
              <span className="text-[11px] font-bold text-ink">معاملة</span>
            </Link>
            <Link
              to="/wallets/new"
              className="pressable flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-2 text-center shadow-[0_6px_18px_rgb(27_30_60/4%)]"
            >
              <Plus className="text-warning" size={18} />
              <span className="text-[11px] font-bold text-ink">محفظة</span>
            </Link>
          </div>

          <section aria-labelledby="wallet-list-title" className="mb-6">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 id="wallet-list-title" className="text-base font-bold text-ink">
                  توزيع الأرصدة
                </h2>
                <p className="mt-0.5 text-xs text-muted">مرتبة من الأعلى للأقل</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
                <Sparkles size={12} />
                حيّة
              </span>
            </div>

            <ul className="space-y-3">
              {currencyWallets.map((wallet, index) => {
                const pct = sharePercent(wallet.balanceMinor, totalBalance);
                return (
                  <li key={wallet.id}>
                    <Link
                      to={`/wallets/${wallet.id}`}
                      className="pressable group block overflow-hidden rounded-[22px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(27_30_60/4%)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(27_30_60/8%)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={[
                              "grid size-11 shrink-0 place-items-center rounded-2xl text-primary-on",
                              WALLET_TONES[index % WALLET_TONES.length],
                            ].join(" ")}
                          >
                            <WalletCards size={20} strokeWidth={1.8} />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-ink">
                              {wallet.name}
                            </h3>
                            <p className="mt-0.5 text-[11px] text-muted">
                              {pct}% من السيولة · {wallet.currency}
                            </p>
                          </div>
                        </div>
                        <p className="numeric text-left text-base font-black text-ink" dir="ltr">
                          {formatMinorAmount(wallet.balanceMinor, {
                            currency: wallet.currency,
                            locale: "en-US",
                          })}
                        </p>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                        <div
                          className={[
                            "h-full rounded-full transition-[width] duration-500",
                            WALLET_TONES[index % WALLET_TONES.length],
                          ].join(" ")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {otherWallets.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-muted">عملات أخرى</p>
                <ul className="space-y-2">
                  {otherWallets.map((wallet) => (
                    <li key={wallet.id}>
                      <Link
                        to={`/wallets/${wallet.id}`}
                        className="pressable flex items-center justify-between rounded-2xl border border-line bg-surface-subtle/60 px-4 py-3"
                      >
                        <span className="text-sm font-bold text-ink">{wallet.name}</span>
                        <span className="numeric text-sm font-bold text-muted" dir="ltr">
                          {formatMinorAmount(wallet.balanceMinor, {
                            currency: wallet.currency,
                            locale: "en-US",
                          })}{" "}
                          {wallet.currency}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {recent.length > 0 ? (
            <section aria-labelledby="wallet-recent-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="wallet-recent-title" className="text-base font-bold text-ink">
                  آخر الحركات
                </h2>
                <Link
                  to="/transactions"
                  className="text-xs font-bold text-primary hover:underline"
                >
                  الكل
                </Link>
              </div>
              <ul className="overflow-hidden rounded-[20px] border border-line bg-surface divide-y divide-line">
                {recent.map((tx) => (
                  <li key={tx.id}>
                    <Link
                      to={`/transactions/${tx.id}`}
                      className="pressable flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{tx.title}</p>
                        <p className="mt-0.5 text-[11px] text-muted">
                          {tx.kind === "income"
                            ? "دخل"
                            : tx.kind === "expense"
                              ? "مصروف"
                              : "تحويل"}
                        </p>
                      </div>
                      <p
                        className={[
                          "numeric shrink-0 text-sm font-black",
                          tx.kind === "expense" ? "text-danger" : "text-success",
                        ].join(" ")}
                        dir="ltr"
                      >
                        {tx.kind === "expense" ? "-" : "+"}
                        {formatMinorAmount(tx.amountMinor, {
                          currency: tx.currency,
                          locale: "en-US",
                        })}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
