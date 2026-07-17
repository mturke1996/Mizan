import {
  Briefcase,
  CalendarDays,
  Gift,
  MinusCircle,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";
import type {
  IncomeSource,
  IncomeSourceBalance,
} from "@/features/workspace/workspace-types";
import {
  useIncomeSourceBalancesQuery,
  useIncomeSourcesQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { MoneySectionTabs } from "@/shared/navigation/MoneySectionTabs";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import { ErrorState } from "@/shared/ui/ErrorState";
import { getUserErrorMessage } from "@/lib/user-error";

type PayFilter = "all" | "daily" | "monthly" | "both";

function payKindLabel(payKind: IncomeSource["payKind"]) {
  if (payKind === "daily") return "يومي";
  if (payKind === "monthly") return "شهري";
  return "مختلط";
}

function sharePercent(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Math.max(0, Math.min(100, Number((part * 100n) / total)));
}

function SourceCard({
  source,
  balance,
  currency,
  totalOutstanding,
}: {
  source: IncomeSource;
  balance: IncomeSourceBalance | undefined;
  currency: string;
  totalOutstanding: bigint;
}) {
  const outstanding = balance?.balanceMinor ?? 0n;
  const money = { currency, locale: "en-US" as const };
  const pct = sharePercent(outstanding, totalOutstanding);

  return (
    <li>
      <Link
        to={`/income/${source.id}`}
        className="pressable group block overflow-hidden rounded-[22px] border border-line bg-surface p-4 shadow-[0_8px_24px_rgb(27_30_60/4%)] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(27_30_60/8%)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
              <Briefcase aria-hidden="true" size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-ink">{source.name}</h3>
              <p className="mt-0.5 truncate text-xs text-muted">
                {source.place ? `${source.place} · ` : ""}
                {payKindLabel(source.payKind)}
              </p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-semibold text-muted">مستحق</p>
            <p
              className={[
                "numeric mt-0.5 text-lg font-black",
                outstanding > 0n ? "text-success" : "text-ink",
              ].join(" ")}
              dir="ltr"
            >
              {formatMinorAmount(outstanding, money)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            {balance?.workDays ?? 0} يوم
          </span>
          {(balance?.bonusMinor ?? 0n) > 0n ? (
            <span className="inline-flex items-center gap-1 text-success">
              <Gift size={12} />
              +{formatMinorAmount(balance!.bonusMinor, money)}
            </span>
          ) : null}
          {(balance?.deductedMinor ?? 0n) > 0n ? (
            <span className="inline-flex items-center gap-1 text-danger">
              <MinusCircle size={12} />
              -{formatMinorAmount(balance!.deductedMinor, money)}
            </span>
          ) : null}
          {(balance?.withdrawnMinor ?? 0n) > 0n ? (
            <span className="inline-flex items-center gap-1">
              <Wallet size={12} />
              سُحب {formatMinorAmount(balance!.withdrawnMinor, money)}
            </span>
          ) : null}
        </div>

        {totalOutstanding > 0n ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-muted">
              <span>حصته من المستحقات</span>
              <span className="numeric font-bold" dir="ltr">
                {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
              <div
                className="h-full rounded-full bg-success transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex gap-2">
          {(source.payKind === "daily" || source.payKind === "both") && (
            <span className="rounded-lg bg-primary-soft px-2.5 py-1 text-[10px] font-bold text-primary">
              سجّل يومية
            </span>
          )}
          {outstanding > 0n ? (
            <span className="rounded-lg bg-success-soft px-2.5 py-1 text-[10px] font-bold text-success">
              جاهز للقبض
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

export function IncomePage() {
  const { currency } = useWorkspace();
  const sourcesQuery = useIncomeSourcesQuery();
  const balancesQuery = useIncomeSourceBalancesQuery();
  const [query, setQuery] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");

  const sources = sourcesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const balanceMap = new Map(balances.map((b) => [b.sourceId, b]));

  const totals = useMemo(() => {
    return balances.reduce(
      (acc, b) => ({
        outstanding: acc.outstanding + b.balanceMinor,
        earned: acc.earned + b.earnedMinor,
        withdrawn: acc.withdrawn + b.withdrawnMinor,
        bonus: acc.bonus + b.bonusMinor,
        workDays: acc.workDays + b.workDays,
      }),
      {
        outstanding: 0n,
        earned: 0n,
        withdrawn: 0n,
        bonus: 0n,
        workDays: 0,
      },
    );
  }, [balances]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ar");
    const map = new Map(balances.map((b) => [b.sourceId, b]));
    return sources
      .filter((source) => {
        if (payFilter !== "all" && source.payKind !== payFilter) return false;
        if (!q) return true;
        return (
          source.name.toLocaleLowerCase("ar").includes(q) ||
          (source.place?.toLocaleLowerCase("ar").includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const aBal = map.get(a.id)?.balanceMinor ?? 0n;
        const bBal = map.get(b.id)?.balanceMinor ?? 0n;
        return aBal === bBal ? 0 : aBal > bBal ? -1 : 1;
      });
  }, [sources, balances, payFilter, query]);

  const money = { currency, locale: "en-US" as const };
  const filters: { value: PayFilter; label: string }[] = [
    { value: "all", label: "الكل" },
    { value: "daily", label: "يومي" },
    { value: "monthly", label: "شهري" },
    { value: "both", label: "مختلط" },
  ];

  if (sourcesQuery.isLoading || balancesQuery.isLoading) {
    return (
      <div className="page-enter px-4 sm:px-6" dir="rtl">
        <MoneySectionTabs active="income" />
        <PageHeader title="دخلي" subtitle="مصادر دخلك الشخصي" />
        <AppCard
          role="status"
          aria-label="جاري تحميل مصادر الدخل"
          className="h-44 animate-pulse rounded-[24px] bg-surface-subtle"
        />
      </div>
    );
  }

  if (sourcesQuery.isError || balancesQuery.isError) {
    const error = sourcesQuery.error ?? balancesQuery.error;
    return (
      <div className="page-enter px-4 sm:px-6" dir="rtl">
        <MoneySectionTabs active="income" />
        <PageHeader title="دخلي" subtitle="مصادر دخلك الشخصي" />
        <ErrorState
          message={getUserErrorMessage(error, "تعذر تحميل مصادر الدخل")}
          onRetry={() => {
            void sourcesQuery.refetch();
            void balancesQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="page-enter px-4 pb-6 sm:px-6" dir="rtl">
      <MoneySectionTabs active="income" />
      <PageHeader
        title="دخلي"
        subtitle="اليوميات والراتب والمستحقات"
        action={
          <Link
            to="/income/new"
            className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-on sm:text-sm"
          >
            <Plus aria-hidden="true" size={15} />
            مصدر جديد
          </Link>
        }
      />

      <section
        aria-label="ملخص الدخل"
        className="mb-4 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_14px_40px_rgb(27_30_60/7%)]"
      >
        <div className="relative overflow-hidden bg-[linear-gradient(150deg,rgb(16_185_129/14%),rgb(67_56_202/10%)_50%,rgb(99_102_241/6%))] px-5 py-5 sm:px-6">
          <div className="pointer-events-none absolute -start-10 top-0 size-40 rounded-full bg-success/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted">
                إجمالي المستحق للقبض
              </p>
              <p className="numeric mt-1.5 text-3xl font-black tracking-tight text-ink sm:text-[34px]" dir="ltr">
                {formatMinorAmount(totals.outstanding, money)}
                <span className="ms-1.5 text-sm font-bold text-muted">
                  {currency}
                </span>
              </p>
              <p className="mt-2 text-xs text-muted">
                {sources.length} مصدر · {totals.workDays} يوم عمل مسجّل
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-surface/85 text-success shadow-[0_8px_20px_rgb(27_30_60/8%)]">
              <Briefcase size={22} />
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-x-reverse divide-line border-t border-line">
          <div className="px-3 py-3.5 sm:px-4">
            <dt className="text-[10px] font-semibold text-muted">مكتسب</dt>
            <dd className="numeric mt-1 text-sm font-black text-ink" dir="ltr">
              {formatMinorAmount(totals.earned, money)}
            </dd>
          </div>
          <div className="px-3 py-3.5 sm:px-4">
            <dt className="text-[10px] font-semibold text-muted">مسحب</dt>
            <dd className="numeric mt-1 text-sm font-black text-warning" dir="ltr">
              {formatMinorAmount(totals.withdrawn, money)}
            </dd>
          </div>
          <div className="px-3 py-3.5 sm:px-4">
            <dt className="text-[10px] font-semibold text-muted">مكافآت</dt>
            <dd className="numeric mt-1 text-sm font-black text-success" dir="ltr">
              {formatMinorAmount(totals.bonus, money)}
            </dd>
          </div>
        </dl>
      </section>

      {sources.length > 0 ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Link
            to={sources[0] ? `/income/${sources[0].id}` : "/income/new"}
            className="pressable flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary-soft px-3 text-xs font-bold text-primary"
          >
            <CalendarDays size={15} />
            سجّل يومية سريعة
          </Link>
          <Link
            to={
              filtered.find(
                (s) => (balanceMap.get(s.id)?.balanceMinor ?? 0n) > 0n,
              )
                ? `/income/${filtered.find((s) => (balanceMap.get(s.id)?.balanceMinor ?? 0n) > 0n)!.id}`
                : "/income/new"
            }
            className="pressable flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-success/20 bg-success-soft px-3 text-xs font-bold text-success"
          >
            <Wallet size={15} />
            قبض إلى محفظة
          </Link>
        </div>
      ) : null}

      <label className="relative mb-3 block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 start-3.5 -translate-y-1/2 text-muted"
          size={16}
        />
        <input
          aria-label="بحث في مصادر الدخل"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو المكان…"
          className="min-h-12 w-full rounded-2xl border border-line bg-surface py-2 pe-4 ps-10 text-sm text-ink placeholder:text-muted"
        />
      </label>

      <nav
        aria-label="تصفية نوع الدخل"
        className="mb-5 grid grid-cols-4 gap-1 rounded-2xl border border-line/70 bg-surface-subtle/70 p-1"
      >
        {filters.map((filter) => {
          const active = filter.value === payFilter;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setPayFilter(filter.value)}
              aria-pressed={active}
              className={[
                "pressable flex min-h-10 items-center justify-center rounded-xl px-2 text-xs font-bold transition-colors",
                active
                  ? "bg-surface text-primary shadow-[0_4px_14px_rgb(27_30_60/6%)]"
                  : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {filter.label}
            </button>
          );
        })}
      </nav>

      {sources.length === 0 ? (
        <AppCard className="rounded-[24px] px-6 py-12 text-center">
          <Briefcase className="mx-auto text-muted" size={36} />
          <p className="mt-3 text-base font-bold text-ink">ابدأ مصدر دخلك</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            أضف وظيفة يومية أو راتبًا شهريًا، ثم سجّل اليوميات والمكافآت والقبض.
          </p>
          <Link
            to="/income/new"
            className="pressable mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-on"
          >
            <Plus size={14} />
            إضافة مصدر
          </Link>
        </AppCard>
      ) : filtered.length === 0 ? (
        <AppCard className="rounded-[20px] px-6 py-10 text-center">
          <p className="text-sm font-bold text-ink">لا نتائج مطابقة</p>
          <p className="mt-1 text-xs text-muted">غيّر البحث أو نوع الدخل</p>
        </AppCard>
      ) : (
        <ul className="space-y-3">
          {filtered.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              balance={balanceMap.get(source.id)}
              currency={currency}
              totalOutstanding={totals.outstanding}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
