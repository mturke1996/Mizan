import { useState } from "react";
import { useParams } from "react-router-dom";
import { Briefcase, Calendar, Gift, Minus, Wallet } from "lucide-react";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  useIncomeEntriesQuery,
  useIncomeSourceBalancesQuery,
  useIncomeSourcesQuery,
  usePostIncomeEntryMutation,
  useWalletsQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { IncomeEntryType } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

type ActionType = IncomeEntryType | null;

const ENTRY_TYPE_LABELS: Record<IncomeEntryType, string> = {
  daily_wage: "يومية",
  bonus: "مكافأة",
  deduction: "خصم",
  salary_accrual: "استحقاق راتب",
  withdrawal: "قبض",
};

export function IncomeSourceDetailPage() {
  const { sourceId } = useParams();
  const { currency } = useWorkspace();
  const sourcesQuery = useIncomeSourcesQuery();
  const balancesQuery = useIncomeSourceBalancesQuery();
  const entriesQuery = useIncomeEntriesQuery(sourceId);
  const walletsQuery = useWalletsQuery();
  const postEntry = usePostIncomeEntryMutation(sourceId ?? "");

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [walletId, setWalletId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const source = sourcesQuery.data?.find((s) => s.id === sourceId);
  const balance = balancesQuery.data?.find((b) => b.sourceId === sourceId);
  const entries = entriesQuery.data ?? [];
  const wallets = walletsQuery.data ?? [];
  const money = { currency, locale: "en-US" as const };
  const scale = getCurrencyScale(currency);

  if (sourcesQuery.isLoading || balancesQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <AppCard
          role="status"
          className="mt-6 h-48 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="مصدر الدخل غير موجود" backTo="/income" />
      </div>
    );
  }

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAction) return;
    setFormError(null);

    let effectiveMinor = 0;
    const trimmed = amount.trim();

    if (activeAction === "daily_wage" && !trimmed && source.dailyWageMinor) {
      effectiveMinor = toSafeMinorNumber(source.dailyWageMinor);
    } else {
      try {
        const parsed = parseMajorAmount(trimmed || "0", scale);
        if (parsed <= 0n) {
          setFormError("أدخل مبلغًا أكبر من صفر");
          return;
        }
        effectiveMinor = toSafeMinorNumber(parsed);
      } catch (error) {
        setFormError(
          error instanceof Error ? error.message : "أدخل مبلغًا صحيحًا",
        );
        return;
      }
    }

    if (activeAction === "withdrawal" && !walletId) {
      setFormError("اختر محفظة للقبض");
      return;
    }

    await postEntry.mutateAsync({
      entryType: activeAction,
      amountMinor: effectiveMinor,
      walletId: activeAction === "withdrawal" && walletId ? walletId : undefined,
      note: note.trim() || undefined,
    });
    setActiveAction(null);
    setAmount("");
    setNote("");
    setWalletId("");
  };

  const outstanding = balance?.balanceMinor ?? 0n;
  const showSalary = source.payKind === "monthly" || source.payKind === "both";
  const showDaily = source.payKind === "daily" || source.payKind === "both";

  return (
    <div className="px-4 sm:px-6 pb-6" dir="rtl">
      <PageHeader
        title={source.name}
        subtitle={source.place || payKindLabel(source.payKind)}
        backTo="/income"
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="مستحق" value={formatMinorAmount(outstanding, money)} tone="success" />
        <StatCard label="أيام عمل" value={String(balance?.workDays ?? 0)} />
        <StatCard
          label="مكافآت"
          value={formatMinorAmount(balance?.bonusMinor ?? 0n, money)}
          tone="info"
        />
        <StatCard
          label="خصومات"
          value={formatMinorAmount(balance?.deductedMinor ?? 0n, money)}
          tone="danger"
        />
        <StatCard
          label="مسحوب"
          value={formatMinorAmount(balance?.withdrawnMinor ?? 0n, money)}
          tone="warning"
        />
        {source.monthlySalaryMinor ? (
          <StatCard
            label="راتب شهري"
            value={formatMinorAmount(source.monthlySalaryMinor, money)}
          />
        ) : null}
      </div>

      <AppCard className="mb-5 rounded-[18px] p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">تسجيل حركة</h3>
        <div className="flex flex-wrap gap-2">
          {showDaily ? (
            <ActionButton
              active={activeAction === "daily_wage"}
              onClick={() => setActiveAction("daily_wage")}
              icon={<Calendar size={13} />}
              label="سجل يومية"
            />
          ) : null}
          <ActionButton
            active={activeAction === "bonus"}
            onClick={() => setActiveAction("bonus")}
            icon={<Gift size={13} />}
            label="مكافأة"
          />
          <ActionButton
            active={activeAction === "deduction"}
            onClick={() => setActiveAction("deduction")}
            icon={<Minus size={13} />}
            label="خصم"
          />
          {showSalary ? (
            <ActionButton
              active={activeAction === "salary_accrual"}
              onClick={() => {
                setActiveAction("salary_accrual");
                if (source.monthlySalaryMinor) {
                  setAmount(
                    formatMinorAmount(source.monthlySalaryMinor, {
                      currency,
                      locale: "en-US",
                      fractionDigits: scale,
                    }).replace(/,/g, ""),
                  );
                }
              }}
              icon={<Briefcase size={13} />}
              label="استحقاق راتب"
            />
          ) : null}
          <ActionButton
            active={activeAction === "withdrawal"}
            onClick={() => setActiveAction("withdrawal")}
            icon={<Wallet size={13} />}
            label="قبض إلى محفظة"
          />
        </div>

        {activeAction ? (
          <form onSubmit={handleSubmitAction} className="mt-4 space-y-3">
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={
                activeAction === "daily_wage" && source.dailyWageMinor
                  ? `الافتراضي: ${formatMinorAmount(source.dailyWageMinor, money)}`
                  : "المبلغ"
              }
              className="numeric w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted"
            />
            {activeAction === "withdrawal" && wallets.length > 0 ? (
              <select
                value={walletId}
                onChange={(e) => setWalletId(e.target.value)}
                required
                className="w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink"
              >
                <option value="">اختر المحفظة</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                activeAction === "withdrawal"
                  ? "سبب القبض (اختياري)"
                  : "ملاحظة (اختياري)"
              }
              className="w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={postEntry.isPending}
                className="pressable flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-on disabled:opacity-50"
              >
                {postEntry.isPending ? "جاري..." : "تسجيل"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAction(null);
                  setFormError(null);
                }}
                className="rounded-xl bg-surface-subtle px-4 py-2.5 text-sm font-medium text-muted"
              >
                إلغاء
              </button>
            </div>
            {formError || postEntry.isError ? (
              <p className="text-xs text-danger">
                {formError ||
                  (postEntry.error instanceof Error
                    ? postEntry.error.message
                    : "حدث خطأ")}
              </p>
            ) : null}
          </form>
        ) : null}
      </AppCard>

      <AppCard className="rounded-[18px] p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">سجل الحركات</h3>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">لا توجد حركات بعد</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((entry) => {
              const negative =
                entry.entryType === "deduction" ||
                entry.entryType === "withdrawal";
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {ENTRY_TYPE_LABELS[entry.entryType]}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {entry.workDate}
                      {entry.note ? ` — ${entry.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={[
                      "numeric shrink-0 text-sm font-bold",
                      negative ? "text-danger" : "text-success",
                    ].join(" ")}
                    dir="ltr"
                  >
                    {negative ? "-" : "+"}
                    {formatMinorAmount(entry.amountMinor, money)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </AppCard>
    </div>
  );
}

function payKindLabel(payKind: "daily" | "monthly" | "both") {
  if (payKind === "daily") return "يومي";
  if (payKind === "monthly") return "شهري";
  return "يومي + شهري";
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : tone === "info"
            ? "text-info"
            : "text-ink";

  return (
    <div className="rounded-[14px] border border-line bg-surface p-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className={`numeric mt-0.5 text-base font-black ${toneClass}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-on"
          : "bg-surface-subtle text-muted hover:bg-primary-soft hover:text-primary",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
