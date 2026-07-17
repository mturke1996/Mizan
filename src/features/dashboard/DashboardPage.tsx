import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  Landmark,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeAnalytics } from "@/domain/analytics/compute-analytics";
import { computeEconomicPosition } from "@/domain/analytics/compute-economic-position";
import {
  formatMinorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import { useDebtsView } from "@/features/debts/use-debts-view";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import {
  useUpsertWorkspaceGoalMutation,
  useWorkspaceGoalQuery,
  useInvoicesQuery,
  useDebtWorkspaceSummaryQuery,
  useIncomeSourceBalancesQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { toast } from "sonner";
import { ErrorState } from "@/shared/ui/ErrorState";
import { getUserErrorMessage } from "@/lib/user-error";
import { BalanceOverview } from "./BalanceOverview";
import { BudgetAlertsBanner } from "./BudgetAlertsBanner";
import { EconomicPositionCard } from "./EconomicPositionCard";
import { GoalEditorDialog } from "./GoalEditorDialog";
import { CashFlowChart } from "./CashFlowChart";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { DashboardHeader } from "./DashboardHeader";
import { DebtSummary } from "./DebtSummary";
import { IncomeOutstandingSummary } from "./IncomeOutstandingSummary";
import { FinancialHealthPanel } from "./FinancialHealthPanel";
import { ProjectSpotlight } from "./ProjectSpotlight";
import { QuickActions } from "./QuickActions";
import { RecentTransactions } from "./RecentTransactions";
import { WalletSummary } from "./WalletSummary";

export function DashboardPage() {
  const [now] = useState(() => new Date());
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
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
    let cancelled = false;
    void (async () => {
      try {
        const { refreshOperationalNotificationsRpc } = await import(
          "@/features/workspace/workspace-api"
        );
        if (cancelled) return;
        await refreshOperationalNotificationsRpc(workspaceId);
      } catch {
        // Best-effort operational sync; dashboard should still render.
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
  const monthKey = useMemo(() => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [now]);
  const goalQuery = useWorkspaceGoalQuery(
    workspaceId && !isLoading ? monthKey : undefined,
  );
  const invoicesQuery = useInvoicesQuery();
  const debtSummaryQuery = useDebtWorkspaceSummaryQuery();
  const incomeBalancesQuery = useIncomeSourceBalancesQuery();
  const upsertGoal = useUpsertWorkspaceGoalMutation();
  const goalMinor = goalQuery.data?.incomeGoalMinor ?? null;
  const goalProgress =
    goalMinor && goalMinor > 0n
      ? Math.min(100, Number((overview.incomeMinor * 100n) / goalMinor))
      : 0;

  const economicPosition = useMemo(
    () =>
      computeEconomicPosition({
        cashMinor: totalBalance,
        invoices: invoicesQuery.data ?? [],
        debtSummary: debtSummaryQuery.data ?? null,
        incomeOutstandingMinor: (incomeBalancesQuery.data ?? []).reduce(
          (sum, row) => sum + row.balanceMinor,
          0n,
        ),
        currency,
      }),
    [
      totalBalance,
      invoicesQuery.data,
      debtSummaryQuery.data,
      incomeBalancesQuery.data,
      currency,
    ],
  );

  const saveGoalMinor = (minor: bigint) => {
    void upsertGoal
      .mutateAsync({
        monthKey,
        incomeGoalMinor: toSafeMinorNumber(minor),
      })
      .then(() => toast.success("تم حفظ الهدف الشهري"))
      .catch((saveError) =>
        toast.error(getUserErrorMessage(saveError, "تعذر حفظ الهدف")),
      );
  };

  return (
    <div className="bg-canvas md:bg-transparent">
      <DashboardHeader now={now} />

      <div className="px-4 pt-4 sm:px-6 sm:pt-5 md:px-6 lg:px-8 md:pt-6 lg:pt-7 xl:px-10">
        <QuickActions variant="desktop" />

        {isLoading || financeLoading || projectsLoading || debtsLoading ? (
          <div aria-busy="true" className="space-y-4" role="status">
            <div className="h-52 animate-pulse rounded-[22px] bg-surface-subtle md:hidden" />
            <div className="h-24 animate-pulse rounded-2xl bg-surface-subtle md:hidden" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-28 animate-pulse rounded-[16px] bg-surface-subtle sm:h-36"
                />
              ))}
            </div>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <div className="h-72 animate-pulse rounded-[16px] bg-surface-subtle" />
              <div className="hidden h-72 animate-pulse rounded-[16px] bg-surface-subtle md:block" />
            </div>
            <span className="sr-only">جاري تحميل الملخص المالي</span>
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
            <BalanceOverview
              balanceMinor={totalBalance}
              currency={currency}
              walletCount={activeWallets.length}
              monthlyTrend={overview.monthlyTrend}
              incomeMinor={overview.incomeMinor}
              expenseMinor={overview.expenseMinor}
              netMinor={overview.netMinor}
            />

            <EconomicPositionCard
              position={economicPosition}
              currency={currency}
            />

            <BudgetAlertsBanner />

            <GoalEditorDialog
              open={goalDialogOpen}
              currency={currency}
              currentGoalMinor={goalMinor}
              onOpenChange={setGoalDialogOpen}
              onSave={saveGoalMinor}
            />

            <QuickActions variant="mobile" />

            {workspaceId ? (
              <section className="mb-4 overflow-hidden rounded-[18px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(27_30_60/4%)] sm:mb-5 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                      <span className="grid size-8 place-items-center rounded-xl bg-primary-soft text-primary">
                        <Target aria-hidden="true" size={15} />
                      </span>
                      هدف دخل الشهر
                    </h2>
                    <p className="mt-2 text-[11px] leading-5 text-muted">
                      {goalMinor
                        ? `التقدّم نحو ${formatMinorAmount(goalMinor, {
                            currency,
                            locale: "en-US",
                          })} ${currency}`
                        : "حدّد هدفًا شهريًا لمتابعة التقدّم من لوحة التحكم."}
                    </p>
                  </div>
                  <button
                    className="pressable min-h-10 shrink-0 rounded-xl border border-line bg-canvas px-3 text-xs font-bold text-ink disabled:opacity-60"
                    disabled={upsertGoal.isPending}
                    onClick={() => setGoalDialogOpen(true)}
                    type="button"
                  >
                    {goalMinor ? "تعديل" : "تعيين"}
                  </button>
                </div>
                {goalMinor ? (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
                      <span>
                        الدخل الحالي{" "}
                        <bdi className="numeric font-semibold text-ink" dir="ltr">
                          {formatMinorAmount(overview.incomeMinor, {
                            currency,
                            locale: "en-US",
                          })}
                        </bdi>
                      </span>
                      <span className="numeric font-bold text-primary" dir="ltr">
                        {goalProgress}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
                        style={{ width: `${goalProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            <section
              aria-label="المؤشرات المالية الأساسية"
              className="mb-4 hidden grid-cols-2 gap-3 md:mb-5 md:grid md:grid-cols-4"
            >
              <DashboardMetricCard
                label="إجمالي الرصيد"
                value={formatMinorAmount(totalBalance, {
                  currency,
                  locale: "en-US",
                })}
                suffix={currency}
                helper={`${activeWallets.length} محافظ بالعملة الأساسية`}
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
                helper={`معدل الادخار ${overview.savingsRate.toFixed(1)}%`}
                icon={HandCoins}
                tone={overview.netMinor >= 0n ? "success" : "warning"}
              />
            </section>

            <section className="mb-5 grid gap-4 md:mb-6 md:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)] md:gap-5">
              <CashFlowChart
                data={overview.monthlyTrend}
                currency={currency}
              />
              <FinancialHealthPanel analytics={overview} />
            </section>

            <section className="grid items-start gap-4 pb-2 md:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)] md:gap-5">
              <RecentTransactions
                transactions={transactions}
                wallets={wallets}
              />
              <aside className="space-y-4 md:space-y-0">
                <IncomeOutstandingSummary currency={currency} />
                <DebtSummary
                  currency={currency}
                  debts={debts}
                  now={now}
                  timeZone={profile?.timezone ?? "Africa/Tripoli"}
                />
                <ProjectSpotlight projects={projects} currency={currency} />
                <WalletSummary wallets={wallets} />
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
