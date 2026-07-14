import { Printer } from "lucide-react";
import type { ReactNode } from "react";
import { formatMinorAmount } from "@/domain/money/money";
import type {
  Invoice,
  InvoiceStatus,
  WorkspaceBrand,
} from "@/features/workspace/workspace-types";
import { getInvoicePaymentSummary } from "./invoicePayments";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "مسودة",
  sent: "مُرسلة",
  paid: "مدفوعة",
  partially_paid: "مدفوعة جزئيًا",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

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

export function InvoicePreviewFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-line bg-surface">
      <div className="no-print flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-bold text-ink">معاينة الفاتورة</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
        >
          <Printer size={14} aria-hidden="true" />
          طباعة الفاتورة
        </button>
      </div>
      <div className="overflow-x-auto p-3 sm:p-4">{children}</div>
    </div>
  );
}

export function PrintableInvoice({
  invoice,
  brand,
  workspaceName,
  logoUrl,
}: {
  invoice: Invoice;
  brand: WorkspaceBrand;
  workspaceName: string;
  logoUrl?: string | null;
}) {
  const companyName = brand.legalName?.trim() || workspaceName;
  const items = invoice.items ?? [];
  const money = { currency: invoice.currencyCode, locale: "en-US" as const };
  const { paidMinor, remainingMinor } = getInvoicePaymentSummary(invoice);
  const resolvedLogo = logoUrl ?? brand.logoUrl;

  return (
    <article
      dir="rtl"
      className="invoice-doc mx-auto w-full max-w-[210mm] bg-white text-[#1B1E3C] shadow-sm print:shadow-none"
      style={{ minHeight: "297mm" }}
    >
      <div className="border-b-2 border-[#4B52C7] px-6 py-6 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 text-right">
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={companyName}
                className="mb-3 h-14 max-w-[160px] object-contain object-right"
              />
            ) : null}
            <h1 className="text-xl font-black text-[#4B52C7] sm:text-2xl">
              {companyName}
            </h1>
            <div className="mt-2 space-y-0.5 text-xs text-[#6B7289]">
              {brand.phone ? (
                <p dir="ltr" className="text-right">
                  {brand.phone}
                </p>
              ) : null}
              {brand.address ? <p>{brand.address}</p> : null}
              {brand.taxId ? <p>الرقم الضريبي: {brand.taxId}</p> : null}
            </div>
          </div>
          <div className="shrink-0 text-left">
            <p className="text-lg font-black">فاتورة</p>
            <p className="mt-1 text-sm font-bold text-[#4B52C7]" dir="ltr">
              {invoice.invoiceNumber}
            </p>
            <p className="mt-2 text-[11px] text-[#6B7289]">
              الإصدار: {formatDate(invoice.issueOn)}
            </p>
            <p className="text-[11px] text-[#6B7289]">
              الاستحقاق: {formatDate(invoice.dueOn)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-6 py-5 sm:grid-cols-2 sm:px-8">
        <div className="rounded-xl bg-[#F7F8FC] p-3">
          <p className="text-[11px] font-semibold text-[#6B7289]">العميل</p>
          <p className="mt-1 text-sm font-bold">{invoice.clientName}</p>
          {invoice.clientPhone ? (
            <p className="mt-1 text-xs text-[#6B7289]" dir="ltr">
              {invoice.clientPhone}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl bg-[#F7F8FC] p-3">
          <p className="text-[11px] font-semibold text-[#6B7289]">الحالة</p>
          <p className="mt-1 text-sm font-bold">
            {STATUS_LABELS[invoice.status]}
          </p>
          <p className="mt-1 text-xs text-[#6B7289]">
            العملة: {invoice.currencyCode}
          </p>
        </div>
      </div>

      <div className="px-6 pb-4 sm:px-8">
        <table className="w-full border-collapse overflow-hidden rounded-xl border border-[#E2E5F0] text-xs">
          <thead>
            <tr className="bg-[#4B52C7] text-white">
              <th className="px-3 py-2.5 text-right font-bold">الوصف</th>
              <th className="px-3 py-2.5 text-center font-bold">الكمية</th>
              <th className="px-3 py-2.5 text-left font-bold">السعر</th>
              <th className="px-3 py-2.5 text-left font-bold">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-4 text-center text-[#6B7289]"
                >
                  لا توجد بنود
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={item.id || `${index}`}
                  className={index % 2 === 1 ? "bg-[#F7F8FC]" : "bg-white"}
                >
                  <td className="px-3 py-2.5 text-right font-semibold">
                    {item.description}
                  </td>
                  <td className="numeric px-3 py-2.5 text-center" dir="ltr">
                    {item.quantity}
                  </td>
                  <td className="numeric px-3 py-2.5 text-left" dir="ltr">
                    {formatMinorAmount(item.unitPriceMinor, money)}
                  </td>
                  <td className="numeric px-3 py-2.5 text-left font-bold" dir="ltr">
                    {formatMinorAmount(item.lineTotalMinor, money)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-start px-6 pb-5 sm:px-8">
        <div className="w-full max-w-xs overflow-hidden rounded-xl border border-[#E2E5F0] text-xs">
          <div className="flex justify-between border-b border-[#E2E5F0] px-3 py-2">
            <span className="text-[#6B7289]">المجموع الفرعي</span>
            <span className="numeric font-bold" dir="ltr">
              {formatMinorAmount(invoice.subtotalMinor, money)}
            </span>
          </div>
          <div className="flex justify-between border-b border-[#E2E5F0] px-3 py-2">
            <span className="text-[#6B7289]">
              الضريبة ({invoice.taxRatePercent}%)
            </span>
            <span className="numeric font-bold" dir="ltr">
              {formatMinorAmount(invoice.taxMinor, money)}
            </span>
          </div>
          <div className="flex justify-between bg-[#4B52C7] px-3 py-2.5 text-white">
            <span className="font-bold">الإجمالي</span>
            <span className="numeric font-black" dir="ltr">
              {formatMinorAmount(invoice.totalMinor, money)}{" "}
              {invoice.currencyCode}
            </span>
          </div>
          <div className="flex justify-between border-t border-[#E2E5F0] px-3 py-2">
            <span className="text-[#6B7289]">المدفوع</span>
            <span className="numeric font-bold text-emerald-700" dir="ltr">
              {formatMinorAmount(paidMinor, money)}
            </span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-[#6B7289]">المتبقي</span>
            <span className="numeric font-bold text-amber-700" dir="ltr">
              {formatMinorAmount(remainingMinor, money)}
            </span>
          </div>
        </div>
      </div>

      {invoice.notes ? (
        <div className="mx-6 mb-4 rounded-xl bg-[#F7F8FC] p-3 sm:mx-8">
          <p className="text-[11px] font-bold text-[#6B7289]">ملاحظات</p>
          <p className="mt-1 text-sm leading-6">{invoice.notes}</p>
        </div>
      ) : null}

      {brand.invoiceFooter ? (
        <div className="border-t border-[#E2E5F0] px-6 py-4 text-center text-[11px] text-[#6B7289] sm:px-8">
          {brand.invoiceFooter}
        </div>
      ) : (
        <div className="border-t border-[#E2E5F0] px-6 py-4 text-center text-[11px] text-[#6B7289] sm:px-8">
          شكرًا لتعاملكم معنا
        </div>
      )}
    </article>
  );
}
