import { Landmark, Pencil, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ProjectAnalyticsSnapshot } from "@/domain/analytics/compute-project-analytics";
import {
  formatMajorInputAmount,
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useProjectStore } from "@/features/projects/project-store";
import {
  useCapitalEntriesQuery,
  usePostCapitalEntryMutation,
} from "@/features/workspace/use-finance-data";
import type {
  CapitalEntry,
  CapitalEntryType,
} from "@/features/workspace/workspace-types";
import { formatPlainDateAr, getDateKeyInTimeZone } from "@/lib/date";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { formatProjectPercent } from "./project-detail-config";

const EMPTY_CAPITAL_ENTRIES: CapitalEntry[] = [];

const ENTRY_LABELS: Readonly<Record<CapitalEntryType, string>> = {
  opening: "افتتاحي",
  contribution: "مساهمة",
  withdrawal: "سحب",
  adjustment: "تسوية",
};

interface ProjectCapitalTabProps {
  analytics: ProjectAnalyticsSnapshot;
  currency: string;
  isDemo: boolean;
  projectId: string;
  timeZone: string;
}

function CapitalLedger({
  currency,
  entries,
}: {
  currency: string;
  entries: CapitalEntry[];
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        description="سجّل رأس المال الافتتاحي أو أي مساهمة لاحقة لبناء نسبة الاسترداد."
        icon={<Landmark aria-hidden="true" size={22} />}
        title="لا توجد حركات رأس مال"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        const isOutflow = entry.entryType === "withdrawal";
        return (
          <li
            className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-3 text-sm"
            key={entry.id}
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                {ENTRY_LABELS[entry.entryType]}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {formatPlainDateAr(entry.occurredOn)}
                {entry.note ? ` · ${entry.note}` : ""}
              </p>
            </div>
            <bdi
              className={`numeric shrink-0 font-bold ${
                isOutflow ? "text-danger" : "text-success"
              }`}
              dir="ltr"
            >
              {formatMinorAmount(entry.amountMinor, {
                currency: entry.currencyCode || currency,
                locale: "en-US",
              })}
            </bdi>
          </li>
        );
      })}
    </ul>
  );
}

function CapitalEditPanel({
  capitalMinor,
  currency,
  disabled,
  onSave,
}: {
  capitalMinor: bigint;
  currency: string;
  disabled?: boolean;
  onSave: (targetMinor: bigint) => Promise<void> | void;
}) {
  const scale = getCurrencyScale(currency);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(() =>
    formatMajorInputAmount(capitalMinor, scale),
  );
  const [busy, setBusy] = useState(false);

  const openEditor = () => {
    setAmount(formatMajorInputAmount(capitalMinor, scale));
    setEditing(true);
  };

  const submit = async () => {
    if (busy || disabled) return;
    let targetMinor: bigint;
    try {
      targetMinor = parseMajorAmount(amount || "0", scale);
    } catch {
      toast.error("أدخل رأس مال صحيحًا");
      return;
    }
    if (targetMinor < 0n) {
      toast.error("لا يمكن أن يكون رأس المال سالبًا");
      return;
    }
    if (targetMinor === capitalMinor) {
      setEditing(false);
      toast.message("رأس المال لم يتغير");
      return;
    }

    setBusy(true);
    try {
      await onSave(targetMinor);
      setEditing(false);
      toast.success("تم تعديل رأس المال");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر تعديل رأس المال"));
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        className="pressable flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-subtle"
        onClick={openEditor}
        type="button"
      >
        <Pencil aria-hidden="true" size={16} />
        تعديل رأس المال
      </button>
    );
  }

  return (
    <AppCard className="space-y-3 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
        <Pencil aria-hidden="true" size={16} />
        تعديل رأس المال
      </h3>
      <p className="text-xs leading-5 text-muted">
        أدخل صافي رأس المال المطلوب. سيتم تسجيل الفرق كتسوية.
      </p>
      <input
        aria-label={`رأس المال المستهدف بعملة ${currency}`}
        className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
        dir="ltr"
        inputMode="decimal"
        onChange={(event) => setAmount(event.target.value)}
        placeholder="رأس المال الجديد"
        value={amount}
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          className="pressable flex min-h-11 items-center justify-center rounded-sm border border-line bg-surface text-sm font-bold text-ink"
          disabled={busy}
          onClick={() => setEditing(false)}
          type="button"
        >
          إلغاء
        </button>
        <button
          className="pressable flex min-h-11 items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
          disabled={busy || disabled}
          onClick={() => void submit()}
          type="button"
        >
          {busy ? "جارٍ الحفظ…" : "حفظ التعديل"}
        </button>
      </div>
    </AppCard>
  );
}

function LiveProjectCapitalTab({
  analytics,
  currency,
  projectId,
  timeZone,
}: Omit<ProjectCapitalTabProps, "isDemo">) {
  const entriesQuery = useCapitalEntriesQuery(projectId);
  const postEntry = usePostCapitalEntryMutation(projectId);
  const [entryType, setEntryType] = useState<CapitalEntryType>("contribution");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState(() =>
    getDateKeyInTimeZone(new Date(), timeZone),
  );
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);
  const scale = getCurrencyScale(currency);
  const entries = entriesQuery.data ?? [];
  const capitalMinor = analytics.capitalMinor ?? 0n;

  const submit = async () => {
    if (submitLock.current || busy || postEntry.isPending) return;
    let amountMinor: bigint;
    try {
      amountMinor = parseMajorAmount(amount, scale);
    } catch {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر");
      return;
    }
    if (amountMinor <= 0n) {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر");
      return;
    }

    submitLock.current = true;
    setBusy(true);
    const clientId = crypto.randomUUID();
    try {
      await postEntry.mutateAsync({
        entryType,
        amountMinor: toSafeMinorNumber(
          entryType === "withdrawal" ? -amountMinor : amountMinor,
        ),
        currencyCode: currency,
        note: note.trim() || undefined,
        occurredOn,
        clientId,
      });
      setAmount("");
      setNote("");
      toast.success("تم تسجيل حركة رأس المال");
    } catch (error) {
      toast.error(
        getUserErrorMessage(error, "تعذر تسجيل حركة رأس المال"),
      );
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  const saveCapitalTarget = async (targetMinor: bigint) => {
    const delta = targetMinor - capitalMinor;
    if (delta === 0n) return;
    await postEntry.mutateAsync({
      entryType: "adjustment",
      amountMinor: toSafeMinorNumber(delta),
      currencyCode: currency,
      note: "تعديل رأس المال",
      occurredOn: getDateKeyInTimeZone(new Date(), timeZone),
      clientId: crypto.randomUUID(),
    });
  };

  if (entriesQuery.isLoading) {
    return (
      <AppCard
        aria-label="جاري تحميل حركات رأس المال"
        className="h-64 animate-pulse bg-surface-subtle motion-reduce:animate-none"
        role="status"
      />
    );
  }

  if (entriesQuery.isError) {
    return (
      <ErrorState
        message={
          entriesQuery.error instanceof Error
            ? entriesQuery.error.message
            : "تعذر تحميل حركات رأس المال"
        }
        onRetry={() => void entriesQuery.refetch()}
        title="تعذر تحميل رأس المال"
      />
    );
  }

  return (
    <section aria-labelledby="project-capital-title" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink" id="project-capital-title">
          رأس المال
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          سجّل المساهمات والسحوبات لمعرفة نسبة الاسترداد بدقة.
        </p>
      </div>

      <AppCard className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="text-xs font-semibold text-muted">صافي رأس المال</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-ink"
            dir="ltr"
          >
            {formatMinorAmount(capitalMinor, {
              currency,
              locale: "en-US",
            })}
          </bdi>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">نسبة الاسترداد</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-primary-ink"
            dir="ltr"
          >
            {formatProjectPercent(analytics.capitalRecoveredRate)}
          </bdi>
          <p className="mt-2 text-xs leading-5 text-muted">
            محسوب من ربح المشروع بعد مستحقات العمال عند تفعيل وحدتهم.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">
            عائد رأس المال (ROI)
          </p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-ink"
            dir="ltr"
          >
            {formatProjectPercent(analytics.returnOnCapitalRate)}
          </bdi>
          <p className="mt-2 text-xs leading-5 text-muted">
            الربح بعد العمال ÷ رأس المال × 100.
          </p>
        </div>
      </AppCard>

      <CapitalEditPanel
        capitalMinor={capitalMinor}
        currency={currency}
        disabled={postEntry.isPending}
        onSave={saveCapitalTarget}
      />

      <AppCard className="space-y-3 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Plus aria-hidden="true" size={16} />
          حركة جديدة
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["contribution", "مساهمة"],
              ["withdrawal", "سحب"],
              ["adjustment", "تسوية"],
              ["opening", "افتتاحي"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={entryType === value}
              className={`pressable min-h-11 rounded-sm border px-3 text-sm font-bold ${
                entryType === value
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-line bg-surface text-ink hover:bg-surface-subtle"
              }`}
              key={value}
              onClick={() => setEntryType(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label={`مبلغ رأس المال بعملة ${currency}`}
          className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
          dir="ltr"
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="المبلغ"
          value={amount}
        />
        <input
          aria-label="تاريخ الحركة"
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
          onChange={(event) => setOccurredOn(event.target.value)}
          type="date"
          value={occurredOn}
        />
        <input
          aria-label="ملاحظة اختيارية"
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="ملاحظة اختيارية"
          value={note}
        />
        <button
          className="pressable flex min-h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
          disabled={busy || postEntry.isPending}
          onClick={() => void submit()}
          type="button"
        >
          {busy ? "جارٍ الحفظ…" : "حفظ الحركة"}
        </button>
      </AppCard>

      <div>
        <h3 className="mb-3 text-sm font-bold text-ink">سجل الحركات</h3>
        <CapitalLedger currency={currency} entries={entries} />
      </div>
    </section>
  );
}

function DemoProjectCapitalTab({
  analytics,
  currency,
  projectId,
  timeZone,
}: Omit<ProjectCapitalTabProps, "isDemo">) {
  const entries = useProjectStore(
    (state) => state.capitalByProject[projectId] ?? EMPTY_CAPITAL_ENTRIES,
  );
  const postCapitalEntry = useProjectStore((state) => state.postCapitalEntry);
  const [entryType, setEntryType] = useState<CapitalEntryType>("contribution");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [occurredOn, setOccurredOn] = useState(() =>
    getDateKeyInTimeZone(new Date(), timeZone),
  );
  const [busy, setBusy] = useState(false);
  const scale = getCurrencyScale(currency);
  const capitalMinor = analytics.capitalMinor ?? 0n;

  const submit = () => {
    if (busy) return;
    let amountMinor: bigint;
    try {
      amountMinor = parseMajorAmount(amount, scale);
    } catch {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر");
      return;
    }
    if (amountMinor <= 0n) {
      toast.error("أدخل مبلغًا صحيحًا أكبر من صفر");
      return;
    }

    setBusy(true);
    try {
      postCapitalEntry({
        projectId,
        entryType,
        amountMinor:
          entryType === "withdrawal" ? -amountMinor : amountMinor,
        currencyCode: currency,
        note: note.trim() || undefined,
        occurredOn,
        clientId: crypto.randomUUID(),
      });
      setAmount("");
      setNote("");
      toast.success("تم تسجيل حركة رأس المال");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر تسجيل حركة رأس المال",
      );
    } finally {
      setBusy(false);
    }
  };

  const saveCapitalTarget = (targetMinor: bigint) => {
    const delta = targetMinor - capitalMinor;
    if (delta === 0n) return;
    postCapitalEntry({
      projectId,
      entryType: "adjustment",
      amountMinor: delta,
      currencyCode: currency,
      note: "تعديل رأس المال",
      occurredOn: getDateKeyInTimeZone(new Date(), timeZone),
      clientId: crypto.randomUUID(),
    });
  };

  return (
    <section aria-labelledby="project-capital-title" className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink" id="project-capital-title">
          رأس المال
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          يمكنك تجربة تسجيل الحركات محليًا في الوضع التجريبي.
        </p>
      </div>

      <AppCard className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
        <div>
          <p className="text-xs font-semibold text-muted">صافي رأس المال</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-ink"
            dir="ltr"
          >
            {formatMinorAmount(capitalMinor, {
              currency,
              locale: "en-US",
            })}
          </bdi>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">نسبة الاسترداد</p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-primary-ink"
            dir="ltr"
          >
            {formatProjectPercent(analytics.capitalRecoveredRate)}
          </bdi>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">
            عائد رأس المال (ROI)
          </p>
          <bdi
            className="numeric mt-2 block text-2xl font-bold text-ink"
            dir="ltr"
          >
            {formatProjectPercent(analytics.returnOnCapitalRate)}
          </bdi>
        </div>
      </AppCard>

      <CapitalEditPanel
        capitalMinor={capitalMinor}
        currency={currency}
        onSave={saveCapitalTarget}
      />

      <AppCard className="space-y-3 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Plus aria-hidden="true" size={16} />
          حركة جديدة
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["contribution", "مساهمة"],
              ["withdrawal", "سحب"],
              ["adjustment", "تسوية"],
              ["opening", "افتتاحي"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={entryType === value}
              className={`pressable min-h-11 rounded-sm border px-3 text-sm font-bold ${
                entryType === value
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-line bg-surface text-ink hover:bg-surface-subtle"
              }`}
              key={value}
              onClick={() => setEntryType(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label={`مبلغ رأس المال بعملة ${currency}`}
          className="numeric min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-left text-sm"
          dir="ltr"
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="المبلغ"
          value={amount}
        />
        <input
          aria-label="تاريخ الحركة"
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
          onChange={(event) => setOccurredOn(event.target.value)}
          type="date"
          value={occurredOn}
        />
        <input
          aria-label="ملاحظة اختيارية"
          className="min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm"
          maxLength={200}
          onChange={(event) => setNote(event.target.value)}
          placeholder="ملاحظة اختيارية"
          value={note}
        />
        <button
          className="pressable flex min-h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
          disabled={busy}
          onClick={submit}
          type="button"
        >
          {busy ? "جارٍ الحفظ…" : "حفظ الحركة"}
        </button>
      </AppCard>

      <div>
        <h3 className="mb-3 text-sm font-bold text-ink">سجل الحركات</h3>
        <CapitalLedger currency={currency} entries={entries} />
      </div>
    </section>
  );
}

export function ProjectCapitalTab({
  analytics,
  currency,
  isDemo,
  projectId,
  timeZone,
}: ProjectCapitalTabProps) {
  if (isDemo) {
    return (
      <DemoProjectCapitalTab
        analytics={analytics}
        currency={currency}
        projectId={projectId}
        timeZone={timeZone}
      />
    );
  }

  return (
    <LiveProjectCapitalTab
      analytics={analytics}
      currency={currency}
      projectId={projectId}
      timeZone={timeZone}
    />
  );
}
