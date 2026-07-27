import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Landmark,
  Plus,
  FileText,
  Scale,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { computeAnalytics } from "@/domain/analytics/compute-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import { useDebtsView } from "@/features/debts/use-debts-view";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { ErrorState } from "@/shared/ui/ErrorState";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardGettingStarted } from "./DashboardGettingStarted";
import { RecentTransactions } from "./RecentTransactions";
import { DebtRecoveryTimeline } from "./DebtRecoveryTimeline";
import { ProjectProfitabilityMatrix } from "./ProjectProfitabilityMatrix";

export function DashboardPage() {
  const [now] = useState(() => new Date());
  const { profile } = useAuth();
  const { currency, isLoading, error, workspaceId, refresh } = useWorkspace();
  const {
    wallets,
    transactions,
    isLoading: financeLoading,
    error: financeError,
    refresh: refreshFinance,
  } = useFinanceView();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjectsView();
  const {
    debts,
    isLoading: debtsLoading,
    error: debtsError,
    refresh: refreshDebts,
  } = useDebtsView();

  useEffect(() => {
    if (!workspaceId) return;
    const gateKey = `mizan.opsNotifyRefresh.${workspaceId}`;
    const lastRaw =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(gateKey)
        : null;
    const lastAt = lastRaw ? Number(lastRaw) : 0;
    // At most once per 30 minutes per workspace in this session
    if (Number.isFinite(lastAt) && Date.now() - lastAt < 30 * 60 * 1000) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { refreshOperationalNotificationsRpc } = await import(
          "@/features/workspace/workspace-api"
        );
        if (cancelled) return;
        await refreshOperationalNotificationsRpc(workspaceId);
        try {
          sessionStorage.setItem(gateKey, String(Date.now()));
        } catch {
          // ignore quota / private mode
        }
      } catch {
        // Best-effort operational sync
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const dashboardError =
    (!workspaceId ? error : null) ?? financeError ?? projectsError ?? debtsError;
  const activeWallets = wallets.filter((wallet) => wallet.currency === currency);
  const totalBalance = activeWallets.reduce(
    (total, wallet) => total + wallet.balanceMinor,
    0n,
  );
  const overview = computeAnalytics({
    transactions,
    projects,
    totalBalanceMinor: totalBalance,
    months: 6,
    now,
    currency,
    timeZone: profile?.timezone ?? "Africa/Tripoli",
  });

  const hasWallets = activeWallets.length > 0;
  const hasTransactions = transactions.length > 0;
  const hasDebts = debts.length > 0;
  const showGettingStarted = !hasWallets || !hasTransactions;
  const showAdvancedPanels =
    hasTransactions && (debts.length > 0 || projects.length > 0);

  return (
    <div className="page-enter min-h-dvh bg-canvas">
      <DashboardHeader now={now} />

      <div className="mx-auto max-w-7xl space-y-5 px-4 pt-4 pb-8 sm:px-6 md:space-y-6 md:px-8 xl:px-10">
        <div className="rounded-[20px] border border-line bg-surface p-3.5 shadow-[0_8px_24px_rgb(27_30_60/4%)] sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-ink">
                ملخص أموالك
              </h2>
              <p className="mt-0.5 text-[11px] leading-5 text-muted sm:text-xs">
                رصيدك ودخلك ومصروفك باختصار
              </p>
            </div>
            <Link
              to="/transactions/new?type=expense"
              className="pressable flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-on sm:min-h-11 sm:px-4"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>مصروف</span>
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Link
              to="/transactions/new?type=income"
              className="pressable flex min-h-10 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-2 text-[11px] font-bold text-ink sm:min-h-11 sm:flex-row sm:gap-1.5 sm:text-xs"
            >
              <ArrowDownLeft size={15} className="text-success" />
              <span>دخل</span>
            </Link>
            <Link
              to="/debts/new"
              className="pressable flex min-h-10 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-2 text-[11px] font-bold text-ink sm:min-h-11 sm:flex-row sm:gap-1.5 sm:text-xs"
            >
              <Scale size={15} className="text-warning" />
              <span>مستحق</span>
            </Link>
            <Link
              to="/invoices/new"
              className="pressable flex min-h-10 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-canvas px-2 text-[11px] font-bold text-ink sm:min-h-11 sm:flex-row sm:gap-1.5 sm:text-xs"
            >
              <FileText size={15} className="text-primary" />
              <span>فاتورة</span>
            </Link>
          </div>
        </div>

        {isLoading || financeLoading || projectsLoading || debtsLoading ? (
          <div aria-busy="true" className="space-y-4" role="status">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-2xl bg-surface-subtle sm:h-36"
                />
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-2xl bg-surface-subtle" />
            <span className="sr-only">جاري تحميل البيانات المالية...</span>
          </div>
        ) : dashboardError ? (
          <ErrorState
            message={dashboardError}
            onRetry={() => {
              if (!workspaceId) {
                void refresh();
                return;
              }
              void Promise.all([
                refreshFinance(),
                refreshProjects(),
                refreshDebts(),
              ]);
            }}
          />
        ) : (
          <>
            {showGettingStarted ? (
              <DashboardGettingStarted
                hasWallets={hasWallets}
                hasTransactions={hasTransactions}
                hasDebts={hasDebts}
              />
            ) : null}

            <section
              aria-label="المؤشرات المالية الأساسية"
              className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4 md:gap-3.5"
            >
              <DashboardMetricCard
                label="رصيدك الآن"
                value={formatMinorAmount(totalBalance, {
                  currency,
                  locale: "en-US",
                })}
                suffix={currency}
                helper={
                  activeWallets.length === 0
                    ? "أضف محفظة للبدء"
                    : `${activeWallets.length} محافظ`
                }
                icon={Landmark}
                tone="primary"
              />
              <DashboardMetricCard
                label="دخل هذا الشهر"
                value={formatMinorAmount(overview.incomeMinor, {
                  currency,
                  locale: "en-US",
                })}
                suffix={currency}
                trend={overview.incomeTrendRate}
                icon={ArrowDownLeft}
                tone="success"
              />
              <DashboardMetricCard
                label="مصروف هذا الشهر"
                value={formatMinorAmount(overview.expenseMinor, {
                  currency,
                  locale: "en-US",
                })}
                suffix={currency}
                trend={overview.expenseTrendRate}
                icon={ArrowUpRight}
                tone="danger"
                invertTrend
              />
              <DashboardMetricCard
                label="صافي الشهر"
                value={formatMinorAmount(overview.netMinor, {
                  currency,
                  locale: "en-US",
                })}
                suffix={currency}
                helper={`ادخار ${overview.savingsRate.toFixed(1)}%`}
                icon={HandCoins}
                tone={overview.netMinor >= 0n ? "success" : "warning"}
              />
            </section>

            <section className="pt-1" aria-label="أحدث الحركات">
              <RecentTransactions
                transactions={transactions}
                wallets={wallets}
              />
            </section>

            {showAdvancedPanels ? (
              <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                {debts.length > 0 ? (
                  <DebtRecoveryTimeline debts={debts} currency={currency} />
                ) : null}
                {projects.length > 0 ? (
                  <ProjectProfitabilityMatrix
                    projects={projects}
                    currency={currency}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
