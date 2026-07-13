import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Snowflake,
  Users,
  Warehouse,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { AppCard } from "@/shared/ui/AppCard";
import {
  fetchPendingPayments,
  fetchPlatformStats,
  fetchRecentActivity,
  fetchWorkspaceOverview,
  supervisorKeys,
} from "./supervisor-api";
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  StatCard,
  StatusBadge,
} from "./SupervisorUi";
import {
  formatDateAr,
  formatMinorCurrency,
  statusTone,
  subscriptionStatusLabel,
  supervisorEventLabel,
} from "./supervisor-utils";

const percentageFormatter = new Intl.NumberFormat("ar-LY-u-nu-latn", {
  maximumFractionDigits: 1,
});

export function SupervisorOverviewPage() {
  const [referenceTime] = useState(() => Date.now());
  const statsQuery = useQuery({
    queryKey: supervisorKeys.stats,
    queryFn: fetchPlatformStats,
  });
  const paymentsQuery = useQuery({
    queryKey: supervisorKeys.payments,
    queryFn: fetchPendingPayments,
  });
  const workspacesQuery = useQuery({
    queryKey: supervisorKeys.workspaces,
    queryFn: fetchWorkspaceOverview,
  });
  const activityQuery = useQuery({
    queryKey: supervisorKeys.activity,
    queryFn: fetchRecentActivity,
  });

  const stats = statsQuery.data;
  const payments = paymentsQuery.data ?? [];
  const workspaces = workspacesQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const workspaceNames = new Map(
    workspaces.map((workspace) => [
      workspace.workspace_id,
      workspace.workspace_name,
    ]),
  );

  const pendingByCurrency = new Map<string, number>();
  for (const payment of payments) {
    pendingByCurrency.set(
      payment.currencyCode,
      (pendingByCurrency.get(payment.currencyCode) ?? 0) + payment.amountMinor,
    );
  }
  const pendingAmountLabel =
    [...pendingByCurrency.entries()]
      .map(
        ([currency, amount]) =>
          `${formatMinorCurrency(amount, currency)} ${currency}`,
      )
      .join(" · ") || "لا مبالغ معلّقة";

  const subscriptionTotal = stats
    ? stats.trialing_count +
      stats.active_count +
      stats.frozen_count +
      stats.churned_count
    : 0;
  const rate = (value: number, total: number) =>
    total > 0 ? (value / total) * 100 : null;
  const activeRate = stats ? rate(stats.active_count, subscriptionTotal) : null;
  const atRiskRate = stats
    ? rate(stats.frozen_count + stats.churned_count, subscriptionTotal)
    : null;
  const healthyUsersRate = stats
    ? rate(
        Math.max(stats.total_users - stats.suspended_users, 0),
        stats.total_users,
      )
    : null;
  const expiringSoon = workspaces.filter((row) => {
    if (!row.trial_ends_at || row.subscription_status !== "trialing") {
      return false;
    }
    const days = Math.ceil(
      (new Date(row.trial_ends_at).getTime() - referenceTime) /
        (1000 * 60 * 60 * 24),
    );
    return days >= 0 && days <= 3;
  });

  const distribution = stats
    ? [
        {
          name: "نشط",
          value: stats.active_count,
          color: "var(--mizan-success)",
        },
        {
          name: "تجريبي",
          value: stats.trialing_count,
          color: "var(--mizan-primary)",
        },
        {
          name: "مجمّد",
          value: stats.frozen_count,
          color: "var(--mizan-info)",
        },
        {
          name: "منتهٍ",
          value: stats.churned_count,
          color: "var(--mizan-danger)",
        },
      ]
    : [];
  const operatingRates = [
    {
      label: "الاشتراكات النشطة",
      value: activeRate,
      helper: "من جميع الاشتراكات المسجّلة",
      tone: "bg-success",
    },
    {
      label: "سلامة حسابات المستخدمين",
      value: healthyUsersRate,
      helper: "حسابات غير موقوفة أو معطّلة",
      tone: "bg-primary",
    },
    {
      label: "الاشتراكات المعرّضة للفقد",
      value: atRiskRate,
      helper: "مجمّدة أو منتهية وتحتاج متابعة",
      tone: "bg-warning",
    },
  ];

  const isLoading =
    statsQuery.isLoading ||
    paymentsQuery.isLoading ||
    workspacesQuery.isLoading ||
    activityQuery.isLoading;
  const firstError =
    statsQuery.error ??
    paymentsQuery.error ??
    workspacesQuery.error ??
    activityQuery.error;

  if (isLoading) {
    return (
      <div className="space-y-5 pt-5">
        <div>
          <h1 className="text-2xl font-bold text-ink">مركز العمليات</h1>
          <p className="mt-1 text-sm text-muted">
            جارٍ تجميع بيانات المنصة الحالية.
          </p>
        </div>
        <LoadingBlock rows={5} />
      </div>
    );
  }

  if (firstError) {
    return (
      <div className="space-y-5 pt-5">
        <div>
          <h1 className="text-2xl font-bold text-ink">مركز العمليات</h1>
          <p className="mt-1 text-sm text-muted">
            حالة المنصة والاشتراكات والقرارات الإدارية.
          </p>
        </div>
        <ErrorBlock
          message={
            firstError instanceof Error ? firstError.message : "حاول مرة أخرى"
          }
          onRetry={() => {
            void Promise.all([
              statsQuery.refetch(),
              paymentsQuery.refetch(),
              workspacesQuery.refetch(),
              activityQuery.refetch(),
            ]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-5 lg:pt-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-semibold text-primary">
            بيانات تشغيلية مباشرة
          </p>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.035em] text-ink sm:text-3xl">
            هذه صورة المنصة الآن
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            الاشتراكات، طلبات الدفع، المخاطر، وآخر القرارات من السجلات الفعلية.
          </p>
        </div>
        <Link
          to="/supervisor/payments"
          className="pressable inline-flex min-h-10 w-fit items-center gap-1.5 rounded-[10px] bg-primary-soft px-3.5 text-xs font-bold text-primary hover:bg-primary hover:text-primary-on"
        >
          قائمة الأولويات
          <ArrowLeft aria-hidden="true" size={14} />
        </Link>
      </header>

      {payments.length > 0 || expiringSoon.length > 0 ? (
        <section
          aria-label="تنبيهات تحتاج قرارًا"
          className="flex flex-col gap-3 rounded-[12px] border border-warning/25 bg-warning-soft/45 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-warning-soft text-warning">
              <AlertTriangle aria-hidden="true" size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">
                {payments.length + expiringSoon.length} عناصر تحتاج متابعة
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                {payments.length} طلبات دفع معلّقة · {expiringSoon.length} تجارب
                تنتهي خلال 3 أيام
              </p>
            </div>
          </div>
          <Link
            to="/supervisor/payments"
            className="text-xs font-bold text-warning"
          >
            ابدأ المراجعة
          </Link>
        </section>
      ) : null}

      {stats ? (
        <section
          aria-label="مؤشرات المنصة الأساسية"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <StatCard
            label="مساحات العمل"
            value={stats.total_workspaces}
            hint={`${stats.active_count} اشتراك نشط`}
            icon={<Warehouse size={18} className="text-primary" />}
          />
          <StatCard
            label="المستخدمون"
            value={stats.total_users}
            hint={`${stats.suspended_users} حسابات موقوفة`}
            icon={<Users size={18} className="text-info" />}
          />
          <StatCard
            label="طلبات الدفع"
            value={stats.pending_payments}
            hint={pendingAmountLabel}
            icon={<CreditCard size={18} className="text-warning" />}
          />
          <StatCard
            label="اشتراكات مجمّدة"
            value={stats.frozen_count}
            hint={
              atRiskRate == null
                ? "لا توجد بيانات"
                : `${percentageFormatter.format(atRiskRate)}% معرّضة للفقد`
            }
            icon={<Snowflake size={18} className="text-info" />}
          />
        </section>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
        <AppCard className="rounded-[12px] p-4 shadow-[0_2px_18px_rgb(27_30_60/4%)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">
                توزيع الاشتراكات
              </h2>
              <p className="mt-1 text-[11px] text-muted">
                الحالة الحالية لكل مساحة عمل
              </p>
            </div>
            <ShieldCheck className="text-primary" size={19} aria-hidden="true" />
          </div>

          {subscriptionTotal > 0 ? (
            <div className="mt-4 grid items-center gap-3 sm:grid-cols-[11rem_1fr]">
              <div className="relative mx-auto h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={76}
                      paddingAngle={2}
                      stroke="var(--mizan-surface)"
                      strokeWidth={3}
                    >
                      {distribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--mizan-surface)",
                        border: "1px solid var(--mizan-border)",
                        borderRadius: "9px",
                        direction: "rtl",
                        fontSize: "11px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <strong className="numeric block text-2xl font-bold text-ink">
                      {subscriptionTotal}
                    </strong>
                    <span className="text-[9px] text-muted">اشتراك</span>
                  </div>
                </div>
              </div>
              <ul className="space-y-3">
                {distribution.map((entry) => (
                  <li
                    key={entry.name}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="flex items-center gap-2 text-muted">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      {entry.name}
                    </span>
                    <span className="numeric font-bold text-ink">
                      {entry.value} (
                      {percentageFormatter.format(
                        (entry.value / subscriptionTotal) * 100,
                      )}
                      %)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyBlock
              title="لا اشتراكات بعد"
              description="يظهر التوزيع فور إنشاء أول مساحة."
            />
          )}
        </AppCard>

        <AppCard className="rounded-[12px] p-4 shadow-[0_2px_18px_rgb(27_30_60/4%)] sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink">آخر نشاط إداري</h2>
              <p className="mt-1 text-[11px] text-muted">
                أثر القرارات الحساسة بترتيبها الزمني
              </p>
            </div>
            <Link
              to="/supervisor/activity"
              className="text-[11px] font-bold text-primary"
            >
              السجل الكامل
            </Link>
          </div>

          {activity.length === 0 ? (
            <EmptyBlock
              title="لا نشاط بعد"
              description="تظهر هنا قرارات الاشتراك والدفع."
            />
          ) : (
            <ol className="divide-y divide-line">
              {activity.slice(0, 5).map((event) => (
                <li key={event.id} className="flex gap-3 py-3 first:pt-0">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-primary-soft text-primary">
                    <Activity aria-hidden="true" size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-xs font-bold text-ink">
                        {supervisorEventLabel[event.event_type] ??
                          event.event_type}
                      </p>
                      <time className="shrink-0 text-[9px] text-soft">
                        {formatDateAr(event.created_at)}
                      </time>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted">
                      {workspaceNames.get(event.workspace_id) ?? "مساحة عمل"} ·{" "}
                      {subscriptionStatusLabel[event.from_status ?? ""] ??
                        event.from_status ??
                        "—"}{" "}
                      ←{" "}
                      {subscriptionStatusLabel[event.to_status ?? ""] ??
                        event.to_status ??
                        "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </AppCard>
      </section>

      <section
        aria-labelledby="operating-rates-title"
        className="rounded-[12px] border border-line bg-surface p-4 shadow-[0_2px_18px_rgb(27_30_60/4%)] sm:p-5"
      >
        <div className="mb-4">
          <h2 id="operating-rates-title" className="text-sm font-bold text-ink">
            مؤشرات القرار
          </h2>
          <p className="mt-1 text-[11px] text-muted">
            نسب محسوبة من الحالة الحالية وليست أرقامًا تسويقية.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {operatingRates.map((item) => {
            const value = item.value ?? 0;
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-ink">{item.label}</p>
                  <strong className="numeric text-sm text-ink">
                    {item.value == null
                      ? "—"
                      : `${percentageFormatter.format(item.value)}%`}
                  </strong>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-strong">
                  <div
                    className={`h-full rounded-full ${item.tone}`}
                    style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
                  />
                </div>
                <p className="mt-2 text-[10px] leading-5 text-muted">
                  {item.helper}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_2px_18px_rgb(27_30_60/4%)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-ink">طلبات الدفع المعلّقة</h2>
            <p className="mt-1 text-[10px] text-muted">
              الأقدم أولاً لتقليل زمن الانتظار
            </p>
          </div>
          <Link
            to="/supervisor/payments"
            className="text-[11px] font-bold text-primary"
          >
            عرض الكل
          </Link>
        </div>

        {payments.length === 0 ? (
          <div className="p-5">
            <EmptyBlock
              title="لا طلبات معلّقة"
              description="جميع طلبات الدفع الحالية تمت مراجعتها."
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line md:hidden">
              {payments.slice(0, 5).map((payment) => (
                <li key={payment.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-ink">
                        {payment.workspaceName ||
                          workspaceNames.get(payment.workspaceId) ||
                          "مساحة عمل"}
                      </p>
                      <p className="numeric mt-1 text-sm font-bold text-warning">
                        {formatMinorCurrency(
                          payment.amountMinor,
                          payment.currencyCode,
                        )}{" "}
                        {payment.currencyCode}
                      </p>
                    </div>
                    <StatusBadge
                      label="بانتظار المراجعة"
                      tone={statusTone("grace")}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted">
                    <span>{formatDateAr(payment.createdAt)}</span>
                    <Link
                      to="/supervisor/payments"
                      className="font-bold text-primary"
                    >
                      فتح الطلب
                    </Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[44rem] border-collapse text-right text-xs">
                <thead className="bg-canvas/70 text-[10px] text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">مساحة العمل</th>
                    <th className="px-4 py-3 font-semibold">القيمة</th>
                    <th className="px-4 py-3 font-semibold">وقت الطلب</th>
                    <th className="px-4 py-3 font-semibold">الحالة</th>
                    <th className="px-5 py-3 text-left font-semibold">
                      الإجراء
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payments.slice(0, 5).map((payment) => (
                    <tr
                      key={payment.id}
                      className="transition-colors hover:bg-canvas/65"
                    >
                      <td className="px-5 py-3.5 font-semibold text-ink">
                        {payment.workspaceName ||
                          workspaceNames.get(payment.workspaceId) ||
                          "مساحة عمل"}
                      </td>
                      <td className="numeric px-4 py-3.5 font-bold text-ink">
                        {formatMinorCurrency(
                          payment.amountMinor,
                          payment.currencyCode,
                        )}{" "}
                        {payment.currencyCode}
                      </td>
                      <td className="px-4 py-3.5 text-muted">
                        {formatDateAr(payment.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge
                          label="بانتظار المراجعة"
                          tone={statusTone("grace")}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-left">
                        <Link
                          to="/supervisor/payments"
                          className="inline-flex min-h-9 items-center rounded-[8px] px-3 font-bold text-primary hover:bg-primary-soft"
                        >
                          فتح الطلب
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {expiringSoon.length > 0 ? (
        <section aria-labelledby="expiring-title">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2
              aria-hidden="true"
              size={17}
              className="text-warning"
            />
            <h2 id="expiring-title" className="text-sm font-bold text-ink">
              تجارب تنتهي قريبًا
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {expiringSoon.slice(0, 6).map((workspace) => (
              <Link
                key={workspace.workspace_id}
                to="/supervisor/workspaces?filter=expiring"
                className="pressable rounded-[12px] border border-line bg-surface p-4 hover:border-warning/35"
              >
                <p className="truncate text-xs font-bold text-ink">
                  {workspace.workspace_name}
                </p>
                <p className="mt-2 text-[10px] text-muted">
                  تنتهي {formatDateAr(workspace.trial_ends_at)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
