import { clsx } from "clsx";
import {
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  MinusCircle,
  Pencil,
  Plus,
  SlidersHorizontal,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Wallet } from "@/domain/finance/finance-state";
import {
  formatMajorInputAmount,
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useProjectStore } from "@/features/projects/project-store";
import {
  useCreateWorkerMutation,
  usePostWageMovementMutation,
  useRecordDailyWorkMutation,
  useUpdateWorkerMutation,
  useWorkersQuery,
  useWorkLogsQuery,
} from "@/features/workspace/use-finance-data";
import type {
  WorkerBalance,
  WorkLogEntry,
} from "@/features/workspace/workspace-types";
import { formatPlainDateAr, getDateKeyInTimeZone } from "@/lib/date";
import { AppCard } from "@/shared/ui/AppCard";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import {
  MoneyField,
  SelectField,
  TextareaField,
  TextField,
} from "@/shared/ui/form-field";
import { useConfirm } from "@/shared/ui/confirm-dialog";

type MovementType =
  | "daily"
  | "withdrawal"
  | "deduction"
  | "bonus"
  | "adjustment";

interface ProjectWorkersTabProps {
  currency: string;
  isDemo: boolean;
  projectId: string;
  timeZone: string;
  wallets: Wallet[];
}

const movementOptions = [
  ["daily", "يومية", Banknote],
  ["withdrawal", "سحب", ArrowUpRight],
  ["deduction", "خصم", MinusCircle],
  ["bonus", "مكافأة", Plus],
  ["adjustment", "تعديل", SlidersHorizontal],
] as const;

const entryLabels: Record<WorkLogEntry["entryType"], string> = {
  daily_wage: "يومية",
  bonus: "مكافأة",
  deduction: "خصم",
  withdrawal: "سحب",
  adjustment: "تعديل",
};

const weekdayLabels = ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"];

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    throw new Error("شهر غير صالح");
  }
  return { year, month };
}

function shiftMonth(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelAr(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function daysInMonth(monthKey: string): string[] {
  const { year, month } = parseMonthKey(monthKey);
  const total = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: total }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${monthKey}-${day}`;
  });
}

function monthStartWeekday(monthKey: string): number {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function WorkerBalances({
  currency,
  editingWorkerId,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  editName,
  editPhone,
  editWage,
  editStatus,
  onEditNameChange,
  onEditPhoneChange,
  onEditWageChange,
  onEditStatusChange,
  busy,
  workers,
}: {
  currency: string;
  editingWorkerId: string;
  onEdit: (worker: WorkerBalance) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  editName: string;
  editPhone: string;
  editWage: string;
  editStatus: "active" | "inactive";
  onEditNameChange: (value: string) => void;
  onEditPhoneChange: (value: string) => void;
  onEditWageChange: (value: string) => void;
  onEditStatusChange: (value: "active" | "inactive") => void;
  busy: boolean;
  workers: WorkerBalance[];
}) {
  if (workers.length === 0) {
    return (
      <EmptyState
        className="mb-3"
        description="أضف العامل وأجره اليومي، ثم ابدأ تسجيل أيام العمل والحركات."
        icon={<Users aria-hidden="true" size={22} />}
        title="لا يوجد عمال مسجّلون"
      />
    );
  }

  return (
    <div className="mb-3 space-y-2">
      {workers.map((worker) => {
        const isEditing = editingWorkerId === worker.workerId;
        return (
          <AppCard className="p-4" key={worker.workerId}>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-ink">تعديل العامل</h4>
                  <button
                    className="text-xs font-bold text-muted hover:text-ink"
                    onClick={onCancelEdit}
                    type="button"
                  >
                    إلغاء
                  </button>
                </div>
                <TextField
                  label="الاسم"
                  onChange={(event) => onEditNameChange(event.target.value)}
                  value={editName}
                />
                <TextField
                  dir="ltr"
                  inputMode="tel"
                  label="الهاتف"
                  onChange={(event) => onEditPhoneChange(event.target.value)}
                  placeholder="اختياري"
                  value={editPhone}
                />
                <MoneyField
                  currency={currency}
                  label="الأجر اليومي"
                  onChange={(event) => onEditWageChange(event.target.value)}
                  value={editWage}
                />
                <SelectField
                  label="الحالة"
                  onChange={(event) =>
                    onEditStatusChange(
                      event.target.value as "active" | "inactive",
                    )
                  }
                  value={editStatus}
                >
                  <option value="active">نشط</option>
                  <option value="inactive">موقوف</option>
                </SelectField>
                <button
                  className="pressable flex min-h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
                  disabled={busy}
                  onClick={onSaveEdit}
                  type="button"
                >
                  حفظ التعديلات
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{worker.name}</p>
                      {worker.status === "inactive" ? (
                        <span className="rounded-sm bg-surface-subtle px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          موقوف
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                      <span>
                        يومية{" "}
                        <bdi className="numeric font-semibold text-ink" dir="ltr">
                          {formatMinorAmount(worker.dailyWageMinor, {
                            currency,
                            locale: "en-US",
                          })}
                        </bdi>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{worker.workDays} يوم عمل</span>
                      {worker.phone ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <bdi className="numeric" dir="ltr">
                            {worker.phone}
                          </bdi>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-left">
                      <p className="text-[11px] text-muted">الرصيد المستحق</p>
                      <p
                        className={`numeric text-base font-bold ${
                          worker.balanceMinor >= 0n
                            ? "text-primary"
                            : "text-danger"
                        }`}
                        dir="ltr"
                      >
                        {formatMinorAmount(worker.balanceMinor, {
                          currency,
                          locale: "en-US",
                        })}
                      </p>
                    </div>
                    <button
                      aria-label={`تعديل ${worker.name}`}
                      className="pressable inline-flex min-h-9 items-center gap-1 rounded-sm border border-line px-2 text-[11px] font-bold text-muted hover:text-ink"
                      onClick={() => onEdit(worker)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={12} />
                      تعديل
                    </button>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px]">
                  {[
                    ["مكتسب", worker.earnedMinor],
                    ["مسحوب", worker.withdrawnMinor],
                    ["خصم", worker.deductedMinor],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-muted">{label}</dt>
                      <dd className="numeric font-bold text-ink" dir="ltr">
                        {formatMinorAmount(value as bigint, {
                          currency,
                          locale: "en-US",
                        })}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </AppCard>
        );
      })}
    </div>
  );
}

function AttendanceCalendar({
  calendarMonth,
  onMonthChange,
  onSelectDate,
  selectedDate,
  timeZone,
  workers,
  workLogs,
}: {
  calendarMonth: string;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  timeZone: string;
  workers: WorkerBalance[];
  workLogs: WorkLogEntry[];
}) {
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const activeWorkers = workers.filter((worker) => worker.status === "active");
  const days = daysInMonth(calendarMonth);
  const offset = monthStartWeekday(calendarMonth);
  const dailyByDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const log of workLogs) {
      if (log.entryType !== "daily_wage") continue;
      if (!log.workDate.startsWith(calendarMonth)) continue;
      const set = map.get(log.workDate) ?? new Set<string>();
      set.add(log.workerId);
      map.set(log.workDate, set);
    }
    return map;
  }, [calendarMonth, workLogs]);

  const selectedPresent = dailyByDate.get(selectedDate)?.size ?? 0;

  return (
    <AppCard className="mb-4 space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="text-primary" size={18} />
          <h3 className="text-sm font-bold text-ink">تقويم الحضور اليومي</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            aria-label="الشهر السابق"
            className="pressable grid size-9 place-items-center rounded-sm border border-line text-muted hover:text-ink"
            onClick={() => onMonthChange(shiftMonth(calendarMonth, -1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
          <p className="min-w-28 text-center text-xs font-bold text-ink">
            {monthLabelAr(calendarMonth)}
          </p>
          <button
            aria-label="الشهر التالي"
            className="pressable grid size-9 place-items-center rounded-sm border border-line text-muted hover:text-ink"
            onClick={() => onMonthChange(shiftMonth(calendarMonth, 1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <p className="text-xs leading-5 text-muted">
        اختر يومًا لعرض الحضور وربط الحركة بالتاريخ. اليوم المحدد:{" "}
        <span className="font-bold text-ink">
          {formatPlainDateAr(selectedDate)}
        </span>
        {activeWorkers.length > 0
          ? ` · حضر ${selectedPresent} من ${activeWorkers.length}`
          : null}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, index) => (
          <span key={`pad-${index}`} />
        ))}
        {days.map((date) => {
          const present = dailyByDate.get(date)?.size ?? 0;
          const ratio =
            activeWorkers.length > 0 ? present / activeWorkers.length : 0;
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const isFuture = date > today;
          return (
            <button
              aria-label={`${formatPlainDateAr(date)}، ${present} حضور`}
              aria-pressed={isSelected}
              className={clsx(
                "pressable flex min-h-11 flex-col items-center justify-center rounded-sm border text-[11px] font-bold transition",
                isSelected
                  ? "border-primary bg-primary-soft text-primary-ink"
                  : "border-line bg-surface text-ink hover:bg-surface-subtle",
                isToday && !isSelected ? "ring-1 ring-primary/40" : null,
                isFuture ? "opacity-50" : null,
              )}
              disabled={isFuture}
              key={date}
              onClick={() => onSelectDate(date)}
              type="button"
            >
              <span>{Number(date.slice(-2))}</span>
              <span
                className={clsx(
                  "mt-0.5 h-1 w-4 rounded-full",
                  ratio >= 1
                    ? "bg-success"
                    : ratio > 0
                      ? "bg-warning"
                      : "bg-line",
                )}
              />
            </button>
          );
        })}
      </div>
    </AppCard>
  );
}

function PeriodSummary({
  currency,
  fromDate,
  toDate,
  workers,
  workLogs,
}: {
  currency: string;
  fromDate: string;
  toDate: string;
  workers: WorkerBalance[];
  workLogs: WorkLogEntry[];
}) {
  const summary = useMemo(() => {
    const filtered = workLogs.filter(
      (log) => log.workDate >= fromDate && log.workDate <= toDate,
    );
    let earned = 0n;
    let withdrawn = 0n;
    let deducted = 0n;
    let workDays = 0;
    for (const log of filtered) {
      if (log.entryType === "daily_wage" || log.entryType === "bonus") {
        earned += log.amountMinor > 0n ? log.amountMinor : -log.amountMinor;
        if (log.entryType === "daily_wage") workDays += 1;
      } else if (log.entryType === "withdrawal") {
        withdrawn +=
          log.amountMinor < 0n ? -log.amountMinor : log.amountMinor;
      } else if (log.entryType === "deduction") {
        deducted += log.amountMinor < 0n ? -log.amountMinor : log.amountMinor;
      } else if (log.entryType === "adjustment") {
        earned += log.amountMinor;
      }
    }
    return {
      earned,
      withdrawn,
      deducted,
      workDays,
      movements: filtered.length,
      workersTouched: new Set(filtered.map((log) => log.workerId)).size,
      activeWorkers: workers.filter((worker) => worker.status === "active")
        .length,
    };
  }, [fromDate, toDate, workLogs, workers]);

  return (
    <AppCard className="mb-4 p-4">
      <h3 className="text-sm font-bold text-ink">ملخص الفترة</h3>
      <p className="mt-1 text-xs text-muted">
        من {formatPlainDateAr(fromDate)} إلى {formatPlainDateAr(toDate)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["أيام عمل", String(summary.workDays)],
          [
            "مكتسب",
            formatMinorAmount(summary.earned, {
              currency,
              locale: "en-US",
            }),
          ],
          [
            "مسحوب",
            formatMinorAmount(summary.withdrawn, {
              currency,
              locale: "en-US",
            }),
          ],
          [
            "خصم",
            formatMinorAmount(summary.deducted, {
              currency,
              locale: "en-US",
            }),
          ],
        ].map(([label, value]) => (
          <div className="rounded-sm bg-surface-subtle p-3" key={label}>
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="numeric mt-1 text-sm font-bold text-ink" dir="ltr">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-muted">
        {summary.movements} حركة · {summary.workersTouched} عامل ضمن الفترة ·{" "}
        {summary.activeWorkers} نشط الآن
      </p>
    </AppCard>
  );
}

function WorkLogHistory({
  entryTypeFilter,
  logs,
  onEntryTypeFilterChange,
  onWorkerFilterChange,
  workerFilter,
  workers,
}: {
  entryTypeFilter: string;
  logs: WorkLogEntry[];
  onEntryTypeFilterChange: (value: string) => void;
  onWorkerFilterChange: (value: string) => void;
  workerFilter: string;
  workers: WorkerBalance[];
}) {
  const workerNames = new Map(
    workers.map((worker) => [worker.workerId, worker.name]),
  );
  const filtered = logs.filter((log) => {
    if (workerFilter && log.workerId !== workerFilter) return false;
    if (entryTypeFilter && log.entryType !== entryTypeFilter) return false;
    return true;
  });

  return (
    <section aria-labelledby="work-log-history-title" className="mt-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-bold text-ink" id="work-log-history-title">
          تاريخ اليوميات والحركات
        </h3>
        <p className="text-[11px] text-muted">{filtered.length} سجل</p>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <SelectField
          label="العامل"
          onChange={(event) => onWorkerFilterChange(event.target.value)}
          value={workerFilter}
        >
          <option value="">كل العمال</option>
          {workers.map((worker) => (
            <option key={worker.workerId} value={worker.workerId}>
              {worker.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="نوع الحركة"
          onChange={(event) => onEntryTypeFilterChange(event.target.value)}
          value={entryTypeFilter}
        >
          <option value="">كل الأنواع</option>
          {Object.entries(entryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
          لا توجد حركات مطابقة للفلاتر الحالية.
        </p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto pe-1">
          {filtered.map((log) => (
            <li
              className="flex items-start justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
              key={log.id}
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {workerNames.get(log.workerId) ?? "عامل"} ·{" "}
                  {entryLabels[log.entryType]}
                </p>
                <p className="text-[11px] text-muted">
                  {formatPlainDateAr(log.workDate)}
                </p>
                {log.note ? (
                  <p className="mt-1 text-xs leading-5 text-muted">{log.note}</p>
                ) : null}
              </div>
              <bdi
                className={`numeric shrink-0 font-bold ${
                  log.amountMinor < 0n ? "text-danger" : "text-success"
                }`}
                dir="ltr"
              >
                {formatMinorAmount(log.amountMinor, {
                  currency: log.currencyCode,
                  locale: "en-US",
                })}
              </bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WorkersTabBody({
  busy,
  calendarMonth,
  currency,
  dailyWage,
  editingWorkerId,
  editName,
  editPhone,
  editStatus,
  editWage,
  entryTypeFilter,
  fromDate,
  movementAmount,
  movementNote,
  movementType,
  onAddWorker,
  onBulkMarkToday,
  onCalendarMonthChange,
  onCancelEdit,
  onDailyWageChange,
  onEdit,
  onEditNameChange,
  onEditPhoneChange,
  onEditStatusChange,
  onEditWageChange,
  onEntryTypeFilterChange,
  onFromDateChange,
  onMovementAmountChange,
  onMovementNoteChange,
  onMovementTypeChange,
  onPhoneChange,
  onSaveEdit,
  onSelectedWorkerChange,
  onSubmitMovement,
  onToDateChange,
  onWalletChange,
  onWorkDateChange,
  onWorkerFilterChange,
  onWorkerNameChange,
  phone,
  selectedWorkerId,
  timeZone,
  toDate,
  walletId,
  wallets,
  workDate,
  workerFilter,
  workerName,
  workers,
  workLogs,
}: {
  busy: boolean;
  calendarMonth: string;
  currency: string;
  dailyWage: string;
  editingWorkerId: string;
  editName: string;
  editPhone: string;
  editStatus: "active" | "inactive";
  editWage: string;
  entryTypeFilter: string;
  fromDate: string;
  movementAmount: string;
  movementNote: string;
  movementType: MovementType;
  onAddWorker: () => void;
  onBulkMarkToday: () => void;
  onCalendarMonthChange: (month: string) => void;
  onCancelEdit: () => void;
  onDailyWageChange: (value: string) => void;
  onEdit: (worker: WorkerBalance) => void;
  onEditNameChange: (value: string) => void;
  onEditPhoneChange: (value: string) => void;
  onEditStatusChange: (value: "active" | "inactive") => void;
  onEditWageChange: (value: string) => void;
  onEntryTypeFilterChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onMovementAmountChange: (value: string) => void;
  onMovementNoteChange: (value: string) => void;
  onMovementTypeChange: (value: MovementType) => void;
  onPhoneChange: (value: string) => void;
  onSaveEdit: () => void;
  onSelectedWorkerChange: (value: string) => void;
  onSubmitMovement: () => void;
  onToDateChange: (value: string) => void;
  onWalletChange: (value: string) => void;
  onWorkDateChange: (value: string) => void;
  onWorkerFilterChange: (value: string) => void;
  onWorkerNameChange: (value: string) => void;
  phone: string;
  selectedWorkerId: string;
  timeZone: string;
  toDate: string;
  walletId: string;
  wallets: Wallet[];
  workDate: string;
  workerFilter: string;
  workerName: string;
  workers: WorkerBalance[];
  workLogs: WorkLogEntry[];
}) {
  const payoutWallets = wallets.filter(
    (wallet) => wallet.currency === currency,
  );
  const activeWorkers = workers.filter((worker) => worker.status === "active");
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const loggedToday = new Set(
    workLogs
      .filter(
        (log) => log.workDate === today && log.entryType === "daily_wage",
      )
      .map((log) => log.workerId),
  );
  const pendingToday = activeWorkers.filter(
    (worker) => !loggedToday.has(worker.workerId),
  );
  const periodLogs = workLogs.filter(
    (log) => log.workDate >= fromDate && log.workDate <= toDate,
  );

  return (
    <section aria-labelledby="project-workers-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink" id="project-workers-title">
            سجل العمال واليوميات
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            حضور يومي، أرصدة مستحقة، وتاريخ كامل للحركات.
          </p>
        </div>
        <button
          className="pressable inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-sm font-bold text-ink hover:bg-surface-subtle disabled:opacity-60"
          disabled={busy || pendingToday.length === 0}
          onClick={onBulkMarkToday}
          type="button"
        >
          <CheckCheck aria-hidden="true" size={16} />
          تسجيل حضور الكل اليوم
          {pendingToday.length > 0 ? ` (${pendingToday.length})` : ""}
        </button>
      </div>

      <AttendanceCalendar
        calendarMonth={calendarMonth}
        onMonthChange={onCalendarMonthChange}
        onSelectDate={onWorkDateChange}
        selectedDate={workDate}
        timeZone={timeZone}
        workers={workers}
        workLogs={workLogs}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <TextField
          label="من تاريخ"
          max={toDate}
          onChange={(event) => onFromDateChange(event.target.value)}
          type="date"
          value={fromDate}
        />
        <TextField
          label="إلى تاريخ"
          max={today}
          min={fromDate}
          onChange={(event) => onToDateChange(event.target.value)}
          type="date"
          value={toDate}
        />
      </div>

      <PeriodSummary
        currency={currency}
        fromDate={fromDate}
        toDate={toDate}
        workers={workers}
        workLogs={workLogs}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:items-start">
        <div>
          <AppCard className="mb-3 space-y-3 p-4">
            <div className="flex items-center gap-2">
              <UserRoundPlus
                aria-hidden="true"
                className="text-primary"
                size={18}
              />
              <h3 className="text-sm font-bold text-ink">إضافة عامل</h3>
            </div>
            <TextField
              label="اسم العامل"
              onChange={(event) => onWorkerNameChange(event.target.value)}
              placeholder="مثال: أحمد محمد"
              value={workerName}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MoneyField
                currency={currency}
                label="الأجر اليومي"
                onChange={(event) => onDailyWageChange(event.target.value)}
                placeholder="0.000"
                value={dailyWage}
              />
              <TextField
                dir="ltr"
                inputMode="tel"
                label="الهاتف"
                onChange={(event) => onPhoneChange(event.target.value)}
                placeholder="اختياري"
                value={phone}
              />
            </div>
            <button
              className="pressable flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy}
              onClick={onAddWorker}
              type="button"
            >
              <Plus aria-hidden="true" size={16} />
              إضافة عامل
            </button>
          </AppCard>

          <WorkerBalances
            busy={busy}
            currency={currency}
            editingWorkerId={editingWorkerId}
            editName={editName}
            editPhone={editPhone}
            editStatus={editStatus}
            editWage={editWage}
            onCancelEdit={onCancelEdit}
            onEdit={onEdit}
            onEditNameChange={onEditNameChange}
            onEditPhoneChange={onEditPhoneChange}
            onEditStatusChange={onEditStatusChange}
            onEditWageChange={onEditWageChange}
            onSaveEdit={onSaveEdit}
            workers={workers}
          />
        </div>

        <div>
          <AppCard className="space-y-3 p-4">
            <h3 className="text-sm font-bold text-ink">تسجيل حركة</h3>
            <SelectField
              label="العامل"
              onChange={(event) => onSelectedWorkerChange(event.target.value)}
              value={selectedWorkerId}
            >
              <option value="">اختر العامل</option>
              {activeWorkers.map((worker) => (
                <option key={worker.workerId} value={worker.workerId}>
                  {worker.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="تاريخ الحركة"
              max={today}
              onChange={(event) => onWorkDateChange(event.target.value)}
              type="date"
              value={workDate}
            />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {movementOptions.map(([value, label, Icon]) => (
                <button
                  aria-pressed={movementType === value}
                  className={`pressable flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm border text-[11px] font-bold ${
                    movementType === value
                      ? "border-primary bg-primary-soft text-primary-ink"
                      : "border-line text-muted"
                  }`}
                  key={value}
                  onClick={() => onMovementTypeChange(value)}
                  type="button"
                >
                  <Icon aria-hidden="true" size={14} />
                  {label}
                </button>
              ))}
            </div>
            <MoneyField
              currency={currency}
              label={
                movementType === "daily" ? "أجر هذا اليوم" : "مبلغ الحركة"
              }
              onChange={(event) => onMovementAmountChange(event.target.value)}
              placeholder={
                movementType === "daily"
                  ? "اختياري = الأجر اليومي"
                  : "المبلغ"
              }
              value={movementAmount}
            />
            {movementType === "withdrawal" ? (
              <>
                <SelectField
                  label="محفظة السحب"
                  onChange={(event) => onWalletChange(event.target.value)}
                  value={walletId}
                >
                  <option value="">اختر المحفظة</option>
                  {payoutWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} • {wallet.currency}
                    </option>
                  ))}
                </SelectField>
                {payoutWallets.length === 0 ? (
                  <p className="text-xs leading-5 text-warning">
                    أضف محفظة بعملة {currency} قبل تسجيل السحب.
                  </p>
                ) : null}
              </>
            ) : null}
            <TextareaField
              label="ملاحظة"
              onChange={(event) => onMovementNoteChange(event.target.value)}
              placeholder="اختياري — سبب الخصم أو تفاصيل اليوم"
              rows={2}
              value={movementNote}
            />
            <button
              className="pressable flex min-h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy || activeWorkers.length === 0}
              onClick={onSubmitMovement}
              type="button"
            >
              حفظ الحركة
            </button>
          </AppCard>
          <WorkLogHistory
            entryTypeFilter={entryTypeFilter}
            logs={periodLogs}
            onEntryTypeFilterChange={onEntryTypeFilterChange}
            onWorkerFilterChange={onWorkerFilterChange}
            workerFilter={workerFilter}
            workers={workers}
          />
        </div>
      </div>
    </section>
  );
}

function useWorkersFormState(timeZone: string) {
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const monthKey = today.slice(0, 7);
  const [workerName, setWorkerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("daily");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [walletId, setWalletId] = useState("");
  const [workDate, setWorkDate] = useState(today);
  const [calendarMonth, setCalendarMonth] = useState(monthKey);
  const [fromDate, setFromDate] = useState(`${monthKey}-01`);
  const [toDate, setToDate] = useState(today);
  const [workerFilter, setWorkerFilter] = useState("");
  const [entryTypeFilter, setEntryTypeFilter] = useState("");
  const [editingWorkerId, setEditingWorkerId] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editWage, setEditWage] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "inactive">("active");
  const [busy, setBusy] = useState(false);

  return {
    busy,
    calendarMonth,
    dailyWage,
    editingWorkerId,
    editName,
    editPhone,
    editStatus,
    editWage,
    entryTypeFilter,
    fromDate,
    movementAmount,
    movementNote,
    movementType,
    phone,
    selectedWorkerId,
    setBusy,
    setCalendarMonth,
    setDailyWage,
    setEditingWorkerId,
    setEditName,
    setEditPhone,
    setEditStatus,
    setEditWage,
    setEntryTypeFilter,
    setFromDate,
    setMovementAmount,
    setMovementNote,
    setMovementType,
    setPhone,
    setSelectedWorkerId,
    setToDate,
    setWalletId,
    setWorkDate,
    setWorkerFilter,
    setWorkerName,
    toDate,
    walletId,
    workDate,
    workerFilter,
    workerName,
  };
}

function parsePositiveAmount(value: string, scale: number): bigint {
  const amount = parseMajorAmount(value, scale);
  if (amount <= 0n) throw new Error("أدخل مبلغًا أكبر من صفر");
  return amount;
}

function LiveProjectWorkersTab({
  currency,
  projectId,
  timeZone,
  wallets,
}: Omit<ProjectWorkersTabProps, "isDemo">) {
  const workersQuery = useWorkersQuery(projectId);
  const workLogsQuery = useWorkLogsQuery(projectId);
  const createWorker = useCreateWorkerMutation(projectId);
  const updateWorker = useUpdateWorkerMutation(projectId);
  const recordWork = useRecordDailyWorkMutation(projectId);
  const wageMovement = usePostWageMovementMutation(projectId);
  const confirm = useConfirm();
  const form = useWorkersFormState(timeZone);
  const workers = workersQuery.data ?? [];
  const workLogs = workLogsQuery.data ?? [];
  const scale = getCurrencyScale(currency);
  const workerError = workersQuery.isError
    ? workersQuery.error instanceof Error
      ? workersQuery.error.message
      : "تعذر تحميل أرصدة العمال"
    : workLogsQuery.isError
      ? workLogsQuery.error instanceof Error
        ? workLogsQuery.error.message
        : "تعذر تحميل يوميات العمال"
      : null;

  const addWorker = async () => {
    if (!form.workerName.trim() || !form.dailyWage.trim()) {
      toast.error("أدخل اسم العامل والأجر اليومي");
      return;
    }
    form.setBusy(true);
    try {
      await createWorker.mutateAsync({
        name: form.workerName.trim(),
        dailyWageMinor: toSafeMinorNumber(
          parsePositiveAmount(form.dailyWage, scale),
        ),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      form.setWorkerName("");
      form.setDailyWage("");
      form.setPhone("");
      toast.success("تمت إضافة العامل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الإضافة");
    } finally {
      form.setBusy(false);
    }
  };

  const startEdit = (worker: WorkerBalance) => {
    form.setEditingWorkerId(worker.workerId);
    form.setEditName(worker.name);
    form.setEditPhone(worker.phone ?? "");
    form.setEditWage(formatMajorInputAmount(worker.dailyWageMinor, scale));
    form.setEditStatus(worker.status);
  };

  const saveEdit = async () => {
    if (!form.editingWorkerId || !form.editName.trim()) {
      toast.error("أدخل اسم العامل");
      return;
    }
    form.setBusy(true);
    try {
      await updateWorker.mutateAsync({
        workerId: form.editingWorkerId,
        name: form.editName.trim(),
        phone: form.editPhone.trim() || null,
        clearPhone: !form.editPhone.trim(),
        dailyWageMinor: toSafeMinorNumber(
          parsePositiveAmount(form.editWage, scale),
        ),
        status: form.editStatus,
      });
      form.setEditingWorkerId("");
      toast.success("تم تحديث العامل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التحديث");
    } finally {
      form.setBusy(false);
    }
  };

  const submitMovement = async () => {
    if (!form.selectedWorkerId) {
      toast.error("اختر عاملًا");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.workDate)) {
      toast.error("اختر تاريخًا صحيحًا للحركة");
      return;
    }
    if (form.movementType !== "daily" && !form.movementAmount.trim()) {
      toast.error("أدخل المبلغ");
      return;
    }
    if (form.movementType === "withdrawal" && !form.walletId) {
      toast.error("اختر محفظة السحب");
      return;
    }

    let movementAmountMinor: bigint | undefined;
    if (form.movementAmount.trim()) {
      try {
        movementAmountMinor = parsePositiveAmount(form.movementAmount, scale);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "أدخل مبلغًا صحيحًا",
        );
        return;
      }
    }
    if (
      form.movementType === "withdrawal" ||
      form.movementType === "deduction"
    ) {
      const ok = await confirm({
        title:
          form.movementType === "withdrawal"
            ? "تأكيد سحب العامل؟"
            : "تأكيد خصم من رصيد العامل؟",
        description:
          form.movementType === "withdrawal"
            ? "سيتم تسجيل السحب من المحفظة المختارة."
            : "سيُخصم المبلغ من رصيد العامل.",
        tone: "warning",
      });
      if (!ok) return;
    }

    form.setBusy(true);
    const clientId = crypto.randomUUID();
    const note = form.movementNote.trim() || undefined;
    try {
      if (form.movementType === "daily") {
        await recordWork.mutateAsync({
          workerId: form.selectedWorkerId,
          workDate: form.workDate,
          clientId,
          ...(movementAmountMinor !== undefined
            ? { amountMinor: toSafeMinorNumber(movementAmountMinor) }
            : {}),
          ...(note ? { note } : {}),
        });
        toast.success("تم تسجيل يوم العمل");
      } else {
        await wageMovement.mutateAsync({
          workerId: form.selectedWorkerId,
          entryType: form.movementType,
          amountMinor: toSafeMinorNumber(movementAmountMinor!),
          workDate: form.workDate,
          clientId,
          ...(form.movementType === "withdrawal"
            ? { walletId: form.walletId }
            : {}),
          ...(note ? { note } : {}),
        });
        toast.success("تم تسجيل الحركة");
      }
      form.setMovementAmount("");
      form.setMovementNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التسجيل");
    } finally {
      form.setBusy(false);
    }
  };

  const bulkMarkToday = async () => {
    const today = getDateKeyInTimeZone(new Date(), timeZone);
    const active = workers.filter((worker) => worker.status === "active");
    const logged = new Set(
      workLogs
        .filter(
          (log) => log.workDate === today && log.entryType === "daily_wage",
        )
        .map((log) => log.workerId),
    );
    const pending = active.filter((worker) => !logged.has(worker.workerId));
    if (pending.length === 0) {
      toast.message("كل العمال النشطين مسجّلون اليوم");
      return;
    }
    const ok = await confirm({
      title: `تسجيل حضور ${pending.length} عامل اليوم؟`,
      description: "سيُسجَّل أجر يومي لكل عامل لم يُسجَّل بعد لهذا اليوم.",
      tone: "warning",
    });
    if (!ok) return;

    form.setBusy(true);
    let success = 0;
    try {
      for (const worker of pending) {
        await recordWork.mutateAsync({
          workerId: worker.workerId,
          workDate: today,
          clientId: crypto.randomUUID(),
        });
        success += 1;
      }
      toast.success(`تم تسجيل حضور ${success} عامل`);
      form.setWorkDate(today);
    } catch (error) {
      toast.error(
        success > 0
          ? `تم ${success} وفشل الباقي: ${error instanceof Error ? error.message : "خطأ"}`
          : error instanceof Error
            ? error.message
            : "فشل التسجيل الجماعي",
      );
    } finally {
      form.setBusy(false);
    }
  };

  if (workersQuery.isLoading || workLogsQuery.isLoading) {
    return (
      <AppCard
        aria-label="جاري تحميل بيانات العمال"
        className="h-72 animate-pulse bg-surface-subtle motion-reduce:animate-none"
        role="status"
      />
    );
  }

  if (workerError) {
    return (
      <ErrorState
        message={workerError}
        onRetry={() =>
          void Promise.all([workersQuery.refetch(), workLogsQuery.refetch()])
        }
        title="تعذر تحميل سجل العمال"
      />
    );
  }

  return (
    <WorkersTabBody
      busy={form.busy}
      calendarMonth={form.calendarMonth}
      currency={currency}
      dailyWage={form.dailyWage}
      editingWorkerId={form.editingWorkerId}
      editName={form.editName}
      editPhone={form.editPhone}
      editStatus={form.editStatus}
      editWage={form.editWage}
      entryTypeFilter={form.entryTypeFilter}
      fromDate={form.fromDate}
      movementAmount={form.movementAmount}
      movementNote={form.movementNote}
      movementType={form.movementType}
      onAddWorker={() => void addWorker()}
      onBulkMarkToday={() => void bulkMarkToday()}
      onCalendarMonthChange={(month) => {
        form.setCalendarMonth(month);
        const nextFrom = `${month}-01`;
        form.setFromDate(nextFrom);
        const today = getDateKeyInTimeZone(new Date(), timeZone);
        const monthEnd = daysInMonth(month).at(-1)!;
        form.setToDate(monthEnd > today ? today : monthEnd);
      }}
      onCancelEdit={() => form.setEditingWorkerId("")}
      onDailyWageChange={form.setDailyWage}
      onEdit={startEdit}
      onEditNameChange={form.setEditName}
      onEditPhoneChange={form.setEditPhone}
      onEditStatusChange={form.setEditStatus}
      onEditWageChange={form.setEditWage}
      onEntryTypeFilterChange={form.setEntryTypeFilter}
      onFromDateChange={form.setFromDate}
      onMovementAmountChange={form.setMovementAmount}
      onMovementNoteChange={form.setMovementNote}
      onMovementTypeChange={form.setMovementType}
      onPhoneChange={form.setPhone}
      onSaveEdit={() => void saveEdit()}
      onSelectedWorkerChange={form.setSelectedWorkerId}
      onSubmitMovement={() => void submitMovement()}
      onToDateChange={form.setToDate}
      onWalletChange={form.setWalletId}
      onWorkDateChange={(date) => {
        form.setWorkDate(date);
        form.setCalendarMonth(date.slice(0, 7));
      }}
      onWorkerFilterChange={form.setWorkerFilter}
      onWorkerNameChange={form.setWorkerName}
      phone={form.phone}
      selectedWorkerId={form.selectedWorkerId}
      timeZone={timeZone}
      toDate={form.toDate}
      walletId={form.walletId}
      wallets={wallets}
      workDate={form.workDate}
      workerFilter={form.workerFilter}
      workerName={form.workerName}
      workers={workers}
      workLogs={workLogs}
    />
  );
}

const EMPTY_WORKERS: WorkerBalance[] = [];
const EMPTY_WORK_LOGS: WorkLogEntry[] = [];

function DemoProjectWorkersTab({
  currency,
  projectId,
  timeZone,
  wallets,
}: Omit<ProjectWorkersTabProps, "isDemo">) {
  const form = useWorkersFormState(timeZone);
  const scale = getCurrencyScale(currency);
  const workers = useProjectStore(
    (state) => state.workersByProject[projectId] ?? EMPTY_WORKERS,
  );
  const workLogs = useProjectStore(
    (state) => state.workLogsByProject[projectId] ?? EMPTY_WORK_LOGS,
  );
  const createWorker = useProjectStore((state) => state.createWorker);
  const updateWorker = useProjectStore((state) => state.updateWorker);
  const recordDailyWork = useProjectStore((state) => state.recordDailyWork);
  const postWageMovement = useProjectStore((state) => state.postWageMovement);
  const confirm = useConfirm();
  const sortedLogs = useMemo(
    () =>
      [...workLogs].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      ),
    [workLogs],
  );

  const addWorker = () => {
    if (!form.workerName.trim() || !form.dailyWage.trim()) {
      toast.error("أدخل اسم العامل والأجر اليومي");
      return;
    }
    form.setBusy(true);
    try {
      createWorker({
        projectId,
        name: form.workerName.trim(),
        dailyWageMinor: parsePositiveAmount(form.dailyWage, scale),
        currencyCode: currency,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      });
      form.setWorkerName("");
      form.setDailyWage("");
      form.setPhone("");
      toast.success("تمت إضافة العامل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الإضافة");
    } finally {
      form.setBusy(false);
    }
  };

  const startEdit = (worker: WorkerBalance) => {
    form.setEditingWorkerId(worker.workerId);
    form.setEditName(worker.name);
    form.setEditPhone(worker.phone ?? "");
    form.setEditWage(formatMajorInputAmount(worker.dailyWageMinor, scale));
    form.setEditStatus(worker.status);
  };

  const saveEdit = () => {
    if (!form.editingWorkerId || !form.editName.trim()) {
      toast.error("أدخل اسم العامل");
      return;
    }
    form.setBusy(true);
    try {
      updateWorker({
        projectId,
        workerId: form.editingWorkerId,
        name: form.editName.trim(),
        phone: form.editPhone.trim() || null,
        dailyWageMinor: parsePositiveAmount(form.editWage, scale),
        status: form.editStatus,
      });
      form.setEditingWorkerId("");
      toast.success("تم تحديث العامل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التحديث");
    } finally {
      form.setBusy(false);
    }
  };

  const submitMovement = async () => {
    if (!form.selectedWorkerId) {
      toast.error("اختر عاملًا");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.workDate)) {
      toast.error("اختر تاريخًا صحيحًا للحركة");
      return;
    }
    if (form.movementType !== "daily" && !form.movementAmount.trim()) {
      toast.error("أدخل المبلغ");
      return;
    }
    if (form.movementType === "withdrawal" && !form.walletId) {
      toast.error("اختر محفظة السحب");
      return;
    }

    let movementAmountMinor: bigint | undefined;
    if (form.movementAmount.trim()) {
      try {
        movementAmountMinor = parsePositiveAmount(form.movementAmount, scale);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "أدخل مبلغًا صحيحًا",
        );
        return;
      }
    }
    if (
      form.movementType === "withdrawal" ||
      form.movementType === "deduction"
    ) {
      const ok = await confirm({
        title:
          form.movementType === "withdrawal"
            ? "تأكيد سحب العامل؟"
            : "تأكيد خصم من رصيد العامل؟",
        description:
          form.movementType === "withdrawal"
            ? "سيتم تسجيل السحب من المحفظة المختارة."
            : "سيُخصم المبلغ من رصيد العامل.",
        tone: "warning",
      });
      if (!ok) return;
    }

    form.setBusy(true);
    const clientId = crypto.randomUUID();
    const note = form.movementNote.trim() || undefined;
    try {
      if (form.movementType === "daily") {
        recordDailyWork({
          projectId,
          workerId: form.selectedWorkerId,
          workDate: form.workDate,
          clientId,
          currencyCode: currency,
          ...(movementAmountMinor !== undefined
            ? { amountMinor: movementAmountMinor }
            : {}),
          ...(note ? { note } : {}),
        });
        toast.success("تم تسجيل يوم العمل");
      } else {
        postWageMovement({
          projectId,
          workerId: form.selectedWorkerId,
          entryType: form.movementType,
          amountMinor: movementAmountMinor!,
          workDate: form.workDate,
          clientId,
          currencyCode: currency,
          ...(form.movementType === "withdrawal"
            ? { walletId: form.walletId }
            : {}),
          ...(note ? { note } : {}),
        });
        toast.success("تم تسجيل الحركة");
      }
      form.setMovementAmount("");
      form.setMovementNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التسجيل");
    } finally {
      form.setBusy(false);
    }
  };

  const bulkMarkToday = async () => {
    const today = getDateKeyInTimeZone(new Date(), timeZone);
    const active = workers.filter((worker) => worker.status === "active");
    const logged = new Set(
      workLogs
        .filter(
          (log) => log.workDate === today && log.entryType === "daily_wage",
        )
        .map((log) => log.workerId),
    );
    const pending = active.filter((worker) => !logged.has(worker.workerId));
    if (pending.length === 0) {
      toast.message("كل العمال النشطين مسجّلون اليوم");
      return;
    }
    const ok = await confirm({
      title: `تسجيل حضور ${pending.length} عامل اليوم؟`,
      description: "سيُسجَّل أجر يومي لكل عامل لم يُسجَّل بعد لهذا اليوم.",
      tone: "warning",
    });
    if (!ok) return;

    form.setBusy(true);
    try {
      for (const worker of pending) {
        recordDailyWork({
          projectId,
          workerId: worker.workerId,
          workDate: today,
          clientId: crypto.randomUUID(),
          currencyCode: currency,
        });
      }
      toast.success(`تم تسجيل حضور ${pending.length} عامل`);
      form.setWorkDate(today);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التسجيل");
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <WorkersTabBody
      busy={form.busy}
      calendarMonth={form.calendarMonth}
      currency={currency}
      dailyWage={form.dailyWage}
      editingWorkerId={form.editingWorkerId}
      editName={form.editName}
      editPhone={form.editPhone}
      editStatus={form.editStatus}
      editWage={form.editWage}
      entryTypeFilter={form.entryTypeFilter}
      fromDate={form.fromDate}
      movementAmount={form.movementAmount}
      movementNote={form.movementNote}
      movementType={form.movementType}
      onAddWorker={addWorker}
      onBulkMarkToday={() => void bulkMarkToday()}
      onCalendarMonthChange={(month) => {
        form.setCalendarMonth(month);
        form.setFromDate(`${month}-01`);
        const today = getDateKeyInTimeZone(new Date(), timeZone);
        const monthEnd = daysInMonth(month).at(-1)!;
        form.setToDate(monthEnd > today ? today : monthEnd);
      }}
      onCancelEdit={() => form.setEditingWorkerId("")}
      onDailyWageChange={form.setDailyWage}
      onEdit={startEdit}
      onEditNameChange={form.setEditName}
      onEditPhoneChange={form.setEditPhone}
      onEditStatusChange={form.setEditStatus}
      onEditWageChange={form.setEditWage}
      onEntryTypeFilterChange={form.setEntryTypeFilter}
      onFromDateChange={form.setFromDate}
      onMovementAmountChange={form.setMovementAmount}
      onMovementNoteChange={form.setMovementNote}
      onMovementTypeChange={form.setMovementType}
      onPhoneChange={form.setPhone}
      onSaveEdit={saveEdit}
      onSelectedWorkerChange={form.setSelectedWorkerId}
      onSubmitMovement={() => void submitMovement()}
      onToDateChange={form.setToDate}
      onWalletChange={form.setWalletId}
      onWorkDateChange={(date) => {
        form.setWorkDate(date);
        form.setCalendarMonth(date.slice(0, 7));
      }}
      onWorkerFilterChange={form.setWorkerFilter}
      onWorkerNameChange={form.setWorkerName}
      phone={form.phone}
      selectedWorkerId={form.selectedWorkerId}
      timeZone={timeZone}
      toDate={form.toDate}
      walletId={form.walletId}
      wallets={wallets}
      workDate={form.workDate}
      workerFilter={form.workerFilter}
      workerName={form.workerName}
      workers={workers}
      workLogs={sortedLogs}
    />
  );
}

export function ProjectWorkersTab({
  currency,
  isDemo,
  projectId,
  timeZone,
  wallets,
}: ProjectWorkersTabProps) {
  if (isDemo) {
    return (
      <DemoProjectWorkersTab
        currency={currency}
        projectId={projectId}
        timeZone={timeZone}
        wallets={wallets}
      />
    );
  }

  return (
    <LiveProjectWorkersTab
      currency={currency}
      projectId={projectId}
      timeZone={timeZone}
      wallets={wallets}
    />
  );
}
