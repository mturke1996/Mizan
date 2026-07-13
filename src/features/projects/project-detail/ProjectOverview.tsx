import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  ChartNoAxesCombined,
  Scale,
  Target,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { formatMinorAmount } from "@/domain/money/money";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { EmptyState } from "@/shared/ui/EmptyState";
import { StatCard } from "@/shared/ui/StatCard";
import { ProjectInsights } from "./ProjectInsights";
import { ProjectOpsSummaryPanel } from "./ProjectOpsSummaryPanel";
import { ProjectSetupJourney } from "./ProjectSetupJourney";
import { toProjectChartNumber } from "./project-detail-config";

interface ProjectOverviewProps {
  analytics: ProjectAnalyticsSnapshot;
  currency: string;
  onOpenSettings: () => void;
  project: ProjectSummary;
  timeZone: string;
  transactions: readonly FinanceTransaction[];
}

interface TrendChartPoint {
  expense: number;
  expenseFormatted: string;
  income: number;
  incomeFormatted: string;
  label: string;
  monthKey: string;
}

interface TrendTooltipEntry {
  dataKey?: string | number;
  payload?: TrendChartPoint;
}

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly TrendTooltipEntry[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-xs [box-shadow:var(--shadow-card)]">
      <p className="font-bold text-ink">{point.label}</p>
      <p className="mt-1 text-success">
        الدخل:{" "}
        <bdi className="numeric font-bold" dir="ltr">
          {point.incomeFormatted}
        </bdi>
      </p>
      <p className="mt-1 text-danger">
        المصروف:{" "}
        <bdi className="numeric font-bold" dir="ltr">
          {point.expenseFormatted}
        </bdi>
      </p>
    </div>
  );
}

function getGoalProgress(incomeMinor: bigint, goalMinor: bigint): number {
  if (goalMinor <= 0n || incomeMinor <= 0n) return 0;
  const scaled = (incomeMinor * 10_000n) / goalMinor;
  return Math.min(100, Number(scaled) / 100);
}

export function ProjectOverview({
  analytics,
  currency,
  onOpenSettings,
  project,
  timeZone,
  transactions,
}: ProjectOverviewProps) {
  const formatMoney = (value: bigint) =>
    formatMinorAmount(value, { currency, locale: "en-US" });
  const netLabel = project.modules.workers
    ? "الصافي بعد العمال"
    : "صافي الربح";
  const trendData: TrendChartPoint[] = analytics.monthlyTrend.map((point) => ({
    monthKey: point.monthKey,
    label: point.month,
    income: toProjectChartNumber(point.incomeMinor),
    expense: toProjectChartNumber(point.expenseMinor),
    incomeFormatted: formatMoney(point.incomeMinor),
    expenseFormatted: formatMoney(point.expenseMinor),
  }));
  const hasTrendData = analytics.dataPoints > 0 && trendData.some(
    (point) => point.income !== 0 || point.expense !== 0,
  );
  const hasGoal =
    project.modules.goal &&
    project.goalMinor !== undefined &&
    project.goalMinor > 0n;

  return (
    <div className="space-y-5">
      <ProjectOpsSummaryPanel
        analytics={analytics}
        currency={currency}
        project={project}
        timeZone={timeZone}
        transactions={transactions}
      />

      <section aria-labelledby="project-performance-title">
        <div className="mb-3">
          <h2
            className="text-lg font-bold text-ink"
            id="project-performance-title"
          >
            ملخص الأداء
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            قيم فعلية من كامل سجل معاملات المشروع.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon={<ArrowDownLeft aria-hidden="true" size={19} />}
            label="الدخل"
            tone="success"
            value={formatMoney(analytics.incomeMinor)}
          />
          <StatCard
            icon={<ArrowUpRight aria-hidden="true" size={19} />}
            label="المصروف"
            tone="danger"
            value={formatMoney(analytics.expenseMinor)}
          />
          <StatCard
            icon={<Banknote aria-hidden="true" size={19} />}
            label="الربح النقدي"
            tone={analytics.cashProfitMinor >= 0n ? "primary" : "danger"}
            value={formatMoney(analytics.cashProfitMinor)}
          />
          <StatCard
            icon={<Scale aria-hidden="true" size={19} />}
            label={netLabel}
            tone={analytics.profitAfterLaborMinor >= 0n ? "success" : "danger"}
            value={formatMoney(analytics.profitAfterLaborMinor)}
          />
        </div>
      </section>

      {hasGoal && project.goalMinor !== undefined ? (
        <AppCard
          aria-labelledby="project-goal-title"
          className="p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-primary-soft text-primary-ink">
                <Target aria-hidden="true" size={19} />
              </span>
              <div>
                <h2 className="font-bold text-ink" id="project-goal-title">
                  التقدم نحو الهدف
                </h2>
                <p className="mt-1 text-xs text-muted">هدف إيرادات المشروع</p>
              </div>
            </div>
            <p className="text-left">
              <bdi
                className="numeric block text-lg font-bold text-primary-ink"
                dir="ltr"
              >
                {getGoalProgress(
                  analytics.incomeMinor,
                  project.goalMinor,
                ).toFixed(0)}
                %
              </bdi>
              <bdi className="numeric text-xs text-muted" dir="ltr">
                {formatMoney(project.goalMinor)} {currency}
              </bdi>
            </p>
          </div>
          <progress
            aria-label={`تقدم هدف ${project.name}`}
            className="mt-4 h-2.5 w-full"
            max={100}
            value={getGoalProgress(analytics.incomeMinor, project.goalMinor)}
          />
        </AppCard>
      ) : null}

      <ProjectSetupJourney
        analytics={analytics}
        onOpenSettings={onOpenSettings}
        projectId={project.id}
      />

      <ProjectInsights analytics={analytics} projectId={project.id} />

      <AppCard
        aria-labelledby="project-monthly-trend-title"
        className="p-4 sm:p-5"
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink" id="project-monthly-trend-title">
              الدخل والمصروف شهريًا
            </h2>
            <p className="mt-1 text-xs text-muted">
              سجل فعلي بعملة {currency}، دون توقعات.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-success" />
              الدخل
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-danger" />
              المصروف
            </span>
          </div>
        </div>

        {hasTrendData ? (
          <div
            aria-label="اتجاه الدخل والمصروف للمشروع"
            className="h-52 w-full"
            role="img"
          >
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <LineChart
                data={trendData}
                margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
              >
                <CartesianGrid
                  stroke="var(--mizan-border)"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  axisLine={false}
                  dataKey="label"
                  tick={{
                    fill: "var(--mizan-text-muted)",
                    fontSize: 10,
                  }}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={(props) => (
                    <TrendTooltip
                      active={props.active}
                      payload={
                        props.payload as unknown as readonly TrendTooltipEntry[]
                      }
                    />
                  )}
                  cursor={{ stroke: "var(--mizan-border-strong)" }}
                />
                <Line
                  dataKey="income"
                  dot={{ fill: "var(--mizan-success)", r: 2 }}
                  name="الدخل"
                  stroke="var(--mizan-success)"
                  strokeWidth={2.25}
                  type="monotone"
                />
                <Line
                  dataKey="expense"
                  dot={{ fill: "var(--mizan-danger)", r: 2 }}
                  name="المصروف"
                  stroke="var(--mizan-danger)"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            className="border-0 bg-surface-subtle"
            description="أضف أول دخل أو مصروف للمشروع لعرض اتجاه شهري حقيقي."
            icon={<ChartNoAxesCombined aria-hidden="true" size={22} />}
            title="لا توجد بيانات كافية لرسم الاتجاه"
          />
        )}
      </AppCard>
    </div>
  );
}
