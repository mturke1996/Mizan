import {
  Copy,
  Download,
  Mail,
  Pencil,
  Share2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  formatMajorInputAmount,
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  buildInvoiceWhatsAppText,
  downloadInvoicePdf,
  shareInvoicePdf,
} from "@/features/pdf/lazyPdf";
import {
  useInvoiceDetailQuery,
  useRecordInvoicePaymentMutation,
  useSetInvoiceStatusMutation,
  useWalletsQuery,
} from "@/features/workspace/use-finance-data";
import { EMPTY_WORKSPACE_BRAND } from "@/features/workspace/workspace-api";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type {
  Invoice,
  InvoicePaymentMethod,
  InvoiceStatus,
} from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge, type BadgeTone } from "@/shared/ui/Badge";
import { ErrorState } from "@/shared/ui/ErrorState";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  canCollectPayment,
  canEditInvoice,
  getInvoicePaymentSummary,
  METHOD_LABELS,
} from "./invoicePayments";
import { InvoicePreviewFrame, PrintableInvoice } from "./PrintableInvoice";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "مسودة",
  sent: "مُرسلة",
  paid: "مدفوعة",
  partially_paid: "مدفوعة جزئيًا",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

const STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  sent: "info",
  paid: "success",
  partially_paid: "warning",
  overdue: "danger",
  cancelled: "neutral",
};

const STATUS_ACTIONS: ReadonlyArray<{
  status: InvoiceStatus;
  label: string;
}> = [
  { status: "draft", label: "مسودة" },
  { status: "sent", label: "إرسال للعميل" },
  { status: "cancelled", label: "إلغاء" },
];

const PAYMENT_METHODS: InvoicePaymentMethod[] = [
  "cash",
  "bank_transfer",
  "check",
  "mobile_payment",
  "other",
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("ar-LY", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams();
  const { membership } = useWorkspace();
  const detailQuery = useInvoiceDetailQuery(invoiceId);
  const walletsQuery = useWalletsQuery();
  const setStatus = useSetInvoiceStatusMutation(invoiceId ?? "");
  const recordPayment = useRecordInvoicePaymentMutation(invoiceId ?? "");
  const confirm = useConfirm();
  const [pdfBusy, setPdfBusy] = useState<"download" | "share" | null>(null);

  const invoice = detailQuery.data;
  const items = invoice?.items ?? [];
  const payments = invoice?.payments ?? [];
  const brand = membership?.brand ?? EMPTY_WORKSPACE_BRAND;
  const workspaceName = membership?.workspaceName ?? "ميزان";
  const wallets = walletsQuery.data ?? [];

  const summary = useMemo(
    () =>
      invoice
        ? getInvoicePaymentSummary(invoice)
        : { paidMinor: 0n, remainingMinor: 0n, progressPct: 0 },
    [invoice],
  );

  const scale = invoice ? getCurrencyScale(invoice.currencyCode) : 2;
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState("");
  const [method, setMethod] = useState<InvoicePaymentMethod>("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const defaultsReadyFor = useRef<string | null>(null);

  useEffect(() => {
    if (!invoice) return;
    if (defaultsReadyFor.current !== invoice.id) {
      defaultsReadyFor.current = invoice.id;
      if (summary.remainingMinor > 0n) {
        setAmount(formatMajorInputAmount(summary.remainingMinor, scale));
      }
    }
    if (!walletId && wallets[0]) {
      setWalletId(wallets[0].id);
    }
  }, [invoice, scale, summary.remainingMinor, walletId, wallets]);

  if (detailQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="الفاتورة" backTo="/invoices" />
        <AppCard
          role="status"
          className="h-48 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="الفاتورة" backTo="/invoices" />
        <ErrorState
          title="تعذر تحميل الفاتورة"
          message={getUserErrorMessage(detailQuery.error, "تعذر تحميل الفاتورة")}
          onRetry={() => void detailQuery.refetch()}
        />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="الفاتورة غير موجودة" backTo="/invoices" />
      </div>
    );
  }

  const money = { currency: invoice.currencyCode, locale: "en-US" as const };
  const editable = canEditInvoice(invoice);
  const collectable = canCollectPayment(invoice);
  const shareText = buildInvoiceWhatsAppText(invoice, workspaceName);
  const inputClass =
    "w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted";

  const handleStatus = async (status: InvoiceStatus) => {
    if (status === "cancelled") {
      const ok = await confirm({
        title: "إلغاء الفاتورة؟",
        description: "لن تستطيع تسجيل دفعات بعد ذلك.",
        tone: "warning",
        confirmLabel: "إلغاء الفاتورة",
      });
      if (!ok) return;
    }
    try {
      await setStatus.mutateAsync(status);
      toast.success(`تم تحديث الحالة إلى ${STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر تحديث حالة الفاتورة"));
    }
  };

  const ensureReadyToShare = async (): Promise<Invoice | null> => {
    if (invoice.status !== "draft") return invoice;
    const ok = await confirm({
      title: "الفاتورة ما زالت مسودة",
      description: "هل تريد وضعها كمُرسلة قبل المشاركة مع العميل؟",
      confirmLabel: "وضع كمُرسلة",
    });
    if (!ok) return null;
    try {
      const updated = await setStatus.mutateAsync("sent");
      toast.success("تم وضع الفاتورة كمُرسلة");
      return { ...invoice, ...updated, items: invoice.items, payments: invoice.payments };
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر تحديث حالة الفاتورة"));
      return null;
    }
  };

  const handleDownload = async () => {
    setPdfBusy("download");
    try {
      const ready = await ensureReadyToShare();
      if (!ready) return;
      await downloadInvoicePdf(ready, { brand, workspaceName });
    } catch {
      // toast handled in pdfService
    } finally {
      setPdfBusy(null);
    }
  };

  const handleShare = async () => {
    setPdfBusy("share");
    try {
      const ready = await ensureReadyToShare();
      if (!ready) return;
      await shareInvoicePdf(ready, {
        brand,
        workspaceName,
        text: buildInvoiceWhatsAppText(ready, workspaceName),
      });
    } catch {
      // toast handled in pdfService
    } finally {
      setPdfBusy(null);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("تم نسخ ملخص الفاتورة");
    } catch {
      toast.error("تعذر نسخ الملخص");
    }
  };

  const handleWhatsAppText = () => {
    const digits = (invoice.clientPhone ?? "").replace(/\D/g, "");
    const base = digits
      ? `https://wa.me/${digits}?text=`
      : "https://wa.me/?text=";
    window.open(
      `${base}${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleMailto = () => {
    const subject = encodeURIComponent(`فاتورة ${invoice.invoiceNumber}`);
    const body = encodeURIComponent(shareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleRecordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentError(null);
    if (!walletId) {
      setPaymentError("اختر المحفظة");
      return;
    }
    let amountMinor: bigint;
    try {
      amountMinor = parseMajorAmount(amount, scale);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "أدخل مبلغًا صالحًا",
      );
      return;
    }
    if (amountMinor <= 0n) {
      setPaymentError("المبلغ يجب أن يكون أكبر من صفر");
      return;
    }
    if (amountMinor > summary.remainingMinor) {
      setPaymentError("المبلغ أكبر من المتبقي");
      return;
    }

    try {
      await recordPayment.mutateAsync({
        amountMinor: toSafeMinorNumber(amountMinor),
        walletId,
        method,
        notes: paymentNotes.trim() || undefined,
      });
      toast.success("تم تسجيل الدفعة");
      setPaymentNotes("");
      setAmount(
        formatMajorInputAmount(
          summary.remainingMinor - amountMinor > 0n
            ? summary.remainingMinor - amountMinor
            : 0n,
          scale,
        ),
      );
    } catch (error) {
      setPaymentError(
        getUserErrorMessage(error, "تعذر تسجيل دفعة الفاتورة"),
      );
    }
  };

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <PageHeader
        title={invoice.invoiceNumber}
        subtitle={invoice.clientName}
        backTo="/invoices"
        action={
          <Badge tone={STATUS_TONES[invoice.status]}>
            {STATUS_LABELS[invoice.status]}
          </Badge>
        }
      />

      <AppCard className="mb-4 overflow-hidden rounded-[18px] p-0">
        <div className="bg-[linear-gradient(135deg,rgb(67_56_202/12%),rgb(99_102_241/4%))] px-5 py-5">
          <p className="text-xs font-semibold text-muted">إجمالي الفاتورة</p>
          <p className="numeric mt-1 text-2xl font-black text-ink" dir="ltr">
            {formatMinorAmount(invoice.totalMinor, money)}
            <span className="ms-1 text-sm font-bold text-muted">
              {invoice.currencyCode}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span>الإصدار: {formatDate(invoice.issueOn)}</span>
            <span>الاستحقاق: {formatDate(invoice.dueOn)}</span>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-muted">تحصيل</span>
              <span className="font-bold text-ink">{summary.progressPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${summary.progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted">
              <span>
                مدفوع:{" "}
                <span className="numeric font-bold text-success" dir="ltr">
                  {formatMinorAmount(summary.paidMinor, money)}
                </span>
              </span>
              <span>
                متبقي:{" "}
                <span className="numeric font-bold text-warning" dir="ltr">
                  {formatMinorAmount(summary.remainingMinor, money)}
                </span>
              </span>
            </div>
          </div>
        </div>
      </AppCard>

      {invoice.status === "draft" ? (
        <AppCard className="mb-4 rounded-[18px] border-primary/25 bg-primary-soft/40 p-4">
          <p className="text-sm font-bold text-ink">الخطوات التالية</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            ① راجع الفاتورة ← ② اضغط «إرسال للعميل» ← ③ شارك PDF أو سجّل الدفعة
          </p>
          <button
            type="button"
            disabled={setStatus.isPending}
            onClick={() => void handleStatus("sent")}
            className="pressable mt-3 inline-flex min-h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-on disabled:opacity-50"
          >
            إرسال للعميل الآن
          </button>
        </AppCard>
      ) : null}

      {!brand.logoUrl && !brand.phone && !brand.address ? (
        <AppCard className="mb-4 rounded-[18px] border-line bg-surface-subtle p-4">
          <p className="text-xs leading-5 text-muted">
            أضف شعارك وبيانات نشاطك لتظهر على الفاتورة من{" "}
            <Link
              to="/settings/business"
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              الإعدادات ← بيانات المنشأة
            </Link>
          </p>
        </AppCard>
      ) : null}

      <div className="no-print mb-4 space-y-2">
        <p className="text-[11px] font-bold text-muted">إرسال للعميل</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={pdfBusy !== null}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-on disabled:opacity-50"
          >
            <Share2 size={15} />
            {pdfBusy === "share" ? "جاري المشاركة…" : "مشاركة PDF"}
          </button>
          <button
            type="button"
            onClick={handleWhatsAppText}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-success-soft text-xs font-bold text-success"
          >
            ملخص واتساب
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={pdfBusy !== null}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-ink disabled:opacity-50"
          >
            <Download size={15} />
            {pdfBusy === "download" ? "جاري التنزيل…" : "تنزيل PDF"}
          </button>
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-surface-subtle text-xs font-bold text-ink"
          >
            <Copy size={15} />
            نسخ الملخص
          </button>
        </div>
        <p className="text-[10px] leading-4 text-muted">
          لإرسال ملف PDF للعميل استخدم «مشاركة PDF». ملخص واتساب نص فقط بدون
          مرفق.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {editable ? (
            <Link
              to={`/invoices/${encodeURIComponent(invoice.id)}/edit`}
              className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-ink"
            >
              <Pencil size={14} />
              تعديل
            </Link>
          ) : null}
          <button
            type="button"
            onClick={handleMailto}
            className="pressable inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted"
          >
            <Mail size={14} />
            بريد نصي
          </button>
        </div>
      </div>

      <AppCard className="no-print mb-4 rounded-[18px] p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-bold text-ink">حالة الفاتورة</h2>
        <p className="mb-3 text-[11px] text-muted">
          التحصيل يحدّث الحالة تلقائيًا عند تسجيل دفعة في المحفظة.
        </p>
        <div className="flex flex-wrap gap-2">
          {STATUS_ACTIONS.map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={
                setStatus.isPending || invoice.status === action.status
              }
              onClick={() => void handleStatus(action.status)}
              className={[
                "pressable rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40",
                invoice.status === action.status
                  ? "bg-primary text-primary-on"
                  : "bg-surface-subtle text-muted hover:text-ink",
              ].join(" ")}
            >
              {action.label}
            </button>
          ))}
        </div>
      </AppCard>

      {collectable ? (
        <AppCard className="no-print mb-4 rounded-[18px] p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">تسجيل دفعة</h2>
          {wallets.length === 0 ? (
            <div className="rounded-xl bg-surface-subtle px-4 py-5 text-center">
              <p className="text-sm font-semibold text-ink">
                أنشئ محفظة أولًا لتسجيل الدفعة
              </p>
              <p className="mt-1 text-xs text-muted">
                الدفعة تدخل رصيد المحفظة تلقائيًا
              </p>
              <Link
                to="/wallets/new"
                className="pressable mt-3 inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-on"
              >
                إنشاء محفظة
              </Link>
            </div>
          ) : (
            <form
              onSubmit={(event) => void handleRecordPayment(event)}
              className="space-y-3"
            >
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-ink">
                    المبلغ ({invoice.currencyCode})
                  </label>
                  {summary.remainingMinor > 0n ? (
                    <button
                      type="button"
                      onClick={() =>
                        setAmount(
                          formatMajorInputAmount(summary.remainingMinor, scale),
                        )
                      }
                      className="pressable rounded-lg bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary"
                    >
                      المتبقي بالكامل
                    </button>
                  ) : null}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={`numeric ${inputClass}`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  المحفظة
                </label>
                <select
                  value={walletId}
                  onChange={(event) => setWalletId(event.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">اختر محفظة</option>
                  {wallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  طريقة الدفع
                </label>
                <select
                  value={method}
                  onChange={(event) =>
                    setMethod(event.target.value as InvoicePaymentMethod)
                  }
                  className={inputClass}
                >
                  {PAYMENT_METHODS.map((value) => (
                    <option key={value} value={value}>
                      {METHOD_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  ملاحظات
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
                  className={inputClass}
                  placeholder="اختياري"
                />
              </div>
              <button
                type="submit"
                disabled={recordPayment.isPending}
                className="pressable w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-on disabled:opacity-50"
              >
                {recordPayment.isPending ? "جاري التسجيل…" : "تسجيل الدفعة"}
              </button>
              {paymentError ? (
                <p className="text-center text-xs text-danger">{paymentError}</p>
              ) : null}
            </form>
          )}
        </AppCard>
      ) : null}

      <AppCard className="no-print mb-4 rounded-[18px] p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-bold text-ink">سجل المدفوعات</h2>
        {payments.length === 0 ? (
          <p className="text-xs text-muted">
            {collectable
              ? "لا توجد مدفوعات بعد — سجّل أول دفعة بالنموذج أعلاه"
              : "لا توجد مدفوعات بعد"}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {METHOD_LABELS[payment.method]}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {formatDate(payment.paidOn)}
                    {payment.notes ? ` · ${payment.notes}` : ""}
                  </p>
                </div>
                <p
                  className="numeric shrink-0 text-sm font-bold text-success"
                  dir="ltr"
                >
                  {formatMinorAmount(payment.amountMinor, money)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AppCard>

      <AppCard className="no-print mb-4 rounded-[18px] p-4 sm:p-5">
        <h2 className="mb-1 text-sm font-bold text-ink">العميل</h2>
        <p className="text-sm font-semibold text-ink">{invoice.clientName}</p>
        {invoice.clientPhone ? (
          <p className="mt-1 text-xs text-muted" dir="ltr">
            {invoice.clientPhone}
          </p>
        ) : null}
      </AppCard>

      <AppCard className="no-print mb-4 overflow-hidden rounded-[18px] p-0">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-ink">البنود</h2>
        </div>
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {item.description}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  الكمية {item.quantity} ×{" "}
                  <span className="numeric" dir="ltr">
                    {formatMinorAmount(item.unitPriceMinor, money)}
                  </span>
                </p>
              </div>
              <p className="numeric shrink-0 text-sm font-bold text-ink" dir="ltr">
                {formatMinorAmount(item.lineTotalMinor, money)}
              </p>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-line bg-surface-subtle/60 px-4 py-3 text-xs">
          <div className="flex justify-between text-muted">
            <span>المجموع الفرعي</span>
            <span className="numeric" dir="ltr">
              {formatMinorAmount(invoice.subtotalMinor, money)}
            </span>
          </div>
          <div className="flex justify-between text-muted">
            <span>الضريبة ({invoice.taxRatePercent}%)</span>
            <span className="numeric" dir="ltr">
              {formatMinorAmount(invoice.taxMinor, money)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-black text-ink">
            <span>الإجمالي</span>
            <span className="numeric" dir="ltr">
              {formatMinorAmount(invoice.totalMinor, money)}
            </span>
          </div>
        </div>
      </AppCard>

      {invoice.notes ? (
        <AppCard className="no-print mb-4 rounded-[18px] p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-bold text-ink">ملاحظات</h2>
          <p className="text-sm leading-6 text-muted">{invoice.notes}</p>
        </AppCard>
      ) : null}

      <div className="mb-8">
        <InvoicePreviewFrame>
          <PrintableInvoice
            invoice={invoice}
            brand={brand}
            workspaceName={workspaceName}
            logoUrl={brand.logoUrl}
          />
        </InvoicePreviewFrame>
      </div>
    </div>
  );
}
