import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleGauge,
  HandCoins,
  Landmark,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { computeAnalytics } from "@/domain/analytics/compute-analytics";
import { formatMinorAmount, getCurrencyScale, parseMajorAmount, toSafeMinorNumber } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import { useDebtsView } from "@/features/debts/use-debts-view";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import {
  useUpsertWorkspaceGoalMutation,
  useWorkspaceGoalQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { toast } from "sonner";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { getUserErrorMessage } from "@/lib/user-error";
import { BalanceOverview } from "./BalanceOverview";
import { CashFlowChart } from "./CashFlowChart";
import { DashboardMetricCard } from "./DashboardMetricCard";
import { DashboardHeader } from "./DashboardHeader";
import { DebtSummary } from "./DebtSummary";
import { FinancialHealthPanel } from "./FinancialHealthPanel";
import { ProjectSpotlight } from "./ProjectSpotlight";
import { QuickActions } from "./QuickActions";
import { RecentTransactions } from "./RecentTransactions";
import { WalletSummary } from "./WalletSummary";

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
  const totalBalance = wallets
    .filter((wallet) => wallet.currency === currency)
    .reduce((total, wallet) => total + wallet.balanceMinor, 0n);
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
  const upsertGoal = useUpsertWorkspaceGoalMutation();
  const goalMinor = goalQuery.data?.incomeGoalMinor ?? null;
  const goalProgress =
    goalMinor && goalMinor > 0n
      ? Math.min(
          100,
          Number((overview.incomeMinor * 100n) / goalMinor),
        )
      : 0;

  return (
    <div>
      <DashboardHeader now={now} />

      <div className="px-4 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-7 xl:px-10">
        <QuickActions variant="desktop" />

        {isLoading || financeLoading || projectsLoading || debtsLoading ? (
          <div aria-busy="true" className="space-y-5" role="status">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-36 animate-pulse rounded-[14px] bg-surface-subtle"
                />
              ))}
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <div className="h-96 animate-pulse rounded-[14px] bg-surface-subtle" />
              <div className="h-96 animate-pulse rounded-[14px] bg-surface-subtle" />
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
              walletCount={
                wallets.filter((wallet) => wallet.currency === currency).length
              }
              monthlyTrend={overview.monthlyTrend}
            />

            {workspaceId ? (
              <AppCard className="mb-5 space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
                      <Target aria-hidden="true" size={16} />
                      هدف دخل الشهر
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {goalMinor
                        ? `التقدّم نحو ${formatMinorAmount(goalMinor, {
                            currency,
                            locale: "en-US",
                          })} ${currency}`
                        : "حدّد هدفًا شهريًا لمتابعة التقدّم من لوحة التحكم."}
                    </p>
                  </div>
                  <button
                    className="pressable min-h-10 shrink-0 rounded-sm border border-line px-3 text-xs font-bold text-ink disabled:opacity-60"
                    disabled={upsertGoal.isPending}
                    onClick={() => {
                      const raw = window.prompt(
                        "أدخل هدف الدخل الشهري (بالوحدة الرئيسية)",
                        goalMinor
                          ? formatMinorAmount(goalMinor, {
                              currency,
                              locale: "en-US",
                            })
                          : "",
                      );
                      if (!raw) return;
                      try {
                        const minor = parseMajorAmount(
                          raw,
                          getCurrencyScale(currency),
                        );
                        void upsertGoal
                          .mutateAsync({
                            monthKey,
                            incomeGoalMinor: toSafeMinorNumber(minor),
                          })
                          .then(() => toast.success("تم حفظ الهدف الشهري"))
                          .catch((error) =>
                            toast.error(
                              getUserErrorMessage(error, "تعذر حفظ الهدف"),
                            ),
                          );
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "أدخل مبلغًا صحيحًا",
                        );
                      }
                    }}
                    type="button"
                  >
                    {goalMinor ? "تعديل" : "تعيين هدف"}
                  </button>
                </div>
                {goalMinor ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-xs text-muted">
                      <span>
                        الدخل الحالي{" "}
                        <bdi className="numeric" dir="ltr">
                          {formatMinorAmount(overview.incomeMinor, {
                            currency,
                            locale: "en-US",
                          })}
                        </bdi>
                      </span>
                      <span className="numeric" dir="ltr">
                        {goalProgress}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500"
                        style={{ width: `${goalProgress}%` }}
                      />
                    </div>
                  </div>
                ) : null}
              </AppCard>
            ) : null}

            <section
              aria-label="المؤشرات المالية الأساسية"
              className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4"
            >
              <div className="hidden lg:block">
                <DashboardMetricCard
                  label="إجمالي الرصيد"
                  value={formatMinorAmount(totalBalance, {
                    currency,
                    locale: "en-US",
                  })}
                  suffix={currency}
                  helper={`${wallets.filter((wallet) => wallet.currency === currency).length} محافظ بالعملة الأساسية`}
                  icon={Landmark}
                  tone="primary"
                />
              </div>
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
              <div className="lg:hidden">
                <DashboardMetricCard
                  label="الصحة المالية"
                  value={overview.healthScore ?? "—"}
                  suffix="/ 100"
                  helper={overview.healthLabel}
                  icon={CircleGauge}
                  tone={
                    overview.healthScore == null
                      ? "primary"
                      : overview.healthScore >= 65
                        ? "success"
                        : "warning"
                  }
                />
              </div>
            </section>

            <section className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <CashFlowChart
                data={overview.monthlyTrend}
                currency={currency}
              />
              <FinancialHealthPanel analytics={overview} />
            </section>

            <section className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
              <RecentTransactions
                transactions={transactions}
                wallets={wallets}
              />
              <aside>
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
            <QuickActions variant="mobile" />
          </>
        )}
      </div>
    </div>
  );
}
