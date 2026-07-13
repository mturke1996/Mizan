import {
  ArrowLeft,
  ArrowLeftRight,
  Plus,
  WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

export function WalletsPage() {
  const { currency } = useWorkspace();
  const { wallets, isLoading, walletsError, refresh } = useFinanceView();
  const currencyWallets = wallets.filter(
    (wallet) => wallet.currency === currency,
  );
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

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="المحافظ"
        subtitle="كل أرصدتك موزعة بوضوح."
        action={
          <Link
            to="/wallets/new"
            aria-label="إضافة محفظة"
            className="pressable flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-subtle"
          >
            <Plus aria-hidden="true" size={18} />
            إضافة
          </Link>
        }
      />

      {isLoading ? (
        <div className="space-y-3" role="status">
          <AppCard className="h-36 animate-pulse bg-surface-subtle" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <AppCard
                key={item}
                className="h-40 animate-pulse bg-surface-subtle"
              />
            ))}
          </div>
          <span className="sr-only">جاري تحميل المحافظ</span>
        </div>
      ) : walletsError ? (
        <ErrorState message={walletsError} onRetry={() => void refresh()} />
      ) : wallets.length === 0 ? (
        <AppCard className="p-7 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-md bg-primary-soft text-primary">
            <WalletCards aria-hidden="true" size={23} />
          </span>
          <h2 className="mt-4 font-bold text-ink">ابدأ بمحفظتك الأولى</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            أضف محفظة نقدية أو مصرفية لتسجيل الرصيد والحركات الفعلية.
          </p>
          <Link
            to="/wallets/new"
            className="pressable mt-5 inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          >
            <Plus aria-hidden="true" size={17} />
            إنشاء محفظة
          </Link>
        </AppCard>
      ) : (
        <>
          <AppCard
            elevated
            className="relative mb-5 overflow-hidden p-5 sm:p-6"
            aria-labelledby="wallet-total-title"
          >
            <div className="pointer-events-none absolute -top-16 -left-12 size-44 rounded-full bg-primary-soft" />
            <div className="relative">
              <p id="wallet-total-title" className="text-sm text-muted">
                إجمالي الأرصدة بالعملة الأساسية
              </p>
              <p className="mt-3 flex items-baseline gap-2">
                <strong className="numeric text-[34px] leading-none font-bold tracking-[-0.04em] text-ink">
                  {formatMinorAmount(totalBalance, {
                    currency,
                    locale: "en-US",
                  })}
                </strong>
                <span className="text-xs font-bold text-muted">{currency}</span>
              </p>
              <p className="mt-4 text-xs text-muted">
                موزّعة على {currencyWallets.length} محافظ نشطة بهذه العملة
              </p>
            </div>
          </AppCard>

          {hasTransferPair ? (
            <Link
              to="/transfer"
              aria-label="تحويل بين المحافظ"
              className="pressable mb-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover"
            >
              <ArrowLeftRight aria-hidden="true" size={19} />
              تحويل بين المحافظ
            </Link>
          ) : (
            <AppCard className="mb-6 flex items-center justify-between gap-3 p-4">
              <p className="text-sm text-muted">
                أضف محفظة ثانية بالعملة نفسها لتفعيل التحويلات الداخلية.
              </p>
              <Link
                to="/wallets/new"
                className="pressable inline-flex min-h-11 shrink-0 items-center rounded-sm px-3 text-sm font-bold text-primary hover:bg-primary-soft"
              >
                إضافة
              </Link>
            </AppCard>
          )}

          <section aria-labelledby="wallet-list-title">
            <h2
              id="wallet-list-title"
              className="mb-3 text-lg font-bold text-ink"
            >
              محافظي
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {wallets.map((wallet) => (
                <Link key={wallet.id} to={`/wallets/${wallet.id}`}>
                  <AppCard className="pressable h-full p-4 hover:border-line-strong hover:bg-surface-subtle">
                    <div className="flex items-start justify-between">
                      <span className="flex size-11 items-center justify-center rounded-sm bg-primary-soft text-primary">
                        <WalletCards
                          aria-hidden="true"
                          size={21}
                          strokeWidth={1.8}
                        />
                      </span>
                      <ArrowLeft
                        aria-hidden="true"
                        size={18}
                        className="text-soft"
                      />
                    </div>
                    <p className="mt-5 text-sm font-bold text-ink">
                      {wallet.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      محفظة • {wallet.currency}
                    </p>
                    <p className="mt-4 flex items-baseline gap-1.5">
                      <strong className="numeric text-xl font-bold text-ink">
                        {formatMinorAmount(wallet.balanceMinor, {
                          currency: wallet.currency,
                          locale: "en-US",
                        })}
                      </strong>
                      <span className="text-[10px] font-bold text-muted">
                        {wallet.currency}
                      </span>
                    </p>
                  </AppCard>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
