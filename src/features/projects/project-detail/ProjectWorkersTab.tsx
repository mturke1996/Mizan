import {
  ArrowUpRight,
  Banknote,
  MinusCircle,
  Plus,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Wallet } from "@/domain/finance/finance-state";
import {
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
import { useConfirm } from "@/shared/ui/confirm-dialog";

type MovementType = "daily" | "withdrawal" | "deduction" | "bonus";

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
] as const;

const entryLabels: Record<WorkLogEntry["entryType"], string> = {
  daily_wage: "يومية",
  bonus: "مكافأة",
  deduction: "خصم",
  withdrawal: "سحب",
  adjustment: "تعديل",
};

function WorkerBalances({
  currency,
  workers,
}: {
  currency: string;
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
      {workers.map((worker) => (
        <AppCard className="p-4" key={worker.workerId}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-ink">{worker.name}</p>
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
              </p>
            </div>
            <div className="text-left">
              <p className="text-[11px] text-muted">الرصيد المستحق</p>
              <p
                className={`numeric text-base font-bold ${
                  worker.balanceMinor >= 0n ? "text-primary" : "text-danger"
                }`}
                dir="ltr"
              >
                {formatMinorAmount(worker.balanceMinor, {
                  currency,
                  locale: "en-US",
                })}
              </p>
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
        </AppCard>
      ))}
    </div>
  );
}

function WorkLogList({
  logs,
  workers,
}: {
  logs: WorkLogEntry[];
  workers: WorkerBalance[];
}) {
  if (logs.length === 0) return null;
  const workerNames = new Map(
    workers.map((worker) => [worker.workerId, worker.name]),
  );

  return (
    <section aria-labelledby="recent-work-log-title" className="mt-4">
      <h3 className="mb-2 text-sm font-bold text-ink" id="recent-work-log-title">
        آخر الحركات
      </h3>
      <ul className="space-y-2">
        {logs.slice(0, 8).map((log) => (
          <li
            className="flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2.5 text-sm"
            key={log.id}
          >
            <div>
              <p className="font-semibold text-ink">
                {workerNames.get(log.workerId) ?? "عامل"} ·{" "}
                {entryLabels[log.entryType]}
              </p>
              <p className="text-[11px] text-muted">
                {formatPlainDateAr(log.workDate)}
              </p>
            </div>
            <bdi
              className={`numeric font-bold ${
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
    </section>
  );
}

function WorkersDuesCalendar({
  currency,
  timeZone,
  workers,
  workLogs,
}: {
  currency: string;
  timeZone: string;
  workers: WorkerBalance[];
  workLogs: WorkLogEntry[];
}) {
  const today = getDateKeyInTimeZone(new Date(), timeZone);
  const loggedToday = new Set(
    workLogs
      .filter(
        (log) => log.workDate === today && log.entryType === "daily_wage",
      )
      .map((log) => log.workerId),
  );
  const lastWithdrawalByWorker = new Map<string, string>();
  for (const log of workLogs) {
    if (log.entryType !== "withdrawal") continue;
    const existing = lastWithdrawalByWorker.get(log.workerId);
    if (!existing || log.workDate > existing) {
      lastWithdrawalByWorker.set(log.workerId, log.workDate);
    }
  }
  const outstanding = workers.filter((worker) => worker.balanceMinor > 0n);

  return (
    <AppCard className="mb-4 space-y-3 p-4">
      <h3 className="text-sm font-bold text-ink">تقويم المستحقات</h3>
      <p className="text-xs leading-5 text-muted">
        من سجّل اليوم، الأرصدة المفتوحة، وآخر سحب لكل عامل.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-[11px] text-muted">سجّلوا اليوم</p>
          <p className="mt-1 text-lg font-bold text-ink">{loggedToday.size}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {workers
              .filter((worker) => loggedToday.has(worker.workerId))
              .map((worker) => (
                <li key={worker.workerId}>{worker.name}</li>
              ))}
            {loggedToday.size === 0 ? <li>لا أحد بعد</li> : null}
          </ul>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-[11px] text-muted">أرصدة مستحقة</p>
          <p className="mt-1 text-lg font-bold text-ink">{outstanding.length}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {outstanding.slice(0, 4).map((worker) => (
              <li key={worker.workerId}>
                {worker.name}:{" "}
                <bdi className="numeric font-semibold text-ink" dir="ltr">
                  {formatMinorAmount(worker.balanceMinor, {
                    currency,
                    locale: "en-US",
                  })}
                </bdi>
              </li>
            ))}
            {outstanding.length === 0 ? <li>لا مستحقات مفتوحة</li> : null}
          </ul>
        </div>
        <div className="rounded-sm bg-surface-subtle p-3">
          <p className="text-[11px] text-muted">آخر سحب</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {workers.slice(0, 5).map((worker) => (
              <li key={worker.workerId}>
                {worker.name}:{" "}
                {lastWithdrawalByWorker.has(worker.workerId)
                  ? formatPlainDateAr(
                      lastWithdrawalByWorker.get(worker.workerId)!,
                    )
                  : "لا سحب بعد"}
              </li>
            ))}
            {workers.length === 0 ? <li>أضف عمالًا أولًا</li> : null}
          </ul>
        </div>
      </div>
    </AppCard>
  );
}

function WorkersTabBody({
  busy,
  currency,
  dailyWage,
  movementAmount,
  movementType,
  onAddWorker,
  onDailyWageChange,
  onMovementAmountChange,
  onMovementTypeChange,
  onSelectedWorkerChange,
  onSubmitMovement,
  onWalletChange,
  onWorkDateChange,
  onWorkerNameChange,
  selectedWorkerId,
  timeZone,
  walletId,
  wallets,
  workDate,
  workLogs,
  workerName,
  workers,
}: {
  busy: boolean;
  currency: string;
  dailyWage: string;
  movementAmount: string;
  movementType: MovementType;
  onAddWorker: () => void;
  onDailyWageChange: (value: string) => void;
  onMovementAmountChange: (value: string) => void;
  onMovementTypeChange: (value: MovementType) => void;
  onSelectedWorkerChange: (value: string) => void;
  onSubmitMovement: () => void;
  onWalletChange: (value: string) => void;
  onWorkDateChange: (value: string) => void;
  onWorkerNameChange: (value: string) => void;
  selectedWorkerId: string;
  timeZone: string;
  walletId: string;
  wallets: Wallet[];
  workDate: string;
  workLogs: WorkLogEntry[];
  workerName: string;
  workers: WorkerBalance[];
}) {
  const payoutWallets = wallets.filter(
    (wallet) => wallet.currency === currency,
  );

  return (
    <section aria-labelledby="project-workers-title">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink" id="project-workers-title">
          سجل العمال واليوميات
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          الأرصدة والحركات الفعلية لهذا المشروع فقط.
        </p>
      </div>

      <WorkersDuesCalendar
        currency={currency}
        timeZone={timeZone}
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <input
                aria-label="اسم العامل"
                className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-sm"
                onChange={(event) => onWorkerNameChange(event.target.value)}
                placeholder="اسم العامل"
                value={workerName}
              />
              <input
                aria-label={`الأجر اليومي بعملة ${currency}`}
                className="numeric min-h-11 rounded-md border border-line-strong bg-surface px-3 text-left text-sm"
                dir="ltr"
                inputMode="decimal"
                onChange={(event) => onDailyWageChange(event.target.value)}
                placeholder="الأجر اليومي"
                value={dailyWage}
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

          <WorkerBalances currency={currency} workers={workers} />
        </div>

        <div>
          <AppCard className="space-y-3 p-4">
            <h3 className="text-sm font-bold text-ink">تسجيل حركة</h3>
            <select
              aria-label="العامل"
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) => onSelectedWorkerChange(event.target.value)}
              value={selectedWorkerId}
            >
              <option value="">اختر العامل</option>
              {workers.map((worker) => (
                <option key={worker.workerId} value={worker.workerId}>
                  {worker.name}
                </option>
              ))}
            </select>
            <div>
              <label
                className="text-xs font-bold text-muted"
                htmlFor="worker-movement-date"
              >
                تاريخ الحركة
              </label>
              <input
                className="mt-1 min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
                id="worker-movement-date"
                max={getDateKeyInTimeZone(new Date(), timeZone)}
                onChange={(event) => onWorkDateChange(event.target.value)}
                type="date"
                value={workDate}
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
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
            <input
              aria-label={
                movementType === "daily"
                  ? `أجر هذا اليوم بعملة ${currency}`
                  : `مبلغ الحركة بعملة ${currency}`
              }
              className="numeric min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-left text-sm"
              dir="ltr"
              inputMode="decimal"
              onChange={(event) => onMovementAmountChange(event.target.value)}
              placeholder={
                movementType === "daily"
                  ? "المبلغ (اختياري = الأجر اليومي)"
                  : "المبلغ"
              }
              value={movementAmount}
            />
            {movementType === "withdrawal" ? (
              <>
                <select
                  aria-label="محفظة سحب أجر العامل"
                  className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
                  onChange={(event) => onWalletChange(event.target.value)}
                  value={walletId}
                >
                  <option value="">محفظة السحب</option>
                  {payoutWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} • {wallet.currency}
                    </option>
                  ))}
                </select>
                {payoutWallets.length === 0 ? (
                  <p className="text-xs leading-5 text-warning">
                    أضف محفظة بعملة {currency} قبل تسجيل السحب.
                  </p>
                ) : null}
              </>
            ) : null}
            <button
              className="pressable flex min-h-11 w-full items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy || workers.length === 0}
              onClick={onSubmitMovement}
              type="button"
            >
              حفظ الحركة
            </button>
          </AppCard>
          <WorkLogList logs={workLogs} workers={workers} />
        </div>
      </div>
    </section>
  );
}

function useWorkersFormState(timeZone: string) {
  const [workerName, setWorkerName] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("daily");
  const [movementAmount, setMovementAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [workDate, setWorkDate] = useState(() =>
    getDateKeyInTimeZone(new Date(), timeZone),
  );
  const [busy, setBusy] = useState(false);

  return {
    busy,
    dailyWage,
    movementAmount,
    movementType,
    selectedWorkerId,
    setBusy,
    setDailyWage,
    setMovementAmount,
    setMovementType,
    setSelectedWorkerId,
    setWalletId,
    setWorkDate,
    setWorkerName,
    walletId,
    workDate,
    workerName,
  };
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

  const parsePositiveAmount = (value: string): bigint => {
    const amount = parseMajorAmount(value, scale);
    if (amount <= 0n) throw new Error("أدخل مبلغًا أكبر من صفر");
    return amount;
  };

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
          parsePositiveAmount(form.dailyWage),
        ),
      });
      form.setWorkerName("");
      form.setDailyWage("");
      toast.success("تمت إضافة العامل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الإضافة");
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
        movementAmountMinor = parsePositiveAmount(form.movementAmount);
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
    try {
      if (form.movementType === "daily") {
        await recordWork.mutateAsync({
          workerId: form.selectedWorkerId,
          workDate: form.workDate,
          clientId,
          ...(movementAmountMinor !== undefined
            ? { amountMinor: toSafeMinorNumber(movementAmountMinor) }
            : {}),
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
        });
        toast.success("تم تسجيل الحركة");
      }
      form.setMovementAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التسجيل");
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
          void Promise.all([
            workersQuery.refetch(),
            workLogsQuery.refetch(),
          ])
        }
        title="تعذر تحميل سجل العمال"
      />
    );
  }

  return (
    <WorkersTabBody
      busy={form.busy}
      currency={currency}
      dailyWage={form.dailyWage}
      movementAmount={form.movementAmount}
      movementType={form.movementType}
      onAddWorker={() => void addWorker()}
      onDailyWageChange={form.setDailyWage}
      onMovementAmountChange={form.setMovementAmount}
      onMovementTypeChange={form.setMovementType}
      onSelectedWorkerChange={form.setSelectedWorkerId}
      onSubmitMovement={() => void submitMovement()}
      onWalletChange={form.setWalletId}
      onWorkDateChange={form.setWorkDate}
      onWorkerNameChange={form.setWorkerName}
      selectedWorkerId={form.selectedWorkerId}
      timeZone={timeZone}
      walletId={form.walletId}
      wallets={wallets}
      workDate={form.workDate}
      workLogs={workLogs}
      workerName={form.workerName}
      workers={workers}
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

  const parsePositiveAmount = (value: string): bigint => {
    const amount = parseMajorAmount(value, scale);
    if (amount <= 0n) throw new Error("أدخل مبلغًا أكبر من صفر");
    return amount;
  };

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
        dailyWageMinor: parsePositiveAmount(form.dailyWage),
        currencyCode: currency,
      });
      form.setWorkerName("");
      form.setDailyWage("");
      toast.success("تمت إضافة العامل");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل الإضافة");
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
        movementAmountMinor = parsePositiveAmount(form.movementAmount);
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
        });
        toast.success("تم تسجيل الحركة");
      }
      form.setMovementAmount("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل التسجيل");
    } finally {
      form.setBusy(false);
    }
  };

  return (
    <WorkersTabBody
      busy={form.busy}
      currency={currency}
      dailyWage={form.dailyWage}
      movementAmount={form.movementAmount}
      movementType={form.movementType}
      onAddWorker={addWorker}
      onDailyWageChange={form.setDailyWage}
      onMovementAmountChange={form.setMovementAmount}
      onMovementTypeChange={form.setMovementType}
      onSelectedWorkerChange={form.setSelectedWorkerId}
      onSubmitMovement={() => void submitMovement()}
      onWalletChange={form.setWalletId}
      onWorkDateChange={form.setWorkDate}
      onWorkerNameChange={form.setWorkerName}
      selectedWorkerId={form.selectedWorkerId}
      timeZone={timeZone}
      walletId={form.walletId}
      wallets={wallets}
      workDate={form.workDate}
      workLogs={sortedLogs}
      workerName={form.workerName}
      workers={workers}
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
