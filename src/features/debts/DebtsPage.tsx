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
import { AppCard } from "@/shared/ui/AppCard";
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

function DebtRow({
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

  return (
    <li>
      <Link
        to={`/debts/${encodeURIComponent(debt.id)}`}
        className="pressable grid gap-3 px-4 py-4 hover:bg-surface-subtle sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-sm ${
              debt.direction === "receivable"
                ? "bg-success-soft text-success"
                : "bg-warning-soft text-warning"
            }`}
          >
            <DirectionIcon aria-hidden="true" size={18} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <strong className="truncate text-sm text-ink">
                {debt.partyName}
              </strong>
              <Badge tone={STATUS_TONES[debt.status]}>
                {STATUS_LABELS[debt.status]}
              </Badge>
            </span>
            <span className="mt-1 block text-xs text-muted">
              {directionLabel}
              {debt.projectName ? `، ${debt.projectName}` : ""}
            </span>
            {debt.dueOn ? (
              <span
                className={`mt-2 inline-flex items-center gap-1.5 text-xs ${
                  overdue ? "font-semibold text-danger" : "text-muted"
                }`}
              >
                <CalendarClock aria-hidden="true" size={13} />
                {overdue ? "متأخر منذ " : "الاستحقاق "}
                <bdi>{formatDate(debt.dueOn)}</bdi>
              </span>
            ) : null}
          </span>
        </span>

        <span className="flex items-baseline justify-between gap-3 sm:block sm:text-left">
          <span className="text-xs text-muted sm:hidden">الرصيد المتبقي</span>
          <strong
            className={`numeric block text-base ${
              overdue ? "text-danger" : "text-ink"
            }`}
          >
            {formatMinorAmount(debt.balanceMinor, {
              currency: debt.currencyCode,
              locale: "en-US",
            })}
          </strong>
          <span className="mt-1 block text-[11px] font-semibold text-muted">
            {debt.currencyCode}
          </span>
        </span>
      </Link>
    </li>
  );
}

function SummaryValue({
  label,
  value,
  currency,
  className = "text-ink",
}: {
  label: string;
  value: bigint;
  currency: string;
  className?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`numeric mt-2 truncate text-lg font-bold sm:text-xl ${className}`}
        dir="ltr"
      >
        {formatMinorAmount(value, {
          currency,
          locale: "en-US",
        })}
      </p>
      <p className="mt-1 text-[11px] font-semibold text-muted">{currency}</p>
    </div>
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

  const header = (
    <PageHeader
      title="الديون"
      subtitle="تابع ما لك وما عليك من رصيد حتى الإغلاق."
      action={
        <Link
          to="/debts/new"
          aria-label="إضافة دين"
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
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
        {header}
        <div
          aria-label="جاري تحميل الديون"
          className="space-y-4"
          role="status"
        >
          <div className="h-28 animate-pulse rounded-md bg-surface-subtle motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-sm bg-surface-subtle motion-reduce:animate-none" />
          <div className="h-64 animate-pulse rounded-md bg-surface-subtle motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6">
        {header}
        <ErrorState message={error} onRetry={() => void refresh()} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6">
      {header}

      <AppCard
        aria-label="ملخص أرصدة الديون"
        className="mb-5 grid grid-cols-3 divide-x divide-x-reverse divide-line overflow-hidden"
      >
        <SummaryValue
          label="لي"
          value={analytics.receivableMinor}
          currency={currency}
          className="text-success"
        />
        <SummaryValue
          label="عليّ"
          value={analytics.payableMinor}
          currency={currency}
          className="text-warning"
        />
        <SummaryValue
          label="الصافي"
          value={analytics.netMinor}
          currency={currency}
          className={analytics.netMinor < 0n ? "text-danger" : "text-primary"}
        />
      </AppCard>

      <nav
        aria-label="تصفية الديون"
        className="mb-5 grid grid-cols-4 rounded-sm bg-surface-subtle p-1"
      >
        {FILTERS.map((filter) => {
          const active = filter.value === activeFilter;
          return (
            <Link
              key={filter.value}
              to={`/debts?filter=${filter.value}`}
              aria-current={active ? "page" : undefined}
              className={`pressable flex min-h-10 items-center justify-center rounded-xs px-2 text-xs font-bold ${
                active
                  ? "bg-surface text-primary-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="debt-list-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="debt-list-title" className="text-lg font-bold text-ink">
              سجل الديون
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {analytics.overdueCount > 0
                ? `${analytics.overdueCount} متأخرة تحتاج متابعة`
                : "الأرصدة محدثة من سجل الحركات"}
            </p>
          </div>
          <span className="numeric text-xs font-semibold text-muted">
            {filtered.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Scale aria-hidden="true" size={22} />}
            title={debts.length === 0 ? "لا ديون مسجلة" : "لا توجد ديون مطابقة"}
            description={
              debts.length === 0
                ? "أضف أول دين لتتبع رصيده ودفعاته من مكان واحد."
                : "غيّر عامل التصفية لمراجعة بقية السجل."
            }
            action={
              debts.length === 0 ? (
                <Link
                  to="/debts/new"
                  className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
                >
                  <Plus aria-hidden="true" size={16} />
                  إضافة دين
                </Link>
              ) : undefined
            }
          />
        ) : (
          <AppCard className="overflow-hidden p-0">
            <ul className="divide-y divide-line">
              {filtered.map((debt) => (
                <DebtRow key={debt.id} debt={debt} today={today} />
              ))}
            </ul>
          </AppCard>
        )}
      </section>
    </div>
  );
}
