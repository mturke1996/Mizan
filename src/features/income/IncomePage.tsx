import { Briefcase, Plus } from "lucide-react";
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

function payKindLabel(payKind: IncomeSource["payKind"]) {
  if (payKind === "daily") return "يومي";
  if (payKind === "monthly") return "شهري";
  return "يومي + شهري";
}

function SourceCard({
  source,
  balance,
  currency,
}: {
  source: IncomeSource;
  balance: IncomeSourceBalance | undefined;
  currency: string;
}) {
  const outstanding = balance?.balanceMinor ?? 0n;
  const money = { currency, locale: "en-US" as const };

  return (
    <Link
      to={`/income/${source.id}`}
      className="block rounded-[18px] border border-line bg-surface p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Briefcase aria-hidden="true" size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-ink">{source.name}</h3>
              {source.place ? (
                <p className="mt-0.5 truncate text-xs text-muted">{source.place}</p>
              ) : null}
            </div>
          </div>
          <p className="mt-3 text-[11px] font-semibold text-muted">
            {payKindLabel(source.payKind)}
          </p>
        </div>
        <div className="text-left">
          <p className="text-[10px] text-muted">مستحق</p>
          <p
            className={[
              "numeric mt-0.5 text-base font-black",
              outstanding > 0n ? "text-success" : "text-ink",
            ].join(" ")}
            dir="ltr"
          >
            {formatMinorAmount(outstanding, money)}
          </p>
        </div>
      </div>
      {balance ? (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>{balance.workDays} يوم</span>
          {balance.bonusMinor > 0n ? (
            <span className="text-success">
              +{formatMinorAmount(balance.bonusMinor, money)} مكافآت
            </span>
          ) : null}
          {balance.deductedMinor > 0n ? (
            <span className="text-danger">
              -{formatMinorAmount(balance.deductedMinor, money)} خصومات
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

export function IncomePage() {
  const { currency } = useWorkspace();
  const sourcesQuery = useIncomeSourcesQuery();
  const balancesQuery = useIncomeSourceBalancesQuery();

  const sources = sourcesQuery.data ?? [];
  const balances = balancesQuery.data ?? [];
  const balanceMap = new Map(balances.map((b) => [b.sourceId, b]));
  const totalOutstanding = balances.reduce((sum, b) => sum + b.balanceMinor, 0n);
  const money = { currency, locale: "en-US" as const };

  if (sourcesQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <MoneySectionTabs active="income" />
        <PageHeader title="دخلي" subtitle="مصادر دخلك الشخصي" />
        <AppCard
          role="status"
          aria-label="جاري تحميل مصادر الدخل"
          className="h-40 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <MoneySectionTabs active="income" />
      <PageHeader
        title="دخلي"
        subtitle="تتبّع اليوميات والراتب والمستحقات"
        action={
          <Link
            to="/income/new"
            className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
          >
            <Plus aria-hidden="true" size={14} />
            مصدر جديد
          </Link>
        }
      />

      <AppCard className="mb-5 overflow-hidden rounded-[18px] p-0">
        <div className="flex items-center justify-between gap-4 bg-[linear-gradient(135deg,rgb(67_56_202/12%),rgb(99_102_241/4%))] px-5 py-5">
          <div>
            <p className="text-xs font-semibold text-muted">إجمالي المستحق</p>
            <p className="numeric mt-1 text-2xl font-black text-ink" dir="ltr">
              {formatMinorAmount(totalOutstanding, money)}
              <span className="ms-1 text-sm font-bold text-muted">{currency}</span>
            </p>
          </div>
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-on">
            <Briefcase aria-hidden="true" size={22} />
          </span>
        </div>
      </AppCard>

      {sources.length === 0 ? (
        <AppCard className="px-6 py-12 text-center">
          <Briefcase className="mx-auto text-muted" size={36} />
          <p className="mt-3 text-sm font-semibold text-ink">لا توجد مصادر دخل</p>
          <p className="mt-1 text-xs text-muted">
            أضف وظيفة أو عملًا يوميًا لبدء تتبّع مستحقاتك
          </p>
          <Link
            to="/income/new"
            className="pressable mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-on"
          >
            <Plus size={14} />
            إضافة مصدر
          </Link>
        </AppCard>
      ) : (
        <div className="space-y-3 pb-4">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              balance={balanceMap.get(source.id)}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}
