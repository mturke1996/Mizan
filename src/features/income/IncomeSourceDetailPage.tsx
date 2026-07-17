import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase,
  CalendarDays,
  Gift,
  Minus,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  formatMajorInputAmount,
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  useArchiveIncomeSourceMutation,
  useIncomeEntriesQuery,
  useIncomeSourceBalancesQuery,
  useIncomeSourcesQuery,
  usePostIncomeEntryMutation,
  useUpdateIncomeSourceMutation,
  useWalletsQuery,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { IncomeEntryType } from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import {
  FieldShell,
  MoneyField,
  SelectField,
  TextField,
  TextareaField,
} from "@/shared/ui/form-field";
import { PageHeader } from "@/shared/ui/PageHeader";

type ActionType = IncomeEntryType | null;

const ENTRY_TYPE_LABELS: Record<IncomeEntryType, string> = {
  daily_wage: "يومية",
  bonus: "مكافأة",
  deduction: "خصم",
  salary_accrual: "استحقاق راتب",
  withdrawal: "قبض",
};

const ACTION_META: Record<
  Exclude<IncomeEntryType, never>,
  { label: string; hint: string }
> = {
  daily_wage: {
    label: "تسجيل يومية",
    hint: "اختر يوم العمل حتى لو كان سابقًا، ثم أكّد المبلغ.",
  },
  bonus: {
    label: "تسجيل مكافأة",
    hint: "أضف مكافأة مرتبطة بتاريخ الاستحقاق.",
  },
  deduction: {
    label: "تسجيل خصم",
    hint: "خصم من المستحقات بتاريخ محدد.",
  },
  salary_accrual: {
    label: "استحقاق راتب",
    hint: "سجّل استحقاق الراتب الشهري لتاريخ محدد.",
  },
  withdrawal: {
    label: "قبض إلى محفظة",
    hint: "حوّل المستحق إلى محفظة مع تاريخ القبض.",
  },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIsoDays(days: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatWorkDate(value: string | null | undefined): string {
  if (!value) return "بدون تاريخ";
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("ar-LY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function relativeDayLabel(iso: string): string | null {
  if (iso === todayIso()) return "اليوم";
  if (iso === shiftIsoDays(-1)) return "أمس";
  if (iso === shiftIsoDays(-2)) return "قبل أمس";
  return null;
}

export function IncomeSourceDetailPage() {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { currency, isDemo = false } = useWorkspace();
  const sourcesQuery = useIncomeSourcesQuery();
  const balancesQuery = useIncomeSourceBalancesQuery();
  const entriesQuery = useIncomeEntriesQuery(sourceId);
  const walletsQuery = useWalletsQuery();
  const postEntry = usePostIncomeEntryMutation(sourceId ?? "");
  const updateSource = useUpdateIncomeSourceMutation(sourceId ?? "");
  const archiveSource = useArchiveIncomeSourceMutation();

  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [walletId, setWalletId] = useState("");
  const [workDate, setWorkDate] = useState(todayIso);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPlace, setEditPlace] = useState("");
  const [metaBusy, setMetaBusy] = useState(false);

  const source = sourcesQuery.data?.find((s) => s.id === sourceId);
  const balance = balancesQuery.data?.find((b) => b.sourceId === sourceId);
  const entries = entriesQuery.data ?? [];
  const wallets = walletsQuery.data ?? [];
  const money = { currency, locale: "en-US" as const };
  const scale = getCurrencyScale(currency);
  const maxDate = todayIso();

  const dateChips = useMemo(
    () => [
      { label: "اليوم", value: todayIso() },
      { label: "أمس", value: shiftIsoDays(-1) },
      { label: "قبل أمس", value: shiftIsoDays(-2) },
      { label: "قبل أسبوع", value: shiftIsoDays(-7) },
    ],
    [],
  );

  if (sourcesQuery.isLoading || balancesQuery.isLoading) {
    return (
      <div className="page-enter px-4 sm:px-6" dir="rtl">
        <AppCard
          role="status"
          className="mt-6 h-56 animate-pulse rounded-[24px] bg-surface-subtle"
        />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="page-enter px-4 sm:px-6" dir="rtl">
        <PageHeader title="مصدر الدخل غير موجود" backTo="/income" />
      </div>
    );
  }

  const outstanding = balance?.balanceMinor ?? 0n;
  const showSalary = source.payKind === "monthly" || source.payKind === "both";
  const showDaily = source.payKind === "daily" || source.payKind === "both";

  const selectAction = (action: IncomeEntryType) => {
    setActiveAction(action);
    setFormError(null);
    setWorkDate(todayIso());
    setNote("");
    setWalletId("");
    if (action === "daily_wage" && source.dailyWageMinor) {
      setAmount(formatMajorInputAmount(source.dailyWageMinor, scale));
    } else if (action === "salary_accrual" && source.monthlySalaryMinor) {
      setAmount(formatMajorInputAmount(source.monthlySalaryMinor, scale));
    } else if (action === "withdrawal" && outstanding > 0n) {
      setAmount(formatMajorInputAmount(outstanding, scale));
    } else {
      setAmount("");
    }
  };

  const handleSubmitAction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeAction) return;
    setFormError(null);

    if (!workDate) {
      setFormError("اختر تاريخ الحركة");
      return;
    }
    if (workDate > maxDate) {
      setFormError("لا يمكن اختيار تاريخ في المستقبل");
      return;
    }

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

    try {
      await postEntry.mutateAsync({
        entryType: activeAction,
        amountMinor: effectiveMinor,
        workDate,
        walletId:
          activeAction === "withdrawal" && walletId ? walletId : undefined,
        note: note.trim() || undefined,
      });
      toast.success(`تم تسجيل ${ENTRY_TYPE_LABELS[activeAction]}`);
      setActiveAction(null);
      setAmount("");
      setNote("");
      setWalletId("");
      setWorkDate(todayIso());
    } catch (error) {
      setFormError(getUserErrorMessage(error, "تعذر تسجيل الحركة"));
    }
  };

  const openEditor = () => {
    setEditName(source.name);
    setEditPlace(source.place ?? "");
    setEditing(true);
  };

  const saveMeta = async () => {
    if (isDemo) {
      toast.message("تعديل مصادر الدخل متاح في الحساب المتصل");
      return;
    }
    const name = editName.trim();
    if (name.length < 2) {
      toast.error("اكتب اسمًا واضحًا للمصدر");
      return;
    }
    setMetaBusy(true);
    try {
      await updateSource.mutateAsync({
        name,
        place: editPlace.trim() || null,
      });
      setEditing(false);
      toast.success("تم تحديث مصدر الدخل");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر تحديث مصدر الدخل"));
    } finally {
      setMetaBusy(false);
    }
  };

  const handleArchive = async () => {
    if (isDemo) {
      toast.message("حذف مصادر الدخل متاح في الحساب المتصل");
      return;
    }
    const ok = await confirm({
      title: `حذف مصدر «${source.name}»؟`,
      description: "سيُخفى من القائمة مع الإبقاء على سجل الحركات.",
      tone: "danger",
      confirmLabel: "حذف المصدر",
    });
    if (!ok) return;
    setMetaBusy(true);
    try {
      await archiveSource.mutateAsync(source.id);
      toast.success("تم حذف مصدر الدخل");
      navigate("/income");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر حذف مصدر الدخل"));
    } finally {
      setMetaBusy(false);
    }
  };

  return (
    <div className="page-enter px-4 pb-8 sm:px-6" dir="rtl">
      <PageHeader
        title={source.name}
        subtitle={
          source.place
            ? `${source.place} · ${payKindLabel(source.payKind)}`
            : payKindLabel(source.payKind)
        }
        backTo="/income"
      />

      <section
        aria-label="ملخص المصدر"
        className="relative mb-5 overflow-hidden rounded-[26px] border border-line bg-surface shadow-[0_14px_40px_rgb(27_30_60/7%)]"
      >
        <div className="relative overflow-hidden bg-[linear-gradient(155deg,rgb(16_185_129/16%),rgb(67_56_202/10%)_55%,rgb(245_158_11/8%))] px-5 py-5 sm:px-6">
          <div className="pointer-events-none absolute -start-12 top-0 size-44 rounded-full bg-success/15 blur-3xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-muted">
                المستحق للقبض
              </p>
              <p
                className="numeric mt-1.5 text-3xl font-black tracking-tight text-ink sm:text-[36px]"
                dir="ltr"
              >
                {formatMinorAmount(outstanding, money)}
                <span className="ms-1.5 text-sm font-bold text-muted">
                  {currency}
                </span>
              </p>
              <p className="mt-2 text-xs text-muted">
                {balance?.workDays ?? 0} يوم عمل ·{" "}
                {formatMinorAmount(balance?.earnedMinor ?? 0n, money)} مكتسب
              </p>
            </div>
            <span className="grid size-12 place-items-center rounded-2xl bg-surface/85 text-success shadow-[0_8px_20px_rgb(27_30_60/8%)]">
              <Briefcase size={22} />
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-2 divide-x divide-x-reverse divide-line border-t border-line sm:grid-cols-4">
          <StatCell
            label="مكافآت"
            value={formatMinorAmount(balance?.bonusMinor ?? 0n, money)}
            tone="success"
          />
          <StatCell
            label="خصومات"
            value={formatMinorAmount(balance?.deductedMinor ?? 0n, money)}
            tone="danger"
          />
          <StatCell
            label="مسحوب"
            value={formatMinorAmount(balance?.withdrawnMinor ?? 0n, money)}
            tone="warning"
          />
          <StatCell
            label={showDaily ? "أجر يومي" : "راتب"}
            value={formatMinorAmount(
              showDaily
                ? (source.dailyWageMinor ?? 0n)
                : (source.monthlySalaryMinor ?? 0n),
              money,
            )}
          />
        </dl>
      </section>

      {editing ? (
        <AppCard className="mb-5 space-y-3 rounded-[22px] p-4 sm:p-5">
          <h3 className="text-sm font-bold text-ink">تعديل المصدر</h3>
          <TextField
            label="اسم المصدر"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
          />
          <TextField
            label="جهة / مكان العمل"
            value={editPlace}
            placeholder="مثال: ورشة النور"
            onChange={(event) => setEditPlace(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="pressable min-h-11 rounded-xl border border-line text-sm font-bold"
              disabled={metaBusy}
              onClick={() => setEditing(false)}
            >
              إلغاء
            </button>
            <button
              type="button"
              className="pressable min-h-11 rounded-xl bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={metaBusy || updateSource.isPending}
              onClick={() => void saveMeta()}
            >
              حفظ
            </button>
          </div>
        </AppCard>
      ) : (
        <div className="mb-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold text-ink"
            onClick={openEditor}
          >
            <Pencil aria-hidden="true" size={16} />
            تعديل المصدر
          </button>
          <button
            type="button"
            className="pressable flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-danger/30 bg-danger-soft text-sm font-bold text-danger"
            disabled={metaBusy || archiveSource.isPending}
            onClick={() => void handleArchive()}
          >
            <Trash2 aria-hidden="true" size={16} />
            حذف المصدر
          </button>
        </div>
      )}

      <AppCard className="mb-5 overflow-hidden rounded-[24px] p-0">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-base font-bold text-ink">تسجيل حركة</h2>
          <p className="mt-1 text-xs text-muted">
            اختر النوع، حدّد التاريخ (حتى الأيام السابقة)، ثم احفظ.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5">
          {showDaily ? (
            <ActionTile
              active={activeAction === "daily_wage"}
              onClick={() => selectAction("daily_wage")}
              icon={<CalendarDays size={16} />}
              label="يومية"
            />
          ) : null}
          <ActionTile
            active={activeAction === "bonus"}
            onClick={() => selectAction("bonus")}
            icon={<Gift size={16} />}
            label="مكافأة"
          />
          <ActionTile
            active={activeAction === "deduction"}
            onClick={() => selectAction("deduction")}
            icon={<Minus size={16} />}
            label="خصم"
          />
          {showSalary ? (
            <ActionTile
              active={activeAction === "salary_accrual"}
              onClick={() => selectAction("salary_accrual")}
              icon={<Briefcase size={16} />}
              label="راتب"
            />
          ) : null}
          <ActionTile
            active={activeAction === "withdrawal"}
            onClick={() => selectAction("withdrawal")}
            icon={<Wallet size={16} />}
            label="قبض"
          />
        </div>

        {activeAction ? (
          <form
            onSubmit={(event) => void handleSubmitAction(event)}
            className="space-y-4 border-t border-line bg-surface-subtle/40 px-4 py-5 sm:px-5"
          >
            <div>
              <p className="text-sm font-bold text-ink">
                {ACTION_META[activeAction].label}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {ACTION_META[activeAction].hint}
              </p>
            </div>

            <FieldShell
              label="تاريخ الحركة"
              helperText={
                relativeDayLabel(workDate)
                  ? `محدد: ${relativeDayLabel(workDate)} · ${formatWorkDate(workDate)}`
                  : formatWorkDate(workDate)
              }
              required
            >
              <input
                type="date"
                aria-label="تاريخ الحركة"
                max={maxDate}
                value={workDate}
                onChange={(event) => setWorkDate(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-control-border bg-surface px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </FieldShell>

            <div className="flex flex-wrap gap-1.5">
              {dateChips.map((chip) => {
                const active = workDate === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setWorkDate(chip.value)}
                    className={[
                      "pressable rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors",
                      active
                        ? "bg-primary text-primary-on"
                        : "bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink",
                    ].join(" ")}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <MoneyField
              label="المبلغ"
              currency={currency}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={
                activeAction === "daily_wage" && source.dailyWageMinor
                  ? `الافتراضي ${formatMinorAmount(source.dailyWageMinor, money)}`
                  : "0.000"
              }
              helperText={
                activeAction === "daily_wage" && source.dailyWageMinor
                  ? "اتركه فارغًا لاستخدام الأجر اليومي الافتراضي"
                  : undefined
              }
            />

            {activeAction === "withdrawal" ? (
              <SelectField
                label="محفظة القبض"
                required
                value={walletId}
                onChange={(event) => setWalletId(event.target.value)}
              >
                <option value="">اختر المحفظة</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </SelectField>
            ) : null}

            <TextareaField
              label="ملاحظة"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="اختياري — تفاصيل اليوم أو سبب الحركة"
            />

            {formError ? (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                {formError}
              </p>
            ) : null}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="submit"
                disabled={postEntry.isPending}
                className="pressable min-h-12 rounded-xl bg-primary text-sm font-bold text-primary-on disabled:opacity-50"
              >
                {postEntry.isPending
                  ? "جارٍ التسجيل…"
                  : `حفظ · ${formatWorkDate(workDate)}`}
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveAction(null);
                  setFormError(null);
                }}
                className="pressable min-h-12 rounded-xl border border-line bg-surface px-5 text-sm font-bold text-muted"
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : null}
      </AppCard>

      <section aria-labelledby="income-ledger-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="income-ledger-title" className="text-base font-bold text-ink">
              سجل الحركات
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              مرتّب من الأحدث — يشمل الأيام السابقة المسجّلة
            </p>
          </div>
          <span className="numeric rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-bold text-muted">
            {entries.length}
          </span>
        </div>

        {entriesQuery.isLoading ? (
          <AppCard className="h-28 animate-pulse rounded-[22px] bg-surface-subtle" />
        ) : entries.length === 0 ? (
          <AppCard className="rounded-[22px] px-6 py-10 text-center">
            <CalendarDays className="mx-auto text-muted" size={28} />
            <p className="mt-3 text-sm font-bold text-ink">لا حركات بعد</p>
            <p className="mt-1 text-xs text-muted">
              سجّل أول يومية أو قبض لتبدأ المتابعة
            </p>
          </AppCard>
        ) : (
          <ul className="overflow-hidden rounded-[22px] border border-line bg-surface divide-y divide-line">
            {entries.map((entry) => {
              const negative =
                entry.entryType === "deduction" ||
                entry.entryType === "withdrawal";
              const dayHint = relativeDayLabel(entry.workDate ?? "");
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-ink">
                        {ENTRY_TYPE_LABELS[entry.entryType]}
                      </p>
                      {dayHint ? (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                          {dayHint}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {formatWorkDate(entry.workDate)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  </div>
                  <span
                    className={[
                      "numeric shrink-0 text-sm font-black",
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
      </section>
    </div>
  );
}

function payKindLabel(payKind: "daily" | "monthly" | "both") {
  if (payKind === "daily") return "أجر يومي";
  if (payKind === "monthly") return "راتب شهري";
  return "يومي + شهري";
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : "text-ink";
  return (
    <div className="px-3 py-3.5 sm:px-4">
      <dt className="text-[10px] font-semibold text-muted">{label}</dt>
      <dd className={`numeric mt-1 text-sm font-black ${toneClass}`} dir="ltr">
        {value}
      </dd>
    </div>
  );
}

function ActionTile({
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
        "pressable flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-2xl border text-xs font-bold transition-colors",
        active
          ? "border-primary bg-primary text-primary-on shadow-[0_8px_20px_rgb(67_56_202/18%)]"
          : "border-line bg-surface text-muted hover:border-primary/30 hover:bg-primary-soft hover:text-primary",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
