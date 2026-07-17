import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Download,
  FileText,
  Pencil,
  Scale,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { computeClientProfile } from "@/domain/analytics/compute-client-profile";
import { formatMinorAmount } from "@/domain/money/money";
import {
  useAllTransactionsQuery,
  useClientsQuery,
  useDebtsQuery,
  useInvoicesQuery,
  useUpsertClientMutation,
} from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { InvoiceStatus } from "@/features/workspace/workspace-types";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  estimate: "عرض سعر",
  draft: "مسودة",
  sent: "مُرسلة",
  paid: "مدفوعة",
  partially_paid: "مدفوعة جزئيًا",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

const DEBT_STATUS_LABELS: Record<string, string> = {
  open: "مفتوح",
  partial: "جزئي",
  settled: "مسدد",
  written_off: "مشطوب",
};

export function ClientDetailPage() {
  const { clientId } = useParams();
  const { currency } = useWorkspace();
  const clientsQuery = useClientsQuery();
  const invoicesQuery = useInvoicesQuery();
  const debtsQuery = useDebtsQuery();
  const allTransactions = useAllTransactionsQuery();
  const upsertClient = useUpsertClientMutation();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const client = clientsQuery.data?.find((item) => item.id === clientId);
  const money = { currency, locale: "en-US" as const };
  const inputClass =
    "w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted";

  const profile = useMemo(() => {
    if (!client) return null;
    return computeClientProfile({
      client,
      invoices: invoicesQuery.data ?? [],
      debts: debtsQuery.data ?? [],
      transactions: allTransactions.transactions,
      currency,
    });
  }, [
    client,
    invoicesQuery.data,
    debtsQuery.data,
    allTransactions.transactions,
    currency,
  ]);

  const isLoading =
    clientsQuery.isLoading ||
    invoicesQuery.isLoading ||
    debtsQuery.isLoading ||
    allTransactions.isLoading;

  const loadError =
    clientsQuery.error ??
    invoicesQuery.error ??
    debtsQuery.error ??
    allTransactions.error;

  function startEdit() {
    if (!client) return;
    setName(client.name);
    setPhone(client.phone ?? "");
    setEditing(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !name.trim()) return;
    try {
      await upsertClient.mutateAsync({
        clientId,
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setEditing(false);
      toast.success("تم تحديث بيانات العميل");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر حفظ العميل"));
    }
  }

  function handleExportCsv() {
    if (!profile) return;
    const rows: Array<Array<string | number>> = [
      ["نوع", "مرجع", "الحالة", "المبلغ", "العملة", "تاريخ"],
      ...profile.invoices.map((invoice) => [
        "فاتورة",
        invoice.invoiceNumber,
        STATUS_LABELS[invoice.status],
        invoice.totalMinor.toString(),
        invoice.currencyCode,
        invoice.issueOn,
      ]),
      ...profile.debts.map((debt) => [
        debt.direction === "receivable" ? "دين لي" : "دين عليّ",
        debt.partyName,
        DEBT_STATUS_LABELS[debt.status] ?? debt.status,
        debt.balanceMinor.toString(),
        debt.currencyCode,
        debt.dueOn ?? debt.createdAt.slice(0, 10),
      ]),
      [],
      ["ملخص", "", "", "", "", ""],
      [
        "فواتير مفتوحة",
        String(profile.openInvoiceCount),
        "",
        profile.invoiceReceivableMinor.toString(),
        currency,
        "",
      ],
      [
        "ديون مستحقة لي",
        "",
        "",
        profile.debtReceivableMinor.toString(),
        currency,
        "",
      ],
      [
        "ديون مستحقة عليّ",
        "",
        "",
        profile.debtPayableMinor.toString(),
        currency,
        "",
      ],
      [
        "صافي التعرض",
        "",
        "",
        profile.netExposureMinor.toString(),
        currency,
        "",
      ],
    ];
    const csv = buildCsv(rows[0] as string[], rows.slice(1));
    const safeName = profile.client.name.replace(/[^\w\u0600-\u06FF-]+/g, "-");
    downloadCsv(`mizan-client-${safeName}.csv`, csv);
    toast.success("تم تنزيل كشف العميل");
  }

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="العميل" backTo="/clients" />
        <AppCard
          role="status"
          className="h-40 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="العميل" backTo="/clients" />
        <ErrorState
          message={getUserErrorMessage(loadError, "تعذر تحميل بيانات العميل")}
          onRetry={() => {
            void clientsQuery.refetch();
            void invoicesQuery.refetch();
            void debtsQuery.refetch();
            allTransactions.refetch();
          }}
        />
      </div>
    );
  }

  if (!client || !profile) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="العميل غير موجود" backTo="/clients" />
        <ErrorState
          message="لم يُعثر على هذا العميل"
          onRetry={() => void clientsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-6" dir="rtl">
      <PageHeader
        title={client.name}
        subtitle={client.phone ?? "بدون رقم هاتف"}
        backTo="/clients"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-surface-subtle px-3 text-xs font-bold text-ink"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              type="button"
              onClick={startEdit}
              className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
            >
              <Pencil size={14} />
              تعديل
            </button>
          </div>
        }
      />

      {editing ? (
        <AppCard className="mb-5 rounded-[18px] p-4">
          <h3 className="mb-3 text-sm font-bold text-ink">تعديل العميل</h3>
          <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم *"
              required
              className={inputClass}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف (اختياري)"
              className={inputClass}
              dir="ltr"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={upsertClient.isPending || !name.trim()}
                className="pressable flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-on disabled:opacity-50"
              >
                {upsertClient.isPending ? "جاري الحفظ..." : "حفظ"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl bg-surface-subtle px-4 py-2.5 text-sm font-medium text-muted"
              >
                إلغاء
              </button>
            </div>
          </form>
        </AppCard>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <MetricCard
          label="فواتير مفتوحة"
          value={String(profile.openInvoiceCount)}
          helper={formatMinorAmount(profile.invoiceReceivableMinor, money)}
        />
        <MetricCard
          label="صافي التعرض"
          value={formatMinorAmount(profile.netExposureMinor, money)}
          helper={`${profile.invoiceCount} فاتورة`}
        />
        <MetricCard
          label="ديون لي"
          value={formatMinorAmount(profile.debtReceivableMinor, money)}
        />
        <MetricCard
          label="ديون عليّ"
          value={formatMinorAmount(profile.debtPayableMinor, money)}
        />
      </div>

      <section className="mb-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <FileText size={16} className="text-primary" />
          الفواتير
        </h2>
        {profile.invoices.length === 0 ? (
          <AppCard className="px-4 py-8 text-center text-sm text-muted">
            لا توجد فواتير مرتبطة
          </AppCard>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {profile.invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  to={`/invoices/${encodeURIComponent(invoice.id)}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink" dir="ltr">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="text-[11px] text-muted">
                      {STATUS_LABELS[invoice.status]} · {invoice.issueOn}
                    </p>
                  </div>
                  <span className="numeric shrink-0 text-sm font-bold text-ink" dir="ltr">
                    {formatMinorAmount(invoice.totalMinor, money)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <Scale size={16} className="text-primary" />
          الديون
        </h2>
        {profile.debts.length === 0 ? (
          <AppCard className="px-4 py-8 text-center text-sm text-muted">
            لا توجد ديون مرتبطة
          </AppCard>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {profile.debts.map((debt) => (
              <li key={debt.id}>
                <Link
                  to={`/debts/${encodeURIComponent(debt.id)}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-subtle"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {debt.direction === "receivable" ? "مستحق لي" : "مستحق عليّ"}
                    </p>
                    <p className="text-[11px] text-muted">
                      {DEBT_STATUS_LABELS[debt.status] ?? debt.status}
                    </p>
                  </div>
                  <span className="numeric shrink-0 text-sm font-bold text-ink" dir="ltr">
                    {formatMinorAmount(debt.balanceMinor, money)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
          <ReceiptText size={16} className="text-primary" />
          معاملات ذات صلة
        </h2>
        {profile.relatedTransactions.length === 0 ? (
          <AppCard className="px-4 py-8 text-center text-sm text-muted">
            لا توجد معاملات مطابقة للاسم
          </AppCard>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface">
            {profile.relatedTransactions.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {tx.title}
                  </p>
                  <p className="text-[11px] text-muted">
                    {new Date(tx.occurredAt).toLocaleDateString("ar-LY")}
                  </p>
                </div>
                <span
                  className={`numeric shrink-0 text-sm font-bold ${
                    tx.kind === "income" ? "text-success" : "text-danger"
                  }`}
                  dir="ltr"
                >
                  {tx.kind === "income" ? "+" : "-"}
                  {formatMinorAmount(tx.amountMinor, money)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <AppCard className="rounded-[18px] p-4">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="numeric mt-1.5 text-base font-bold text-ink" dir="ltr">
        {value}
      </p>
      {helper ? (
        <p className="mt-1 text-[11px] text-muted" dir="ltr">
          {helper}
        </p>
      ) : null}
    </AppCard>
  );
}
