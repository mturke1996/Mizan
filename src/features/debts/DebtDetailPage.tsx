import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarClock,
  CircleCheck,
  Pencil,
  ReceiptText,
  Save,
  Scale,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
  formatMajorInputAmount,
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import { useFinanceStore } from "@/features/finance/finance-store";
import {
  usePostDebtEntryMutation,
} from "@/features/workspace/use-finance-data";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  DebtEntry,
  DebtEntryType,
  DebtStatus,
} from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge, type BadgeTone } from "@/shared/ui/Badge";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useDebtStore } from "./debt-store";
import { useDebtDetailView } from "./use-debts-view";

const entrySchema = z.object({
  entryType: z.enum(["payment", "adjustment", "write_off"]),
  amount: z.string().trim().min(1, "أدخل مبلغ الحركة"),
  occurredOn: z.string().min(1, "اختر تاريخ الحركة"),
  walletId: z.string().optional(),
  note: z.string().trim().max(1000, "الملاحظة أطول من اللازم").optional(),
});

type EntryFormValues = z.infer<typeof entrySchema>;

interface SubmitIntent {
  fingerprint: string;
  clientId: string;
}

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

const ENTRY_LABELS: Record<DebtEntryType, string> = {
  open: "فتح الدين",
  payment: "دفعة",
  adjustment: "تعديل",
  write_off: "شطب",
};

const inputClassName =
  "min-h-12 w-full rounded-md border border-control-border bg-surface px-4 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-surface-subtle";

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ar-LY", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date);
}

function EntryTimelineRow({ entry }: { entry: DebtEntry }) {
  const isReduction =
    entry.entryType === "payment" || entry.entryType === "write_off";
  const amountTone = isReduction
    ? "text-success"
    : entry.amountMinor < 0n
      ? "text-success"
      : "text-ink";

  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-sm ${
            entry.entryType === "open"
              ? "bg-primary-soft text-primary"
              : isReduction
                ? "bg-success-soft text-success"
                : "bg-info-soft text-info"
          }`}
        >
          {entry.entryType === "open" ? (
            <ReceiptText aria-hidden="true" size={16} />
          ) : entry.entryType === "adjustment" ? (
            <Pencil aria-hidden="true" size={16} />
          ) : (
            <CircleCheck aria-hidden="true" size={16} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {ENTRY_LABELS[entry.entryType]}
          </p>
          <p className="mt-1 text-xs text-muted">
            <bdi>{formatDate(entry.occurredOn)}</bdi>
            {entry.financialEventId ? "، مرتبطة بمحفظة" : ""}
          </p>
          {entry.note ? (
            <p className="mt-1.5 text-xs leading-5 text-muted">{entry.note}</p>
          ) : null}
        </div>
      </div>
      <p
        className={`numeric text-left text-sm font-bold ${amountTone}`}
        dir="ltr"
      >
        {entry.amountMinor > 0n ? "+" : ""}
        {formatMinorAmount(entry.amountMinor, {
          currency: entry.currencyCode,
          locale: "en-US",
        })}
        <span className="ms-1.5 text-[10px] font-semibold text-muted">
          {entry.currencyCode}
        </span>
      </p>
    </li>
  );
}

export function DebtDetailPage() {
  const { debtId } = useParams();
  const { isDemo = false } = useWorkspace();
  const { debt, entries, isLoading, error, refresh } =
    useDebtDetailView(debtId);
  const {
    wallets,
    isLoading: financeLoading,
    walletsError,
    refresh: refreshFinance,
  } = useFinanceView();
  const postDemoEntry = useDebtStore((state) => state.postEntry);
  const addDemoTransaction = useFinanceStore((state) => state.addTransaction);
  const postEntry = usePostDebtEntryMutation(debtId ?? "");
  const submitIntentRef = useRef<SubmitIntent | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      entryType: "payment",
      amount: "",
      occurredOn: today,
      walletId: "",
      note: "",
    },
  });
  const selectedEntryType = useWatch({ control, name: "entryType" });
  const closed =
    debt?.status === "settled" || debt?.status === "written_off";
  const matchingWallets = debt
    ? wallets.filter((wallet) => wallet.currency === debt.currencyCode)
    : [];
  const isBusy = isSubmitting || postEntry.isPending;

  useEffect(() => {
    if (selectedEntryType !== "write_off" || !debt) return;
    setValue(
      "amount",
      formatMajorInputAmount(
        debt.balanceMinor,
        getCurrencyScale(debt.currencyCode),
      ),
      { shouldValidate: true },
    );
  }, [debt, selectedEntryType, setValue]);

  const onSubmit = async (values: EntryFormValues) => {
    if (!debt || !debtId || closed) return;

    let enteredMinor: bigint;
    try {
      enteredMinor = parseMajorAmount(
        values.amount,
        getCurrencyScale(debt.currencyCode),
      );
    } catch (submissionError) {
      setError(
        "amount",
        {
          type: "manual",
          message:
            submissionError instanceof Error
              ? submissionError.message
              : "أدخل مبلغًا صحيحًا",
        },
        { shouldFocus: true },
      );
      return;
    }

    if (
      values.entryType !== "adjustment" &&
      enteredMinor <= 0n
    ) {
      setError(
        "amount",
        { type: "manual", message: "أدخل مبلغًا أكبر من صفر" },
        { shouldFocus: true },
      );
      return;
    }
    if (values.entryType === "adjustment" && enteredMinor === 0n) {
      setError(
        "amount",
        { type: "manual", message: "مبلغ التعديل لا يمكن أن يكون صفرًا" },
        { shouldFocus: true },
      );
      return;
    }

    const signedAmount =
      values.entryType === "adjustment" ? enteredMinor : -enteredMinor;
    const nextBalance = debt.balanceMinor + signedAmount;
    if (nextBalance < 0n) {
      setError(
        "amount",
        { type: "manual", message: "لا يمكن أن تتجاوز الحركة الرصيد المتبقي" },
        { shouldFocus: true },
      );
      return;
    }
    if (
      values.entryType === "write_off" &&
      enteredMinor !== debt.balanceMinor
    ) {
      setError(
        "amount",
        { type: "manual", message: "يجب أن يساوي الشطب كامل الرصيد المتبقي" },
        { shouldFocus: true },
      );
      return;
    }

    const wallet =
      values.entryType === "payment"
        ? matchingWallets.find((candidate) => candidate.id === values.walletId)
        : undefined;
    if (
      wallet &&
      debt.direction === "payable" &&
      wallet.balanceMinor < enteredMinor
    ) {
      setError(
        "walletId",
        { type: "manual", message: "رصيد المحفظة غير كافٍ لهذه الدفعة" },
        { shouldFocus: true },
      );
      return;
    }

    const payload = {
      entryType: values.entryType,
      amountMinor: signedAmount,
      occurredOn: values.occurredOn,
      walletId: wallet?.id,
      note: values.note?.trim() || undefined,
    };
    const fingerprint = JSON.stringify({
      ...payload,
      amountMinor: signedAmount.toString(),
    });
    const previousIntent = submitIntentRef.current;
    const clientId =
      previousIntent?.fingerprint === fingerprint
        ? previousIntent.clientId
        : crypto.randomUUID();
    submitIntentRef.current = { fingerprint, clientId };

    try {
      if (isDemo) {
        const financialEventId = wallet ? crypto.randomUUID() : null;
        postDemoEntry({
          debtId,
          entryType: payload.entryType,
          amountMinor: signedAmount,
          occurredOn: payload.occurredOn,
          note: payload.note,
          clientId,
          financialEventId,
        });
        if (wallet && financialEventId) {
          addDemoTransaction({
            id: financialEventId,
            kind: debt.direction === "receivable" ? "income" : "expense",
            walletId: wallet.id,
            amountMinor: enteredMinor,
            currency: wallet.currency,
            title: `سداد دين: ${debt.partyName}`,
            occurredAt: `${payload.occurredOn}T12:00:00.000Z`,
            ...(debt.projectId ? { projectId: debt.projectId } : {}),
            ...(payload.note ? { note: payload.note } : {}),
          });
        }
      } else {
        await postEntry.mutateAsync({
          entryType: payload.entryType,
          amountMinor: toSafeMinorNumber(signedAmount),
          occurredOn: payload.occurredOn,
          walletId: payload.walletId,
          note: payload.note,
          clientId,
        });
      }

      submitIntentRef.current = null;
      reset({
        entryType: "payment",
        amount: "",
        occurredOn: values.occurredOn,
        walletId: "",
        note: "",
      });
      toast.success("تم حفظ حركة الدين");
    } catch (submissionError) {
      toast.error(
        getUserErrorMessage(submissionError, "تعذر حفظ حركة الدين"),
      );
    }
  };

  const pageError = error ?? walletsError;

  if (isLoading || financeLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <PageHeader
          title="تفاصيل الدين"
          subtitle="جاري تحميل الرصيد والحركات."
          backTo="/debts"
        />
        <div className="space-y-4" role="status">
          <div className="h-44 animate-pulse rounded-md bg-surface-subtle motion-reduce:animate-none" />
          <div className="h-72 animate-pulse rounded-md bg-surface-subtle motion-reduce:animate-none" />
          <span className="sr-only">جاري تحميل تفاصيل الدين</span>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <PageHeader
          title="تفاصيل الدين"
          subtitle="تعذر تحميل الرصيد والحركات."
          backTo="/debts"
        />
        <ErrorState
          message={pageError}
          onRetry={() => void Promise.all([refresh(), refreshFinance()])}
        />
      </div>
    );
  }

  if (!debt) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <PageHeader
          title="الدين غير موجود"
          subtitle="قد يكون الرابط غير صحيح أو لم يعد السجل متاحًا."
          backTo="/debts"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6" dir="rtl">
      <PageHeader
        title={debt.partyName}
        subtitle={
          debt.direction === "receivable"
            ? "مبلغ مستحق لك"
            : "مبلغ مستحق عليك"
        }
        backTo="/debts"
        action={
          <Badge tone={STATUS_TONES[debt.status]}>
            {STATUS_LABELS[debt.status]}
          </Badge>
        }
      />

      <AppCard
        aria-label="الرصيد المتبقي"
        className="mb-5 overflow-hidden rounded-[22px] border-line shadow-[0_12px_32px_rgb(27_30_60/6%)]"
        elevated
      >
        <div
          className={[
            "relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6",
            debt.direction === "receivable"
              ? "bg-[linear-gradient(145deg,rgb(16_185_129/12%),rgb(67_56_202/6%))]"
              : "bg-[linear-gradient(145deg,rgb(245_158_11/14%),rgb(67_56_202/6%))]",
          ].join(" ")}
        >
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-muted">
                الرصيد المتبقي
              </p>
              <p className="mt-2 flex flex-wrap items-baseline gap-2">
                <strong
                  className="numeric text-[34px] leading-none font-black tracking-tight text-ink sm:text-[40px]"
                  dir="ltr"
                >
                  {formatMinorAmount(debt.balanceMinor, {
                    currency: debt.currencyCode,
                    locale: "en-US",
                  })}
                </strong>
                <span className="text-xs font-bold text-muted">
                  {debt.currencyCode}
                </span>
              </p>
              <p className="mt-3 text-xs text-muted">
                من أصل{" "}
                <bdi className="numeric font-semibold text-ink">
                  {formatMinorAmount(debt.principalMinor, {
                    currency: debt.currencyCode,
                    locale: "en-US",
                  })}
                </bdi>
              </p>
            </div>
            <span
              className={[
                "grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ring-inset",
                debt.direction === "receivable"
                  ? "bg-success-soft text-success ring-success/20"
                  : "bg-warning-soft text-warning ring-warning/20",
              ].join(" ")}
            >
              <Scale aria-hidden="true" size={22} strokeWidth={1.7} />
            </span>
          </div>
          {debt.principalMinor > 0n && debt.status !== "written_off" ? (
            <div className="relative mt-5">
              <div className="mb-1.5 flex justify-between text-[10px] text-muted">
                <span>نسبة التسديد</span>
                <span className="numeric font-bold" dir="ltr">
                  {Math.max(
                    0,
                    Math.min(
                      100,
                      Number(
                        ((debt.principalMinor - debt.balanceMinor) * 100n) /
                          debt.principalMinor,
                      ),
                    ),
                  )}
                  %
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface/70">
                <div
                  className={[
                    "h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                    debt.direction === "receivable" ? "bg-success" : "bg-warning",
                  ].join(" ")}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        Number(
                          ((debt.principalMinor - debt.balanceMinor) * 100n) /
                            debt.principalMinor,
                        ),
                      ),
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <dl className="grid border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-x-reverse sm:divide-line">
          <div className="px-5 py-3.5">
            <dt className="text-[11px] text-muted">الاستحقاق</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {debt.dueOn ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock size={13} className="text-muted" />
                  <bdi>{formatDate(debt.dueOn)}</bdi>
                </span>
              ) : (
                "غير محدد"
              )}
            </dd>
          </div>
          <div className="border-t border-line px-5 py-3.5 sm:border-t-0">
            <dt className="text-[11px] text-muted">المشروع</dt>
            <dd className="mt-1 text-sm font-semibold text-ink">
              {debt.projectName ?? "دون مشروع"}
            </dd>
          </div>
          <div className="border-t border-line px-5 py-3.5 sm:border-t-0">
            <dt className="text-[11px] text-muted">الهاتف</dt>
            <dd className="numeric mt-1 text-sm font-semibold text-ink">
              {debt.partyPhone ?? "غير مسجل"}
            </dd>
          </div>
        </dl>
      </AppCard>

      {debt.note ? (
        <p className="mb-5 rounded-sm bg-surface-subtle px-4 py-3 text-sm leading-6 text-muted">
          {debt.note}
        </p>
      ) : null}

      {closed ? (
        <AppCard className="mb-6 flex items-start gap-3 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-success-soft text-success">
            <CircleCheck aria-hidden="true" size={19} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">هذا الدين مغلق</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              لا يمكن إضافة حركات جديدة بعد التسديد أو الشطب.
            </p>
          </div>
        </AppCard>
      ) : (
        <AppCard className="mb-6 p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-ink">إضافة حركة</h2>
            <p className="mt-1 text-xs text-muted">
              السجل تراكمي، ولا يمكن تعديل الحركة بعد حفظها.
            </p>
          </div>

          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void handleSubmit(onSubmit)(event)}
          >
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                نوع الحركة
              </span>
              <select className={inputClassName} {...register("entryType")}>
                <option value="payment">دفعة</option>
                <option value="adjustment">تعديل الرصيد</option>
                <option value="write_off">شطب كامل</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 flex items-center justify-between gap-2 text-sm font-bold text-ink">
                <span>مبلغ الحركة</span>
                <span className="text-xs font-semibold text-muted">
                  {debt.currencyCode}
                </span>
              </span>
              <input
                className={`${inputClassName} numeric text-left`}
                aria-label="مبلغ الحركة"
                aria-invalid={errors.amount ? "true" : undefined}
                aria-describedby={
                  errors.amount ? "debt-entry-amount-error" : undefined
                }
                dir="ltr"
                inputMode="decimal"
                placeholder={
                  selectedEntryType === "adjustment"
                    ? "استخدم - للتخفيض"
                    : "0"
                }
                readOnly={selectedEntryType === "write_off"}
                {...register("amount")}
              />
              {errors.amount ? (
                <p
                  id="debt-entry-amount-error"
                  className="mt-1.5 text-xs font-semibold text-danger"
                >
                  {errors.amount.message}
                </p>
              ) : selectedEntryType === "adjustment" ? (
                <p className="mt-1.5 text-xs text-muted">
                  الموجب يزيد الرصيد والسالب يخفضه.
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-ink">
                تاريخ الحركة
              </span>
              <input
                type="date"
                className={`${inputClassName} numeric text-left`}
                aria-invalid={errors.occurredOn ? "true" : undefined}
                aria-describedby={
                  errors.occurredOn ? "debt-entry-occurred-on-error" : undefined
                }
                dir="ltr"
                {...register("occurredOn")}
              />
              {errors.occurredOn ? (
                <p
                  id="debt-entry-occurred-on-error"
                  className="mt-1.5 text-xs font-semibold text-danger"
                  role="alert"
                >
                  {errors.occurredOn.message}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
                <WalletCards aria-hidden="true" size={16} />
                المحفظة (اختياري)
              </span>
              <select
                className={inputClassName}
                disabled={selectedEntryType !== "payment"}
                aria-invalid={errors.walletId ? "true" : undefined}
                aria-describedby={
                  errors.walletId ? "debt-entry-wallet-error" : undefined
                }
                {...register("walletId")}
              >
                <option value="">تسجيل دون حركة محفظة</option>
                {matchingWallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name}
                  </option>
                ))}
              </select>
              {errors.walletId ? (
                <p
                  id="debt-entry-wallet-error"
                  className="mt-1.5 text-xs font-semibold text-danger"
                >
                  {errors.walletId.message}
                </p>
              ) : null}
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-2 block text-sm font-bold text-ink">
                ملاحظة (اختياري)
              </span>
              <textarea
                className="min-h-24 w-full resize-y rounded-md border border-control-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-muted"
                aria-invalid={errors.note ? "true" : undefined}
                aria-describedby={
                  errors.note ? "debt-entry-note-error" : undefined
                }
                placeholder="مرجع الدفعة أو سبب التعديل"
                {...register("note")}
              />
              {errors.note ? (
                <p
                  id="debt-entry-note-error"
                  className="mt-1.5 text-xs font-semibold text-danger"
                >
                  {errors.note.message}
                </p>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={isBusy}
              className="pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-primary px-5 text-sm font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
            >
              <Save aria-hidden="true" size={18} />
              {isBusy ? "جارٍ الحفظ…" : "حفظ الحركة"}
            </button>
          </form>
        </AppCard>
      )}

      <section aria-labelledby="debt-timeline-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="debt-timeline-title" className="text-lg font-bold text-ink">
              سجل الحركات
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              تسلسل ثابت من الأحدث إلى الأقدم
            </p>
          </div>
          <span className="numeric text-xs font-semibold text-muted">
            {entries.length}
          </span>
        </div>

        {entries.length === 0 ? (
          <AppCard className="p-6 text-center">
            <CalendarClock
              aria-hidden="true"
              className="mx-auto text-muted"
              size={22}
            />
            <p className="mt-3 text-sm font-bold text-ink">لا حركات بعد</p>
          </AppCard>
        ) : (
          <AppCard className="overflow-hidden p-0">
            <ol className="divide-y divide-line">
              {entries.map((entry) => (
                <EntryTimelineRow key={entry.id} entry={entry} />
              ))}
            </ol>
          </AppCard>
        )}
      </section>
    </div>
  );
}
