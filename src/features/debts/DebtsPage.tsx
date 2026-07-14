import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Plus,
  Scale,
} from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { computeDebtAnalytics } from "@/domain/debts/compute-debt-analytics";
import { formatMinorAmount } from "@/domain/money/money";
import { useAuth } from "@/features/auth/use-auth";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  DebtStatus,
  DebtSummary,
} from "@/features/workspace/workspace-types";
import { MoneySectionTabs } from "@/shared/navigation/MoneySectionTabs";
import { Badge, type BadgeTone } from "@/shared/ui/Badge";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useDebtsView } from "./use-debts-view";

type DebtFilter = "all" | "receivable" | "payable" | "overdue";

const FILTERS: ReadonlyArray<{ value: DebtFilter; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "receivable", label: "لي" },
  { value: "payable", label: "عليّ" },
  { value: "overdue", label: "متأخرة" },
];

const STATUS_LABELS: Record<DebtStatus, string> = {
  open: "مفتوح",
  partial: "مسدد جزئيًا",
  settled: "مسدد",
  written_off: "مشطوب",
};

const STATUS_TONES: Record<DebtStatus, BadgeTone> = {
  open: "warning",
  partial: "info",
  settled: "success",
  written_off: "neutral",
};

function todayInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US-u-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function isOutstanding(debt: DebtSummary): boolean {
  return (
    debt.balanceMinor > 0n &&
    debt.status !== "settled" &&
    debt.status !== "written_off"
  );
}

function isOverdue(debt: DebtSummary, today: string): boolean {
  return Boolean(isOutstanding(debt) && debt.dueOn && debt.dueOn < today);
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("ar-LY", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}

function settlementProgress(debt: DebtSummary): number {
  if (debt.principalMinor <= 0n) return 0;
  const paid = debt.principalMinor - debt.balanceMinor;
  if (paid <= 0n) return 0;
  const pct = Number((paid * 100n) / debt.principalMinor);
  return Math.max(0, Math.min(100, pct));
}

function DebtCard({
  debt,
  today,
}: {
  debt: DebtSummary;
  today: string;
}) {
  const DirectionIcon =
    debt.direction === "receivable" ? ArrowDownLeft : ArrowUpRight;
  const directionLabel =
    debt.direction === "receivable" ? "مستحق لي" : "مستحق عليّ";
  const overdue = isOverdue(debt, today);
  const progress = settlementProgress(debt);
  const money = { currency: debt.currencyCode, locale: "en-US" as const };

  return (
    <li>
      <Link
        to={`/debts/${encodeURIComponent(debt.id)}`}
        className="pressable group block rounded-[20px] border border-line bg-surface p-4 shadow-[0_8px_28px_rgb(27_30_60/4%)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(27_30_60/8%)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={[
                "grid size-11 shrink-0 place-items-center rounded-2xl ring-1 ring-inset",
                debt.direction === "receivable"
                  ? "bg-success-soft text-success ring-success/15"
                  : "bg-warning-soft text-warning ring-warning/15",
              ].join(" ")}
            >
              <DirectionIcon aria-hidden="true" size={18} strokeWidth={1.8} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="truncate text-[15px] font-bold tracking-tight text-ink">
                  {debt.partyName}
                </strong>
                <Badge tone={STATUS_TONES[debt.status]}>
                  {STATUS_LABELS[debt.status]}
                </Badge>
                {overdue ? (
                  <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">
                    متأخر
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">
                {directionLabel}
                {debt.projectName ? ` · ${debt.projectName}` : ""}
              </p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-semibold text-muted">المتبقي</p>
            <p
              className={[
                "numeric mt-0.5 text-lg font-black tracking-tight",
                overdue ? "text-danger" : "text-ink",
              ].join(" ")}
              dir="ltr"
            >
              {formatMinorAmount(debt.balanceMinor, money)}
            </p>
            <p className="mt-0.5 text-[10px] font-bold text-muted">
              {debt.currencyCode}
            </p>
          </div>
        </div>

        {isOutstanding(debt) && debt.principalMinor > 0n ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted">
              <span>التسديد</span>
              <span className="numeric font-bold" dir="ltr">
                {progress}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className={[
                  "h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  debt.direction === "receivable" ? "bg-success" : "bg-warning",
                ].join(" ")}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {debt.dueOn ? (
          <p
            className={[
              "mt-3 inline-flex items-center gap-1.5 text-[11px]",
              overdue ? "font-bold text-danger" : "text-muted",
            ].join(" ")}
          >
            <CalendarClock aria-hidden="true" size={13} />
            {overdue ? "متأخر منذ " : "الاستحقاق "}
            <bdi>{formatDate(debt.dueOn)}</bdi>
          </p>
        ) : null}
      </Link>
    </li>
  );
}

export function DebtsPage() {
  const [now] = useState(() => new Date());
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const { currency } = useWorkspace();
  const { debts, isLoading, error, refresh } = useDebtsView();
  const requestedFilter = searchParams.get("filter");
  const activeFilter = FILTERS.some(
    (filter) => filter.value === requestedFilter,
  )
    ? (requestedFilter as DebtFilter)
    : "all";
  const timeZone = profile?.timezone ?? "Africa/Tripoli";
  const today = todayInTimeZone(now, timeZone);
  const analytics = computeDebtAnalytics({
    debts: debts.filter((debt) => debt.currencyCode === currency),
    now,
    timeZone,
  });
  const filtered = debts.filter((debt) => {
    if (activeFilter === "receivable") {
      return debt.direction === "receivable";
    }
    if (activeFilter === "payable") return debt.direction === "payable";
    if (activeFilter === "overdue") return isOverdue(debt, today);
    return true;
  });
  const money = { currency, locale: "en-US" as const };

  const header = (
    <PageHeader
      title="الديون"
      subtitle="ما لك وما عليك — حتى الإغلاق الكامل"
      action={
        <Link
          to="/debts/new"
          aria-label="إضافة دين"
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
        >
          <Plus aria-hidden="true" size={18} />
          إضافة
        </Link>
      }
    />
  );

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6">
        <MoneySectionTabs active="debts" />
        {header}
        <div
          aria-label="جاري تحميل الديون"
          className="space-y-4"
          role="status"
        >
          <div className="h-36 animate-pulse rounded-[22px] bg-surface-subtle motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-2xl bg-surface-subtle motion-reduce:animate-none" />
          <div className="h-28 animate-pulse rounded-[20px] bg-surface-subtle motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6">
        <MoneySectionTabs active="debts" />
        {header}
        <ErrorState message={error} onRetry={() => void refresh()} />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 sm:px-6">
      <MoneySectionTabs active="debts" />
      {header}

      {/* Balance hero */}
      <section
        aria-label="ملخص أرصدة الديون"
        className="mb-5 overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_12px_36px_rgb(27_30_60/6%)]"
      >
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,rgb(67_56_202/14%),rgb(245_158_11/8%)_48%,rgb(16_185_129/10%))] px-5 py-5 sm:px-6">
          <div className="pointer-events-none absolute -start-10 top-0 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -end-8 bottom-0 size-36 rounded-full bg-warning/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted">
                صافي الذمم
              </p>
              <p
                className={[
                  "numeric mt-1 text-3xl font-black tracking-tight",
                  analytics.netMinor < 0n ? "text-danger" : "text-ink",
                ].join(" ")}
                dir="ltr"
              >
                {formatMinorAmount(analytics.netMinor, money)}
                <span className="ms-1.5 text-sm font-bold text-muted">
                  {currency}
                </span>
              </p>
              <p className="mt-2 text-xs text-muted">
                {analytics.openCount > 0
                  ? `${analytics.openCount} رصيد مفتوح يحتاج متابعة`
                  : "لا أرصدة مفتوحة الآن"}
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-surface/80 text-primary shadow-[0_8px_20px_rgb(27_30_60/8%)] backdrop-blur-sm">
              <Scale aria-hidden="true" size={22} strokeWidth={1.7} />
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-2 divide-x divide-x-reverse divide-line border-t border-line">
          <div className="px-5 py-4">
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
              <ArrowDownLeft size={13} className="text-success" />
              مستحق لك
            </dt>
            <dd className="numeric mt-1.5 text-lg font-black text-success" dir="ltr">
              {formatMinorAmount(analytics.receivableMinor, money)}
            </dd>
          </div>
          <div className="px-5 py-4">
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
              <ArrowUpRight size={13} className="text-warning" />
              مستحق عليك
            </dt>
            <dd className="numeric mt-1.5 text-lg font-black text-warning" dir="ltr">
              {formatMinorAmount(analytics.payableMinor, money)}
            </dd>
          </div>
        </dl>

        {analytics.overdueCount > 0 ? (
          <Link
            to="/debts?filter=overdue"
            className="flex items-center justify-between gap-3 border-t border-danger/15 bg-danger-soft px-5 py-3 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
          >
            <span className="inline-flex items-center gap-2">
              <CalendarClock aria-hidden="true" size={14} />
              {analytics.overdueCount} ديون متأخرة — راجعها الآن
            </span>
            <span aria-hidden="true">←</span>
          </Link>
        ) : null}
      </section>

      <nav
        aria-label="تصفية الديون"
        className="mb-5 grid grid-cols-4 gap-1 rounded-2xl border border-line/70 bg-surface-subtle/70 p-1"
      >
        {FILTERS.map((filter) => {
          const active = filter.value === activeFilter;
          return (
            <Link
              key={filter.value}
              to={`/debts?filter=${filter.value}`}
              aria-current={active ? "page" : undefined}
              className={[
                "pressable flex min-h-10 items-center justify-center rounded-xl px-2 text-xs font-bold transition-colors",
                active
                  ? "bg-surface text-primary shadow-[0_4px_14px_rgb(27_30_60/6%)]"
                  : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="debt-list-title">
        <div className="mb-3 flex items-end justify-between gap-3 px-0.5">
          <div>
            <h2 id="debt-list-title" className="text-base font-bold text-ink">
              سجل الديون
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {analytics.overdueCount > 0
                ? `${analytics.overdueCount} متأخرة تحتاج متابعة`
                : "الأرصدة محدثة من سجل الحركات"}
            </p>
          </div>
          <span className="numeric rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-bold text-muted">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Scale aria-hidden="true" size={22} />}
            title={debts.length === 0 ? "لا ديون مسجلة" : "لا توجد ديون مطابقة"}
            description={
              debts.length === 0
                ? "أضف أول دين لتتبع الرصيد والدفعات من مكان واحد."
                : "غيّر عامل التصفية لمراجعة بقية السجل."
            }
            action={
              debts.length === 0 ? (
                <Link
                  to="/debts/new"
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-on"
                >
                  <Plus aria-hidden="true" size={16} />
                  إضافة دين
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="space-y-3">
            {filtered.map((debt) => (
              <DebtCard key={debt.id} debt={debt} today={today} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
