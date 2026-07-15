import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  CircleGauge,
  Flame,
  Lightbulb,
  HandCoins,
  Scale,
  Timer,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { computeAnalytics } from "@/domain/analytics/compute-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import { BudgetsCard } from "@/features/analytics/BudgetsCard";
import { groupProjectsByParent } from "@/features/projects/parent-project-tree";
import {
  useAllTransactionsQuery,
  useCategoriesQuery,
  useUnlockWorkspaceAchievementMutation,
  useWorkspaceAchievementUnlocksQuery,
} from "@/features/workspace/use-finance-data";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

function formatRate(rate: number | null): string {
  if (rate == null) return "غير متاح";
  const prefix = rate > 0 ? "+" : "";
  return `${prefix}${rate.toFixed(1)}%`;
}

function MetricTile({
  icon,
  label,
  value,
  helper,
  tone = "primary",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const toneClass = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
  }[tone];

  return (
    <AppCard className="p-4 sm:p-5">
      <span
        className={`mb-5 flex size-10 items-center justify-center rounded-sm ${toneClass}`}
      >
        {icon}
      </span>
      <p className="text-xs font-medium text-muted">{label}</p>
      <strong className="numeric mt-1.5 block text-xl font-bold text-ink">
        {value}
      </strong>
      <p className="mt-2 text-[11px] leading-5 text-muted">{helper}</p>
    </AppCard>
  );
}

export function AnalyticsPage() {
  const [months, setMonths] = useState(6);
  const { profile } = useAuth();
  const { currency, isDemo = false } = useWorkspace();
  const {
    wallets,
    isLoading: financeLoading,
    error: financeError,
    refresh: refreshFinance,
  } = useFinanceView();
  const allTransactions = useAllTransactionsQuery();
  const {
    projects,
    isLoading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjectsView();
  const categoriesQuery = useCategoriesQuery();
  const unlocksQuery = useWorkspaceAchievementUnlocksQuery();
  const unlockMutation = useUnlockWorkspaceAchievementMutation();
  const unlockMap = new Map(
    (unlocksQuery.data ?? []).map((item) => [
      item.achievementId,
      item.unlockedAt,
    ]),
  );

  const totalBalance = wallets.reduce(
    (total, wallet) =>
      wallet.currency === currency ? total + wallet.balanceMinor : total,
    0n,
  );

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categoriesQuery.data]);

  const analytics = useMemo(
    () =>
      computeAnalytics({
        transactions: allTransactions.transactions,
        projects,
        totalBalanceMinor: totalBalance,
        categoryNames,
        months,
        currency,
        timeZone: profile?.timezone ?? "Africa/Tripoli",
      }),
    [
      allTransactions.transactions,
      projects,
      totalBalance,
      categoryNames,
      months,
      currency,
      profile?.timezone,
    ],
  );

  useEffect(() => {
    if (isDemo) return;
    for (const achievement of analytics.achievements) {
      if (unlockMap.has(achievement.id)) continue;
      void unlockMutation.mutateAsync(achievement.id).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics.achievements, isDemo, unlocksQuery.dataUpdatedAt]);

  const unlockDateFormatter = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    dateStyle: "medium",
  });

  const confidenceLabel = {
    low: "أولية",
    medium: "جيدة",
    high: "مرتفعة",
  }[analytics.confidence];
  const analyticsLoading =
    financeLoading ||
    projectsLoading ||
    categoriesQuery.isLoading ||
    allTransactions.isLoading;
  const categoriesError = categoriesQuery.isError
    ? categoriesQuery.error instanceof Error
      ? categoriesQuery.error.message
      : "تعذر تحميل التصنيفات"
    : null;
  const allTransactionsError = allTransactions.error
    ? allTransactions.error.message
    : null;
  const analyticsError =
    financeError ?? projectsError ?? categoriesError ?? allTransactionsError;
  const periodSelector = (
    <select
      aria-label="الفترة الزمنية"
      value={String(months)}
      onChange={(event) => setMonths(Number(event.target.value))}
      className="min-h-11 rounded-sm border border-line-strong bg-surface px-3 text-sm font-semibold text-ink"
    >
      <option value="3">آخر 3 أشهر</option>
      <option value="6">آخر 6 أشهر</option>
      <option value="12">آخر سنة</option>
    </select>
  );

  if (analyticsLoading) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="التحليلات"
          subtitle="صحة مالية، توقعات، مخاطر، وأداء مشاريع من بياناتك الفعلية."
          action={periodSelector}
        />
        <div
          className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"
          role="status"
        >
          {[0, 1, 2, 3].map((item) => (
            <AppCard
              key={item}
              className="h-40 animate-pulse bg-surface-subtle"
            />
          ))}
          <span className="sr-only">جاري تحليل البيانات</span>
        </div>
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="التحليلات"
          subtitle="صحة مالية، توقعات، مخاطر، وأداء مشاريع من بياناتك الفعلية."
          action={periodSelector}
        />
        <ErrorState
          message={analyticsError}
          onRetry={() =>
            void Promise.all([
              refreshFinance(),
              refreshProjects(),
              categoriesQuery.refetch(),
              allTransactions.refetch(),
            ])
          }
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="التحليلات"
        subtitle="صحة مالية، توقعات، مخاطر، وأداء مشاريع من بياناتك الفعلية."
        action={periodSelector}
      />

      <section
        aria-label="مؤشرات الصحة المالية"
        className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <MetricTile
          icon={<CircleGauge className="size-5" aria-hidden="true" />}
          label="مؤشر الصحة المالية"
          value={
            analytics.healthScore == null
              ? "غير متاح"
              : `${analytics.healthScore}/100`
          }
          helper={`${analytics.healthLabel}، ثقة ${confidenceLabel} من ${analytics.dataPoints} حركة`}
          tone={
            analytics.healthScore == null
              ? "info"
              : analytics.healthScore >= 65
                ? "success"
                : analytics.healthScore >= 45
                  ? "warning"
                  : "danger"
          }
        />
        <MetricTile
          icon={<HandCoins className="size-5" aria-hidden="true" />}
          label="معدل الادخار"
          value={`${analytics.savingsRate.toFixed(1)}%`}
          helper={
            analytics.expenseRatio == null
              ? "يحتاج إلى دخل مسجّل لحساب النسبة"
              : `المصروف يساوي ${analytics.expenseRatio.toFixed(1)}% من الدخل`
          }
          tone={analytics.savingsRate >= 20 ? "success" : "warning"}
        />
        <MetricTile
          icon={<Timer className="size-5" aria-hidden="true" />}
          label="أيام السيولة"
          value={
            analytics.runwayDays == null
              ? "لا استهلاك"
              : `${analytics.runwayDays} يوم`
          }
          helper="الرصيد الحالي مقسومًا على متوسط الإنفاق اليومي"
          tone={
            analytics.runwayDays == null || analytics.runwayDays >= 60
              ? "info"
              : analytics.runwayDays >= 30
                ? "warning"
                : "danger"
          }
        />
        <MetricTile
          icon={<Scale className="size-5" aria-hidden="true" />}
          label="صافي نهاية الشهر المتوقع"
          value={formatMinorAmount(analytics.projectedNetMinor, {
            currency,
            locale: "en-US",
            fractionDigits: 0,
          })}
          helper="تقدير خطي حسب وتيرة الشهر الحالية"
          tone={analytics.projectedNetMinor >= 0n ? "primary" : "danger"}
        />
      </section>

      <BudgetsCard />

      <AppCard className="mb-5 overflow-hidden p-0">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-ink">سرعة الحركة والمخاطر</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                التوقعات تقارن وتيرة الشهر الحالي بالشهر السابق.
              </p>
            </div>
            <span className="rounded-xs bg-surface-subtle px-3 py-1.5 text-[11px] font-bold text-muted">
              ثقة {confidenceLabel}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          <div className="border-b border-line p-4 sm:border-l xl:p-5">
            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
              <ArrowDownLeft
                className="size-4 text-success"
                aria-hidden="true"
              />
              دخل الشهر المتوقع
            </span>
            <p className="numeric text-lg font-bold text-ink">
              {formatMinorAmount(analytics.projectedIncomeMinor, {
              currency,
              locale: "en-US",
              fractionDigits: 0,
            })}
            </p>
            <p className="numeric mt-1 text-xs font-bold text-success">
              {formatRate(analytics.incomeTrendRate)} عن الشهر السابق
            </p>
          </div>

          <div className="border-b border-line p-4 xl:border-l xl:p-5">
            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
              <ArrowUpRight
                className="size-4 text-danger"
                aria-hidden="true"
              />
              مصروف الشهر المتوقع
            </span>
            <p className="numeric text-lg font-bold text-ink">
              {formatMinorAmount(analytics.projectedExpenseMinor, {
                currency,
                locale: "en-US",
                fractionDigits: 0,
              })}
            </p>
            <p
              className={`numeric mt-1 text-xs font-bold ${
                (analytics.expenseTrendRate ?? 0) > 0
                  ? "text-danger"
                  : "text-success"
              }`}
            >
              {formatRate(analytics.expenseTrendRate)} عن الشهر السابق
            </p>
          </div>

          <div className="border-b border-line p-4 sm:border-l xl:p-5">
            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
              <Flame className="size-4 text-warning" aria-hidden="true" />
              الحرق اليومي
            </span>
            <p className="numeric text-lg font-bold text-ink">
              {analytics.burnRateDaily.toFixed(2)}
              <span className="mr-1 text-[10px] text-muted">
                {currency}/يوم
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">متوسط الشهر حتى اليوم</p>
          </div>

          <div className="border-b border-line p-4 xl:border-b-0 xl:border-l xl:p-5">
            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
              <Activity className="size-4 text-info" aria-hidden="true" />
              تذبذب الإنفاق
            </span>
            <p className="numeric text-lg font-bold text-ink">
              {analytics.expenseVolatility == null
                ? "غير متاح"
                : `${analytics.expenseVolatility.toFixed(0)}%`}
            </p>
            <p className="mt-1 text-xs text-muted">
              الأقل يعني قدرة أعلى على التوقع
            </p>
          </div>

          <div className="border-b border-line p-4 sm:border-b-0 sm:border-l xl:p-5">
            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
              <UsersRound className="size-4 text-primary" aria-hidden="true" />
              تغطية أرصدة العمال
            </span>
            <p className="numeric text-lg font-bold text-ink">
              {analytics.laborCoverageRate == null
                ? "لا التزامات"
                : `${analytics.laborCoverageRate.toFixed(0)}%`}
            </p>
            <p className="numeric mt-1 text-xs text-muted">
              مستحقات:{" "}
              {formatMinorAmount(analytics.laborLiabilityMinor, {
                currency,
                locale: "en-US",
              })}
            </p>
          </div>

          <div className="p-4 xl:p-5">
            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-muted">
              <BadgeCheck className="size-4 text-success" aria-hidden="true" />
              المشاريع الرابحة
            </span>
            <p className="numeric text-lg font-bold text-ink">
              {analytics.profitableProjectsRate == null
                ? "لا بيانات"
                : `${analytics.profitableProjectsRate.toFixed(0)}%`}
            </p>
            <p className="mt-1 text-xs text-muted">
              بعد خصم أرصدة العمال غير المسددة
            </p>
          </div>
        </div>
      </AppCard>

      <details className="mb-5 rounded-md border border-line bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer font-bold text-ink">
          كيف حُسب مؤشر الصحة المالية؟
        </summary>
        <p className="mt-3 max-w-3xl text-xs leading-6 text-muted">
          المؤشر تقديري وليس درجة ائتمانية. يتكوّن من معدل الادخار 40%، وأيام
          السيولة 35%، وتنوّع المصروفات 15%، وربحية المشاريع بعد أرصدة العمال
          10%. لا يظهر المؤشر قبل وجود 3 حركات على الأقل مع دخل ومصروف، ويرتفع
          مستوى الثقة كلما زاد عدد الحركات والأشهر النشطة.
        </p>
      </details>

      {analytics.achievements.length > 0 ? (
        <AppCard className="mb-5 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line p-4 sm:p-5">
            <span className="flex size-10 items-center justify-center rounded-sm bg-success-soft text-success">
              <Trophy aria-hidden="true" size={19} />
            </span>
            <div>
              <h2 className="font-bold text-ink">تقدّم مثبت بالبيانات</h2>
              <p className="mt-1 text-xs text-muted">
                إنجازات لا تظهر إلا بعد تحقق شروطها من حركاتك الفعلية.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {analytics.achievements.map((achievement) => {
              const unlockedAt = unlockMap.get(achievement.id);
              return (
                <li
                  key={achievement.id}
                  className="flex items-start gap-3 px-4 py-3.5 sm:px-5"
                >
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-success"
                  />
                  <div>
                    <p className="text-sm font-bold text-ink">
                      {achievement.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {achievement.detail}
                    </p>
                    {unlockedAt ? (
                      <p className="mt-1 text-[11px] text-muted">
                        فُتح في{" "}
                        <time dateTime={unlockedAt}>
                          {unlockDateFormatter.format(new Date(unlockedAt))}
                        </time>
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </AppCard>
      ) : null}

      {analytics.insights.length > 0 ? (
        <AppCard className="mb-5 space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Lightbulb aria-hidden="true" size={18} className="text-primary" />
            <h2 className="font-bold text-ink">رؤى ذكية</h2>
          </div>
          <ul className="space-y-2">
            {analytics.insights.map((insight) => (
              <li
                key={insight}
                className="rounded-md bg-surface-subtle px-3 py-2.5 text-sm leading-relaxed text-ink"
              >
                {insight}
              </li>
            ))}
          </ul>
        </AppCard>
      ) : null}

      <AppCard className="mb-5 p-4 sm:p-5">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-bold text-ink">الدخل مقابل المصروف</h2>
            <p className="mt-1 text-xs text-muted">بالعملة {currency}</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              الدخل
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-danger" />
              المصروف
            </span>
          </div>
        </div>
        <div
          role="img"
          aria-label="اتجاه الدخل والمصروف"
          className="h-56 w-full"
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={analytics.monthlyTrend}
              margin={{ top: 8, right: 0, left: -24, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--mizan-border)"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--mizan-text-muted)", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--mizan-text-muted)", fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="var(--mizan-primary)"
                fill="var(--mizan-primary-soft)"
                strokeWidth={2.5}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="var(--mizan-danger)"
                fill="transparent"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </AppCard>

      <AppCard className="mb-5 p-4 sm:p-5">
        <div className="mb-5">
          <h2 className="font-bold text-ink">توزيع المصروفات</h2>
          <p className="mt-1 text-xs text-muted">أين ذهب إنفاقك هذا الشهر</p>
        </div>
        {analytics.categoryMix.length === 0 ? (
          <p className="text-sm text-muted">لا مصروفات مسجّلة هذا الشهر بعد.</p>
        ) : (
          <ul className="space-y-4">
            {analytics.categoryMix.map((category) => (
              <li key={category.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">{category.name}</span>
                  <span className="numeric text-xs font-bold text-muted">
                    {formatMinorAmount(category.amountMinor, {
                      currency,
                      locale: "en-US",
                    })}{" "}
                    {currency}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <progress
                    max={100}
                    value={category.percent}
                    aria-label={`نسبة ${category.name}`}
                    className="h-2 flex-1 overflow-hidden rounded-full accent-primary"
                  />
                  <span className="numeric w-8 text-left text-xs font-bold text-primary">
                    {category.percent}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard className="mb-5 p-4 sm:p-5">
        <div className="mb-1 flex items-end justify-between">
          <div>
            <h2 className="font-bold text-ink">تفصيل التصنيفات</h2>
            <p className="mt-1 text-xs text-muted">
              الدخل والمصروف لكل تصنيف خلال الفترة المختارة
            </p>
          </div>
        </div>
        {analytics.categoryBreakdown.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            لا توجد حركات مصنّفة في هذه الفترة بعد. اربط معاملاتك بالتصنيفات
            لرؤية هذا التقرير.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {analytics.categoryBreakdown.map((row) => {
              const total =
                row.incomeMinor + row.expenseMinor;
              const incomePct =
                total > 0n
                  ? Number((row.incomeMinor * 100n) / total)
                  : 0;
              return (
                <li key={row.name} className="py-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">{row.name}</span>
                    <span
                      className={`numeric text-xs font-bold ${
                        row.netMinor >= 0n ? "text-success" : "text-danger"
                      }`}
                      dir="ltr"
                    >
                      {row.netMinor >= 0n ? "+" : ""}
                      {formatMinorAmount(row.netMinor, {
                        currency,
                        locale: "en-US",
                      })}
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-subtle">
                    <span
                      className="bg-success"
                      style={{ width: `${incomePct}%` }}
                      aria-label={`دخل ${row.name}`}
                    />
                    <span
                      className="bg-danger"
                      style={{ width: `${100 - incomePct}%` }}
                      aria-label={`مصروف ${row.name}`}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                    <span className="numeric" dir="ltr">
                      دخل{" "}
                      {formatMinorAmount(row.incomeMinor, {
                        currency,
                        locale: "en-US",
                      })}
                    </span>
                    <span className="numeric" dir="ltr">
                      مصروف{" "}
                      {formatMinorAmount(row.expenseMinor, {
                        currency,
                        locale: "en-US",
                      })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AppCard>

      {analytics.topProjects.length > 0 ? (
        <AppCard className="p-4 sm:p-5">
          <h2 className="mb-4 font-bold text-ink">أداء المشاريع</h2>
          <ul className="space-y-3">
            {analytics.topProjects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold text-ink">{project.name}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    هامش بعد مستحقات العمال {project.margin.toFixed(1)}%
                  </p>
                </div>
                <span
                  className={`numeric text-sm font-bold ${
                    project.profitMinor >= 0n ? "text-success" : "text-danger"
                  }`}
                >
                  {formatMinorAmount(project.profitMinor, {
                    currency,
                    locale: "en-US",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </AppCard>
      ) : null}

      <AppCard className="mt-5 p-4 sm:p-5">
        <h2 className="font-bold text-ink">تجميع المشاريع الأب</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          صافي مجمّع لكل مشروع أب مع فروعه المباشرة.
        </p>
        {(() => {
          const { roots } = groupProjectsByParent(
            projects.filter((project) => project.status === "active"),
          );
          if (roots.length === 0) {
            return (
              <p className="mt-3 text-xs text-muted">
                لا توجد علاقات أب/فرع بعد.
              </p>
            );
          }
          return (
            <ul className="mt-3 space-y-2 text-xs">
              {roots.map((group) => (
                <li
                  className="flex items-center justify-between rounded-sm border border-line px-3 py-2.5"
                  key={group.parent.id}
                >
                  <span className="font-semibold text-ink">
                    {group.parent.name} · {group.childCount} فرعي
                  </span>
                  <span
                    className={`numeric font-bold ${
                      group.rolledProfitMinor >= 0n
                        ? "text-success"
                        : "text-danger"
                    }`}
                    dir="ltr"
                  >
                    {formatMinorAmount(group.rolledProfitMinor, {
                      currency,
                      locale: "en-US",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          );
        })()}
      </AppCard>

      <AppCard className="mt-5 p-4 sm:p-5">
        <h2 className="font-bold text-ink">مقارنة أشهر ومشاريع</h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          مقارنة مباشرة من بياناتك الحالية فقط، مع احترام بوابة الثقة.
        </p>
        {analytics.confidence === "low" ? (
          <p className="mt-4 rounded-sm bg-warning-soft px-3 py-2.5 text-xs leading-5 text-warning">
            ثقة التحليل منخفضة ({confidenceLabel}). أضف مزيدًا من الحركات قبل
            الاعتماد على المقارنة لاتخاذ قرارات كبيرة.
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-ink">آخر شهرين</h3>
            {analytics.monthlyTrend.length >= 2 ? (
              <ul className="mt-3 space-y-2 text-xs">
                {analytics.monthlyTrend.slice(-2).map((point) => (
                  <li
                    className="flex items-center justify-between rounded-sm border border-line px-3 py-2.5"
                    key={point.month}
                  >
                    <span className="font-semibold text-ink">{point.month}</span>
                    <span className="numeric text-muted" dir="ltr">
                      دخل {point.income.toFixed(2)} · مصروف{" "}
                      {point.expense.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted">لا يكفي شهران للمقارنة بعد.</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">أول مشروعين</h3>
            {analytics.topProjects.length >= 2 ? (
              <ul className="mt-3 space-y-2 text-xs">
                {analytics.topProjects.slice(0, 2).map((project) => (
                  <li
                    className="flex items-center justify-between rounded-sm border border-line px-3 py-2.5"
                    key={project.id}
                  >
                    <span className="font-semibold text-ink">{project.name}</span>
                    <span
                      className={`numeric font-bold ${
                        project.profitMinor >= 0n ? "text-success" : "text-danger"
                      }`}
                      dir="ltr"
                    >
                      {formatMinorAmount(project.profitMinor, {
                        currency,
                        locale: "en-US",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted">
                أضف مشروعين على الأقل لإظهار المقارنة.
              </p>
            )}
          </div>
        </div>
      </AppCard>
    </div>
  );
}
