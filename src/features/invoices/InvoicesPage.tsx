import { FileText, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "@/domain/money/money";
import {
  useInvoicesQuery,
  useRefreshOverdueInvoicesOnce,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { Invoice, InvoiceStatus } from "@/features/workspace/workspace-types";
import { MoneySectionTabs } from "@/shared/navigation/MoneySectionTabs";
import { AppCard } from "@/shared/ui/AppCard";
import { Badge, type BadgeTone } from "@/shared/ui/Badge";
import { PageHeader } from "@/shared/ui/PageHeader";
import { getInvoicePaymentSummary } from "./invoicePayments";

type InvoiceFilter = "all" | InvoiceStatus;

const FILTERS: ReadonlyArray<{ value: InvoiceFilter; label: string }> = [
  { value: "all", label: "الكل" },
  { value: "draft", label: "مسودة" },
  { value: "sent", label: "مُرسلة" },
  { value: "partially_paid", label: "جزئيًا" },
  { value: "overdue", label: "متأخرة" },
  { value: "paid", label: "مدفوعة" },
  { value: "cancelled", label: "ملغاة" },
];

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

function remainingMinor(invoice: Invoice): bigint {
  return getInvoicePaymentSummary(invoice).remainingMinor;
}

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("ar-LY", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(parsed);
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const money = { currency: invoice.currencyCode, locale: "en-US" as const };
  const remaining = remainingMinor(invoice);
  const showRemaining =
    remaining > 0n &&
    (invoice.status === "sent" ||
      invoice.status === "partially_paid" ||
      invoice.status === "overdue");

  return (
    <Link
      to={`/invoices/${encodeURIComponent(invoice.id)}`}
      className="block rounded-[18px] border border-line bg-surface p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <FileText aria-hidden="true" size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-ink">
                {invoice.clientName}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-muted" dir="ltr">
                {invoice.invoiceNumber}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[invoice.status]}>
              {STATUS_LABELS[invoice.status]}
            </Badge>
            <span className="text-[11px] text-muted">
              {formatDate(invoice.issueOn)}
            </span>
          </div>
        </div>
        <div className="text-left">
          <p className="text-[10px] text-muted">الإجمالي</p>
          <p className="numeric mt-0.5 text-base font-black text-ink" dir="ltr">
            {formatMinorAmount(invoice.totalMinor, money)}
          </p>
          {showRemaining ? (
            <p className="mt-1 text-[10px] font-bold text-warning">
              متبقي{" "}
              <span className="numeric" dir="ltr">
                {formatMinorAmount(remaining, money)}
              </span>
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] font-bold text-muted">
              {invoice.currencyCode}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function InvoicesPage() {
  const { currency } = useWorkspace();
  const invoicesQuery = useInvoicesQuery();
  const refreshOverdue = useRefreshOverdueInvoicesOnce();
  const refreshedRef = useRef(false);
  const [filter, setFilter] = useState<InvoiceFilter>("all");

  useEffect(() => {
    if (refreshedRef.current) return;
    if (!invoicesQuery.isSuccess) return;
    refreshedRef.current = true;
    void refreshOverdue.mutateAsync().catch(() => {
      // Non-blocking: list still usable if overdue refresh fails.
    });
    // Intentionally once per successful invoices load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate identity is unstable
  }, [invoicesQuery.isSuccess]);

  const invoices = invoicesQuery.data ?? [];
  const filtered = useMemo(() => {
    if (filter === "all") return invoices;
    return invoices.filter((invoice) => invoice.status === filter);
  }, [filter, invoices]);

  const openTotal = invoices
    .filter(
      (invoice) =>
        invoice.status === "sent" ||
        invoice.status === "overdue" ||
        invoice.status === "partially_paid",
    )
    .reduce((sum, invoice) => sum + remainingMinor(invoice), 0n);
  const paidTotal = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.totalMinor, 0n);
  const money = { currency, locale: "en-US" as const };
  const hasAnyInvoices = invoices.length > 0;

  if (invoicesQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <MoneySectionTabs active="invoices" />
        <PageHeader title="فواتير" subtitle="فواتير المبيعات" />
        <AppCard
          role="status"
          aria-label="جاري تحميل الفواتير"
          className="h-40 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <MoneySectionTabs active="invoices" />
      <PageHeader
        title="فواتير"
        subtitle="أنشئ وأرسل وتتبع فواتير عملائك"
        action={
          <Link
            to="/invoices/new"
            className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
          >
            <Plus aria-hidden="true" size={14} />
            فاتورة جديدة
          </Link>
        }
      />

      <AppCard className="mb-5 overflow-hidden rounded-[18px] p-0">
        <div className="grid grid-cols-2 gap-px bg-line/60">
          <div className="bg-[linear-gradient(135deg,rgb(67_56_202/12%),rgb(99_102_241/4%))] px-5 py-5">
            <p className="text-xs font-semibold text-muted">مستحق التحصيل</p>
            <p className="numeric mt-1 text-xl font-black text-ink" dir="ltr">
              {formatMinorAmount(openTotal, money)}
              <span className="ms-1 text-sm font-bold text-muted">{currency}</span>
            </p>
          </div>
          <div className="bg-surface px-5 py-5">
            <p className="text-xs font-semibold text-muted">مدفوع بالكامل</p>
            <p className="numeric mt-1 text-xl font-black text-success" dir="ltr">
              {formatMinorAmount(paidTotal, money)}
              <span className="ms-1 text-sm font-bold text-muted">{currency}</span>
            </p>
          </div>
        </div>
      </AppCard>

      <p className="mb-3 text-[11px] leading-5 text-muted">
        مسودة = لم تُرسل بعد · مُرسلة = جاهزة للمشاركة مع العميل
      </p>

      <div className="mb-4 flex gap-1.5 overflow-x-auto border-b border-line pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={[
              "pressable -mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-bold transition-colors",
              filter === item.value
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <AppCard className="px-6 py-12 text-center">
          <FileText className="mx-auto text-muted" size={36} />
          {hasAnyInvoices && filter !== "all" ? (
            <>
              <p className="mt-3 text-sm font-semibold text-ink">
                لا فواتير بهذه الحالة
              </p>
              <p className="mt-1 text-xs text-muted">
                جرّب فلترًا آخر أو اعرض كل الفواتير
              </p>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="pressable mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-on"
              >
                عرض الكل
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm font-semibold text-ink">لا توجد فواتير</p>
              <p className="mt-1 text-xs text-muted">
                أنشئ فاتورة لعميل وشاركها كملف PDF
              </p>
              <Link
                to="/invoices/new"
                className="pressable mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-on"
              >
                <Plus size={14} />
                إنشاء فاتورة
              </Link>
            </>
          )}
        </AppCard>
      ) : (
        <div className="space-y-3 pb-4">
          {filtered.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}
    </div>
  );
}
