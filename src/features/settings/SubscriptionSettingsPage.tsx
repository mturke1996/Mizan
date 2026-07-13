import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Upload,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { formatMinorAmount } from "@/domain/money/money";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  formatDateAr,
  statusTone,
  subscriptionStatusLabel,
} from "@/features/supervisor/supervisor-utils";
import {
  attachPaymentProof,
  createPaymentRequestWithProof,
  fetchSubscriptionSummary,
  type PaymentRequest,
  type SubscriptionPlan,
  validatePaymentProof,
} from "./settings-api";

const requestStatusLabel: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

const requestStatusTone: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
  cancelled: "bg-surface-subtle text-muted",
};

function planLabel(plan: SubscriptionPlan): string {
  if (plan.billing_interval === "monthly") return "خطة شهرية";
  if (plan.billing_interval === "yearly") return "خطة سنوية";
  return plan.name;
}

function ProofAttachment({
  request,
  workspaceId,
}: {
  request: PaymentRequest;
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      attachPaymentProof({
        workspaceId,
        requestId: request.id,
        file: file!,
      }),
    onSuccess: async () => {
      toast.success("تم إرفاق إثبات الدفع");
      setFile(null);
      await queryClient.invalidateQueries({
        queryKey: ["settings-subscription", workspaceId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "تعذر إرفاق إثبات الدفع",
      );
    },
  });

  return (
    <div className="mt-3 rounded-sm bg-warning-soft p-3">
      <p className="text-xs font-bold text-warning">
        الطلب لم يكتمل: أرفق إثبات الدفع ليتمكن المدير من مراجعته.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="pressable inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-warning/25 bg-surface px-3 text-xs font-bold text-ink">
          <Upload aria-hidden="true" size={15} />
          {file ? file.name : "اختيار الملف"}
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="sr-only"
            onChange={(event) => {
              const next = event.target.files?.[0] ?? null;
              setFile(next);
              setFileError(next ? validatePaymentProof(next) ?? "" : "");
            }}
          />
        </label>
        <button
          type="button"
          disabled={!file || Boolean(fileError) || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="pressable min-h-11 rounded-sm bg-warning px-3 text-xs font-bold text-warning-on disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? "جاري الرفع…" : "إرفاق"}
        </button>
      </div>
      {fileError ? (
        <p className="mt-2 text-xs font-semibold text-danger">{fileError}</p>
      ) : null}
    </div>
  );
}

export function SubscriptionSettingsPage() {
  const { workspaceId, membership } = useWorkspace();
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [periodCount, setPeriodCount] = useState(1);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["settings-subscription", workspaceId],
    queryFn: () => fetchSubscriptionSummary(workspaceId!),
    enabled: Boolean(workspaceId),
  });

  const effectivePlanId =
    planId || summaryQuery.data?.availablePlans[0]?.id || "";

  const selectedPlan = useMemo(
    () =>
      summaryQuery.data?.availablePlans.find(
        (plan) => plan.id === effectivePlanId,
      ) ?? null,
    [effectivePlanId, summaryQuery.data?.availablePlans],
  );
  const pendingRequest = summaryQuery.data?.requests.find(
    (request) => request.status === "pending",
  );

  const createRequest = useMutation({
    mutationFn: () =>
      createPaymentRequestWithProof({
        workspaceId: workspaceId!,
        planId: effectivePlanId,
        periodCount,
        note,
        file: file!,
      }),
    onSuccess: async () => {
      setFile(null);
      setFileError("");
      setNote("");
      toast.success("أُرسل طلب الدفع وإثباته للمراجعة");
      await queryClient.invalidateQueries({
        queryKey: ["settings-subscription", workspaceId],
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "تعذر إرسال طلب الدفع",
      );
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId || !effectivePlanId || !file) {
      setFileError(file ? "" : "إثبات الدفع مطلوب لإرسال الطلب");
      return;
    }
    const validationError = validatePaymentProof(file);
    if (validationError) {
      setFileError(validationError);
      return;
    }
    createRequest.mutate();
  }

  const subscription = summaryQuery.data?.subscription;
  const endDate =
    subscription?.trial_ends_at ??
    subscription?.current_period_ends_at ??
    subscription?.grace_ends_at;

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="الاشتراك والفوترة"
        subtitle="حالة حقيقية، خطط متاحة، وطلبات دفع قابلة للتتبع."
        backTo="/settings"
      />

      {!workspaceId ? (
        <AppCard className="p-5 text-center">
          <p className="font-bold text-ink">لا توجد مساحة عمل مرتبطة</p>
          <p className="mt-2 text-sm text-muted">
            أعد تحميل الحساب قبل إدارة الاشتراك.
          </p>
        </AppCard>
      ) : summaryQuery.isLoading ? (
        <div className="space-y-3" role="status">
          <AppCard className="h-36 animate-pulse bg-surface-subtle" />
          <AppCard className="h-52 animate-pulse bg-surface-subtle" />
          <span className="sr-only">جاري تحميل الاشتراك</span>
        </div>
      ) : summaryQuery.isError ? (
        <AppCard className="p-5">
          <p className="font-bold text-danger">تعذر تحميل الاشتراك</p>
          <p className="mt-2 text-sm text-muted">
            {summaryQuery.error instanceof Error
              ? summaryQuery.error.message
              : "حاول مرة أخرى"}
          </p>
          <button
            type="button"
            onClick={() => void summaryQuery.refetch()}
            className="pressable mt-4 min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
          >
            إعادة المحاولة
          </button>
        </AppCard>
      ) : (
        <>
          <AppCard className="mb-5 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
                <CreditCard aria-hidden="true" size={21} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-bold text-ink">
                    {summaryQuery.data?.currentPlan
                      ? planLabel(summaryQuery.data.currentPlan)
                      : subscription?.status === "trialing"
                        ? "الفترة التجريبية"
                        : "حالة الاشتراك"}
                  </h2>
                  <span
                    className={`rounded-xs px-2 py-1 text-[11px] font-bold ${statusTone(subscription?.status)}`}
                  >
                    {subscriptionStatusLabel[subscription?.status ?? ""] ??
                      "غير متاح"}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  المساحة: {membership?.workspaceName ?? "—"}
                </p>
                {endDate ? (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    <CalendarClock aria-hidden="true" size={14} />
                    التاريخ المرتبط بالحالة: {formatDateAr(endDate)}
                  </p>
                ) : null}
              </div>
            </div>
          </AppCard>

          {pendingRequest ? (
            <AppCard className="mb-5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-warning-soft text-warning">
                  <AlertTriangle aria-hidden="true" size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-ink">طلب قيد المراجعة</h2>
                  <p className="numeric mt-1 text-sm font-bold text-ink">
                    {formatMinorAmount(BigInt(pendingRequest.amount_minor), {
                      currency: pendingRequest.currency_code,
                      locale: "en-US",
                    })}{" "}
                    {pendingRequest.currency_code}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    أُنشئ في {formatDateAr(pendingRequest.created_at)}
                  </p>
                  {!pendingRequest.proof_object_path ? (
                    <ProofAttachment
                      request={pendingRequest}
                      workspaceId={workspaceId}
                    />
                  ) : (
                    <p className="mt-3 flex items-center gap-2 text-xs font-bold text-success">
                      <FileCheck2 aria-hidden="true" size={16} />
                      إثبات الدفع مرفق بأمان
                    </p>
                  )}
                </div>
              </div>
            </AppCard>
          ) : summaryQuery.data?.availablePlans.length ? (
            <form onSubmit={handleSubmit}>
              <AppCard className="mb-5 space-y-5 p-4 sm:p-5">
                <div>
                  <h2 className="font-bold text-ink">طلب تفعيل أو تجديد</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    سيحسب المبلغ من الخطة والفترة، ثم يراجع المدير إثبات الدفع.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="subscription-plan"
                    className="mb-2 block text-sm font-bold text-ink"
                  >
                    الخطة
                  </label>
                  <select
                    id="subscription-plan"
                    value={effectivePlanId}
                    onChange={(event) => setPlanId(event.target.value)}
                    className="min-h-12 w-full rounded-sm border border-line-strong bg-surface px-4 text-ink"
                  >
                    {summaryQuery.data.availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {planLabel(plan)} —{" "}
                        {formatMinorAmount(BigInt(plan.price_minor), {
                          currency: plan.currency_code,
                          locale: "en-US",
                        })}{" "}
                        {plan.currency_code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="period-count"
                    className="mb-2 block text-sm font-bold text-ink"
                  >
                    عدد الفترات
                  </label>
                  <input
                    id="period-count"
                    type="number"
                    min={1}
                    max={24}
                    value={periodCount}
                    onChange={(event) =>
                      setPeriodCount(
                        Math.min(24, Math.max(1, Number(event.target.value) || 1)),
                      )
                    }
                    className="numeric min-h-12 w-full rounded-sm border border-line-strong bg-surface px-4 text-left text-ink"
                  />
                </div>

                {selectedPlan ? (
                  <div className="rounded-sm bg-primary-soft p-3">
                    <p className="text-xs text-primary-ink">المبلغ المطلوب</p>
                    <p className="numeric mt-1 text-lg font-bold text-primary-ink">
                      {formatMinorAmount(
                        BigInt(selectedPlan.price_minor) * BigInt(periodCount),
                        {
                          currency: selectedPlan.currency_code,
                          locale: "en-US",
                        },
                      )}{" "}
                      {selectedPlan.currency_code}
                    </p>
                  </div>
                ) : null}

                <div>
                  <span className="mb-2 block text-sm font-bold text-ink">
                    إثبات الدفع
                  </span>
                  <label className="pressable flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-line-strong bg-surface-subtle px-4 text-sm font-bold text-ink">
                    <Upload aria-hidden="true" size={18} />
                    {file ? file.name : "اختيار JPG أو PNG أو PDF"}
                    <input
                      type="file"
                      aria-required="true"
                      accept="image/jpeg,image/png,application/pdf"
                      className="sr-only"
                      onChange={(event) => {
                        const next = event.target.files?.[0] ?? null;
                        setFile(next);
                        setFileError(
                          next ? validatePaymentProof(next) ?? "" : "",
                        );
                      }}
                    />
                  </label>
                  <p className="mt-2 text-xs text-muted">
                    الحد الأقصى 10 ميجابايت، والملف خاص بأعضاء المساحة والمدير.
                  </p>
                  {fileError ? (
                    <p className="mt-2 text-xs font-semibold text-danger">
                      {fileError}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="payment-note"
                    className="mb-2 block text-sm font-bold text-ink"
                  >
                    ملاحظة اختيارية
                  </label>
                  <textarea
                    id="payment-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="w-full resize-y rounded-sm border border-line-strong bg-surface px-4 py-3 text-ink placeholder:text-muted"
                    placeholder="رقم الحوالة أو أي توضيح للمراجعة"
                  />
                </div>
              </AppCard>

              <button
                type="submit"
                disabled={
                  !file ||
                  Boolean(fileError) ||
                  !selectedPlan ||
                  createRequest.isPending
                }
                className="pressable mb-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 aria-hidden="true" size={18} />
                {createRequest.isPending
                  ? "جاري الإرسال والرفع…"
                  : "إرسال الطلب للمراجعة"}
              </button>
            </form>
          ) : (
            <AppCard className="mb-5 p-5 text-center">
              <p className="font-bold text-ink">لا توجد خطط مدفوعة متاحة حاليًا</p>
            </AppCard>
          )}

          {(summaryQuery.data?.requests.length ?? 0) > 0 ? (
            <section aria-labelledby="payment-history-title">
              <h2
                id="payment-history-title"
                className="mb-3 text-sm font-bold text-ink"
              >
                سجل الطلبات
              </h2>
              <AppCard className="divide-y divide-line overflow-hidden">
                {summaryQuery.data?.requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="numeric text-sm font-bold text-ink">
                        {formatMinorAmount(BigInt(request.amount_minor), {
                          currency: request.currency_code,
                          locale: "en-US",
                        })}{" "}
                        {request.currency_code}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {formatDateAr(request.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-xs px-2 py-1 text-[11px] font-bold ${
                        requestStatusTone[request.status] ??
                        "bg-surface-subtle text-muted"
                      }`}
                    >
                      {requestStatusLabel[request.status] ?? request.status}
                    </span>
                  </div>
                ))}
              </AppCard>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
