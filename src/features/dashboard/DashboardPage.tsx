import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Landmark,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeAnalytics } from "@/domain/analytics/compute-analytics";
import { computeEconomicPosition } from "@/domain/analytics/compute-economic-position";
import { computeDebtAnalytics } from "@/domain/debts/compute-debt-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import { useDebtsView } from "@/features/debts/use-debts-view";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import {
  useIncomeSourceBalancesQuery,
  useInvoicesQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { ErrorState } from "@/shared/ui/ErrorState";
import { BalanceOverview } from "./BalanceOverview";
import { BudgetAlertsBanner } from "./BudgetAlertsBanner";
import { CashFlowChart } from "./CashFlowChart";
import { CashFlowPredictor } from "./CashFlowPredictor";
import { DashboardExecutiveHero } from "./DashboardExecutiveHero";
import { DashboardGettingStarted } from "./DashboardGettingStarted";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { DebtRecoveryTimeline } from "./DebtRecoveryTimeline";
import { DebtSummary } from "./DebtSummary";
import { EconomicPositionCard } from "./EconomicPositionCard";
import { FinancialHealthPanel } from "./FinancialHealthPanel";
import { IncomeOutstandingSummary } from "./IncomeOutstandingSummary";
import { ProjectProfitabilityMatrix } from "./ProjectProfitabilityMatrix";
import { ProjectSpotlight } from "./ProjectSpotlight";
import { QuickActions } from "./QuickActions";
import { QuickCommandBar } from "./QuickCommandBar";
import { RecentTransactions } from "./RecentTransactions";
import { WalletSummary } from "./WalletSummary";

function DashboardBentoSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <div className="hidden h-44 animate-pulse rounded-[24px] bg-surface-subtle md:block" />
      <div className="h-36 animate-pulse rounded-[22px] bg-surface-subtle md:hidden" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl bg-surface-subtle sm:h-32"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-[20px] bg-surface-subtle" />
        <div className="h-56 animate-pulse rounded-[20px] bg-surface-subtle" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="h-64 animate-pulse rounded-[18px] bg-surface-subtle" />
        <div className="h-64 animate-pulse rounded-[18px] bg-surface-subtle" />
      </div>
      <span className="sr-only">جاري تحميل لوحة التحكم…</span>
    </div>
  );
}

export function DashboardPage() {
  const [now] = useState(() => new Date());
  const { profile } = useAuth();
  const { currency, isLoading, error, workspaceId, refresh } = useWorkspace();
  const timeZone = profile?.timezone ?? "Africa/Tripoli";
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
  const invoicesQuery = useInvoicesQuery();
  const incomeBalancesQuery = useIncomeSourceBalancesQuery();

  useEffect(() => {
    if (!workspaceId) return;
    const gateKey = `mizan.opsNotifyRefresh.${workspaceId}`;
    const lastRaw =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(gateKey)
        : null;
    const lastAt = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(lastAt) && Date.now() - lastAt < 30 * 60 * 1000) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { getNotificationSettings } = await import(
          "@/lib/notification-settings"
        );
        if (!getNotificationSettings().operationalAlertsEnabled) return;
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
  const isPageLoading =
    isLoading || financeLoading || projectsLoading || debtsLoading;

  const activeWallets = useMemo(
    () => wallets.filter((wallet) => wallet.currency === currency),
    [wallets, currency],
  );
  const totalBalance = useMemo(
    () => activeWallets.reduce((total, wallet) => total + wallet.balanceMinor, 0n),
    [activeWallets],
  );

  const overview = useMemo(
    () =>
      computeAnalytics({
        transactions,
        projects,
        totalBalanceMinor: totalBalance,
        months: 6,
        now,
        currency,
        timeZone,
      }),
    [transactions, projects, totalBalance, now, currency, timeZone],
  );

  const economicPosition = useMemo(() => {
    const debtAnalytics = computeDebtAnalytics({
      debts: debts.filter((debt) => debt.currencyCode === currency),
      now,
      timeZone,
    });
    const incomeOutstandingMinor = (incomeBalancesQuery.data ?? []).reduce(
      (sum, row) => sum + row.balanceMinor,
      0n,
    );
    return computeEconomicPosition({
      cashMinor: totalBalance,
      invoices: invoicesQuery.data ?? [],
      debtSummary: {
        receivableMinor: debtAnalytics.receivableMinor,
        payableMinor: debtAnalytics.payableMinor,
      },
      incomeOutstandingMinor,
      currency,
    });
  }, [
    currency,
    debts,
    incomeBalancesQuery.data,
    invoicesQuery.data,
    now,
    timeZone,
    totalBalance,
  ]);

  const hasWallets = activeWallets.length > 0;
  const hasTransactions = transactions.length > 0;
  const hasDebts = debts.length > 0;
  const showGettingStarted = !hasWallets || !hasTransactions;
  const showInsights = hasWallets || hasTransactions;
  const workerProjectId = useMemo(
    () =>
      projects.find(
        (project) =>
          project.status === "active" && project.modules.workers === true,
      )?.id ?? null,
    [projects],
  );

  const chartData = overview.monthlyTrend;

  return (
    <div className="page-enter min-h-dvh bg-canvas">
      <DashboardHeader now={now} />

      <div className="mx-auto max-w-7xl space-y-5 px-4 pt-4 pb-8 sm:px-6 md:space-y-6 md:px-8 xl:px-10">
        <QuickActions workerProjectId={workerProjectId} />
        <QuickActions variant="desktop" workerProjectId={workerProjectId} />

        {isPageLoading ? (
          <DashboardBentoSkeleton />
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

            <BudgetAlertsBanner />

            {/* Row 1 — Hero balance + runway predictor */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-stretch">
              <div className="space-y-5">
                <BalanceOverview
                  balanceMinor={totalBalance}
                  currency={currency}
                  walletCount={activeWallets.length}
                  monthlyTrend={chartData}
                  incomeMinor={overview.incomeMinor}
                  expenseMinor={overview.expenseMinor}
                  netMinor={overview.netMinor}
                />
                <DashboardExecutiveHero
                  balanceMinor={totalBalance}
                  currency={currency}
                  walletCount={activeWallets.length}
                  monthlyTrend={chartData}
                  incomeMinor={overview.incomeMinor}
                  expenseMinor={overview.expenseMinor}
                  netMinor={overview.netMinor}
                  savingsRate={overview.savingsRate}
                />
              </div>
              {hasTransactions ? (
                <CashFlowPredictor
                  totalBalanceMinor={totalBalance}
                  incomeMinor={overview.incomeMinor}
                  expenseMinor={overview.expenseMinor}
                  currency={currency}
                />
              ) : null}
            </div>

            {/* Row 2 — KPI stream */}
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

            {showInsights ? (
              <>
                {/* Row 3 — Unified position + health pulse */}
                <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                  <EconomicPositionCard
                    position={economicPosition}
                    currency={currency}
                  />
                  <FinancialHealthPanel analytics={overview} />
                </div>

                {/* Row 4 — Chart + command search */}
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:gap-6">
                  <CashFlowChart data={chartData} currency={currency} />
                  <QuickCommandBar showShortcuts={false} />
                </div>

                {/* Row 5 — Operations snapshot */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <DebtSummary
                    currency={currency}
                    debts={debts}
                    now={now}
                    timeZone={timeZone}
                  />
                  <IncomeOutstandingSummary currency={currency} />
                  <ProjectSpotlight projects={projects} currency={currency} />
                  <WalletSummary wallets={activeWallets} />
                </div>

                {/* Row 6 — Activity + receivables */}
                <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
                  <RecentTransactions
                    transactions={transactions}
                    wallets={wallets}
                  />
                  {debts.length > 0 ? (
                    <DebtRecoveryTimeline debts={debts} currency={currency} />
                  ) : (
                    <ProjectProfitabilityMatrix
                      projects={projects}
                      currency={currency}
                    />
                  )}
                </div>

                {/* Row 7 — Project matrix when debts also shown above */}
                {debts.length > 0 && projects.length > 0 ? (
                  <ProjectProfitabilityMatrix
                    projects={projects}
                    currency={currency}
                  />
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
