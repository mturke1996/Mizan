import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  formatMajorInputAmount,
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  useClientsQuery,
  useCreateInvoiceMutation,
  useInvoiceDetailQuery,
  useUpdateInvoiceMutation,
} from "@/features/workspace/use-finance-data";
import { EMPTY_WORKSPACE_BRAND } from "@/features/workspace/workspace-api";
import { useWorkspace } from "@/features/workspace/use-workspace";
import type { Invoice } from "@/features/workspace/workspace-types";
import { AppCard } from "@/shared/ui/AppCard";
import { ErrorState } from "@/shared/ui/ErrorState";
import { controlClassName } from "@/shared/ui/form-field";
import { PageHeader } from "@/shared/ui/PageHeader";
import { getUserErrorMessage } from "@/lib/user-error";
import { canEditInvoice } from "./invoicePayments";
import { InvoicePreviewFrame, PrintableInvoice } from "./PrintableInvoice";

interface DraftLine {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

function emptyLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    description: "",
    quantity: "1",
    unitPrice: "",
  };
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const isEdit = Boolean(invoiceId);
  const { currency, membership } = useWorkspace();
  const clientsQuery = useClientsQuery();
  const detailQuery = useInvoiceDetailQuery(invoiceId);
  const createInvoice = useCreateInvoiceMutation();
  const updateInvoice = useUpdateInvoiceMutation(invoiceId ?? "");
  const scale = getCurrencyScale(currency);
  const today = new Date().toISOString().slice(0, 10);
  const brand = membership?.brand ?? EMPTY_WORKSPACE_BRAND;
  const workspaceName = membership?.workspaceName ?? "ميزان";

  const [businessClientId, setBusinessClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [issueOn, setIssueOn] = useState(today);
  const [dueOn, setDueOn] = useState("");
  const [taxRate, setTaxRate] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [submitMode, setSubmitMode] = useState<"estimate" | "draft" | "sent">(
    "draft",
  );

  const clients = clientsQuery.data ?? [];
  const existing = detailQuery.data;
  const inputClass = controlClassName;

  useEffect(() => {
    if (!isEdit || !existing || prefilledId === existing.id) return;
    setBusinessClientId(existing.businessClientId ?? "");
    setClientName(existing.clientName);
    setClientPhone(existing.clientPhone ?? "");
    setIssueOn(existing.issueOn || today);
    setDueOn(existing.dueOn ?? "");
    setTaxRate(String(existing.taxRatePercent ?? 0));
    setNotes(existing.notes ?? "");
    const existingLines = existing.items ?? [];
    setLines(
      existingLines.length > 0
        ? existingLines.map((item) => ({
            key: item.id || crypto.randomUUID(),
            description: item.description,
            quantity: String(item.quantity),
            unitPrice: formatMajorInputAmount(item.unitPriceMinor, scale),
          }))
        : [emptyLine()],
    );
    setPrefilledId(existing.id);
  }, [existing, isEdit, prefilledId, scale, today]);

  const preview = useMemo(() => {
    let subtotal = 0n;
    const parsedLines: Array<{
      description: string;
      quantity: number;
      unitPriceMinor: bigint;
      lineTotalMinor: bigint;
    }> = [];

    for (const line of lines) {
      const description = line.description.trim();
      const quantity = Number(line.quantity.replace(",", "."));
      if (!description || !Number.isFinite(quantity) || quantity <= 0) continue;
      let unitPriceMinor = 0n;
      try {
        if (line.unitPrice.trim()) {
          unitPriceMinor = parseMajorAmount(line.unitPrice, scale);
        }
      } catch {
        continue;
      }
      if (unitPriceMinor < 0n) continue;
      const lineTotal = BigInt(Math.round(quantity * Number(unitPriceMinor)));
      subtotal += lineTotal;
      parsedLines.push({
        description,
        quantity,
        unitPriceMinor,
        lineTotalMinor: lineTotal,
      });
    }

    const taxPercent = Math.min(100, Math.max(0, Number(taxRate) || 0));
    const taxMinor = BigInt(Math.round(Number(subtotal) * (taxPercent / 100)));
    return {
      lines: parsedLines,
      subtotalMinor: subtotal,
      taxMinor,
      totalMinor: subtotal + taxMinor,
      taxPercent,
      clientName: clientName.trim() || "عميل",
    };
  }, [clientName, lines, scale, taxRate]);

  const money = { currency, locale: "en-US" as const };

  const draftInvoice = useMemo<Invoice>(() => {
    const base = existing;
    return {
      id: base?.id ?? "preview",
      workspaceId: base?.workspaceId ?? membership?.workspaceId ?? "",
      invoiceNumber: base?.invoiceNumber ?? "مسودة",
      businessClientId: businessClientId || null,
      clientName: preview.clientName,
      clientPhone: clientPhone.trim() || null,
      status: base?.status ?? "draft",
      issueOn: issueOn || today,
      dueOn: dueOn || null,
      notes: notes.trim() || null,
      taxRatePercent: preview.taxPercent,
      subtotalMinor: preview.subtotalMinor,
      taxMinor: preview.taxMinor,
      totalMinor: preview.totalMinor,
      paidMinor: base?.paidMinor ?? 0n,
      currencyCode: base?.currencyCode ?? currency,
      createdBy: base?.createdBy ?? "",
      clientId: base?.clientId ?? "",
      createdAt: base?.createdAt ?? today,
      updatedAt: base?.updatedAt ?? today,
      items: preview.lines.map((line, index) => ({
        id: `preview-${index}`,
        workspaceId: base?.workspaceId ?? "",
        invoiceId: base?.id ?? "preview",
        sortOrder: index,
        description: line.description,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.lineTotalMinor,
        createdAt: today,
      })),
    };
  }, [
    businessClientId,
    clientPhone,
    currency,
    dueOn,
    existing,
    issueOn,
    membership?.workspaceId,
    notes,
    preview,
    today,
  ]);

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const handleClientSelect = (id: string) => {
    setBusinessClientId(id);
    const client = clients.find((item) => item.id === id);
    if (client) {
      setClientName(client.name);
      setClientPhone(client.phone ?? "");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (isEdit && existing && !canEditInvoice(existing)) {
      setFormError("لا يمكن تعديل هذه الفاتورة بعد بدء التحصيل أو الإلغاء");
      return;
    }

    if (!clientName.trim() && !businessClientId) {
      setFormError("اختر عميلاً أو أدخل الاسم يدويًا");
      return;
    }
    if (preview.lines.length === 0) {
      setFormError("أضف بندًا واحدًا على الأقل بوصف وكمية وسعر صالحين");
      return;
    }

    const payload = {
      businessClientId: businessClientId || undefined,
      clientName: clientName.trim() || undefined,
      clientPhone: clientPhone.trim() || undefined,
      issueOn: issueOn || undefined,
      dueOn: dueOn || undefined,
      taxRatePercent: preview.taxPercent,
      notes: notes.trim() || undefined,
      items: preview.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPriceMinor: toSafeMinorNumber(line.unitPriceMinor),
      })),
    };

    try {
      if (isEdit) {
        const invoice = await updateInvoice.mutateAsync({
          ...payload,
          businessClientId: businessClientId || null,
          clientPhone: clientPhone.trim() || null,
          dueOn: dueOn || null,
          notes: notes.trim() || null,
        });
        navigate(`/invoices/${encodeURIComponent(invoice.id)}`, {
          replace: true,
        });
      } else {
        const invoice = await createInvoice.mutateAsync({
          ...payload,
          status: submitMode,
        });
        navigate(`/invoices/${encodeURIComponent(invoice.id)}`, {
          replace: true,
        });
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEdit
            ? "تعذر تحديث الفاتورة"
            : "تعذر إنشاء الفاتورة",
      );
    }
  };

  if (isEdit && detailQuery.isLoading) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="تعديل الفاتورة" backTo="/invoices" />
        <AppCard
          role="status"
          className="h-48 animate-pulse bg-surface-subtle"
        />
      </div>
    );
  }

  if (isEdit && detailQuery.isError) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="تعديل الفاتورة" backTo="/invoices" />
        <ErrorState
          title="تعذر تحميل الفاتورة"
          message={getUserErrorMessage(detailQuery.error, "تعذر تحميل الفاتورة")}
          onRetry={() => void detailQuery.refetch()}
        />
      </div>
    );
  }

  if (isEdit && !existing) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader title="الفاتورة غير موجودة" backTo="/invoices" />
      </div>
    );
  }

  const editBlocked = Boolean(isEdit && existing && !canEditInvoice(existing));
  const saving = createInvoice.isPending || updateInvoice.isPending;

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <PageHeader
        title={isEdit ? "تعديل الفاتورة" : "فاتورة جديدة"}
        subtitle={
          isEdit
            ? existing?.invoiceNumber
            : "عميل وبنود وضريبة ثم معاينة فورية"
        }
        backTo={
          isEdit && existing
            ? `/invoices/${encodeURIComponent(existing.id)}`
            : "/invoices"
        }
      />

      {editBlocked ? (
        <AppCard className="mb-4 rounded-[18px] border-warning/30 bg-warning-soft p-4">
          <p className="text-sm font-bold text-ink">
            لا يمكن تعديل هذه الفاتورة
          </p>
          <p className="mt-1 text-xs text-muted">
            التعديل متاح فقط للمسودات والمُرسلة والمتأخرة قبل تسجيل أي دفعة.
          </p>
          <Link
            to={`/invoices/${encodeURIComponent(existing!.id)}`}
            className="pressable mt-3 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-on"
          >
            العودة لتفاصيل الفاتورة
          </Link>
        </AppCard>
      ) : null}

      {!isEdit && !brand.logoUrl && !brand.phone ? (
        <AppCard className="mb-4 rounded-[18px] border-line bg-surface-subtle p-4">
          <p className="text-xs leading-5 text-muted">
            نصيحة: أضف شعارك وبيانات نشاطك من{" "}
            <Link
              to="/settings/business"
              className="font-bold text-primary underline-offset-2 hover:underline"
            >
              بيانات المنشأة
            </Link>{" "}
            لتظهر على الفاتورة.
          </p>
        </AppCard>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 pb-8">
        <fieldset disabled={editBlocked} className="space-y-4 disabled:opacity-60">
          <AppCard className="rounded-[18px] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">العميل</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  اختر عميلًا محفوظًا (أو اكتب الاسم يدويًا)
                </label>
                <select
                  value={businessClientId}
                  onChange={(event) => handleClientSelect(event.target.value)}
                  className={inputClass}
                >
                  <option value="">— كتابة يدوية —</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.phone ? ` · ${client.phone}` : ""}
                    </option>
                  ))}
                </select>
                {clients.length === 0 ? (
                  <p className="mt-2 text-[11px] text-muted">
                    لا يوجد عملاء بعد —{" "}
                    <Link
                      to="/clients"
                      className="font-bold text-primary underline-offset-2 hover:underline"
                    >
                      أضف عميلًا
                    </Link>
                  </p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  اسم العميل *
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  required
                  className={inputClass}
                  placeholder="اسم العميل على الفاتورة"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  الهاتف
                </label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                  className={inputClass}
                  placeholder="اختياري"
                  dir="ltr"
                />
              </div>
            </div>
          </AppCard>

          <AppCard className="rounded-[18px] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-ink">البنود</h2>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="pressable inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2.5 py-1.5 text-[11px] font-bold text-primary"
              >
                <Plus size={13} />
                إضافة بند
              </button>
            </div>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={line.key}
                  className="rounded-2xl border border-line bg-canvas p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted">
                      بند {index + 1}
                    </span>
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        aria-label="حذف البند"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((item) => item.key !== line.key),
                          )
                        }
                        className="pressable rounded-lg p-1.5 text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={line.description}
                    onChange={(event) =>
                      updateLine(line.key, { description: event.target.value })
                    }
                    placeholder="وصف الخدمة أو المنتج"
                    className={`mb-2 ${inputClass}`}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted">
                        الكمية
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, { quantity: event.target.value })
                        }
                        className={`numeric ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-muted">
                        السعر ({currency})
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(line.key, {
                            unitPrice: event.target.value,
                          })
                        }
                        className={`numeric ${inputClass}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AppCard>

          <AppCard className="rounded-[18px] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">التفاصيل</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  تاريخ الإصدار
                </label>
                <input
                  type="date"
                  value={issueOn}
                  onChange={(event) => setIssueOn(event.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  تاريخ الاستحقاق
                </label>
                <input
                  type="date"
                  value={dueOn}
                  onChange={(event) => setDueOn(event.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-[10px] text-muted">
                  اختياري — يُذكّرك بالفواتير المتأخرة
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  نسبة الضريبة %
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                  className={`numeric ${inputClass}`}
                />
                <p className="mt-1 text-[10px] text-muted">
                  تُحسب تلقائيًا من الإجمالي الفرعي وتظهر كبند ضريبة منفصل على
                  الفاتورة. اترك 0 إن لم تطبّق ضريبة.
                </p>
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-ink">
                ملاحظات
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className={inputClass}
                placeholder="اختياري"
              />
            </div>
          </AppCard>

          <AppCard className="rounded-[18px] border-primary/20 bg-[linear-gradient(160deg,rgb(67_56_202/8%),transparent_55%)] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-bold text-ink">معاينة سريعة</h2>
            <p className="text-xs text-muted">العميل: {preview.clientName}</p>
            <ul className="mt-3 space-y-2">
              {preview.lines.length === 0 ? (
                <li className="text-xs text-muted">لا بنود بعد</li>
              ) : (
                preview.lines.map((line, index) => (
                  <li
                    key={`${line.description}-${index}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 truncate font-semibold text-ink">
                      {line.description}
                      <span className="ms-1 font-normal text-muted">
                        × {line.quantity}
                      </span>
                    </span>
                    <span className="numeric shrink-0 font-bold" dir="ltr">
                      {formatMinorAmount(line.lineTotalMinor, money)}
                    </span>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 space-y-1 border-t border-line/80 pt-3 text-xs">
              <div className="flex justify-between text-muted">
                <span>المجموع الفرعي</span>
                <span className="numeric" dir="ltr">
                  {formatMinorAmount(preview.subtotalMinor, money)}
                </span>
              </div>
              <div className="flex justify-between text-muted">
                <span>ضريبة ({preview.taxPercent}%)</span>
                <span className="numeric" dir="ltr">
                  {formatMinorAmount(preview.taxMinor, money)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-ink">
                <span>الإجمالي</span>
                <span className="numeric" dir="ltr">
                  {formatMinorAmount(preview.totalMinor, money)} {currency}
                </span>
              </div>
            </div>
          </AppCard>
        </fieldset>

        {!editBlocked ? (
          isEdit ? (
            <button
              type="submit"
              disabled={saving}
              className="pressable w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-on disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </button>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="submit"
                disabled={saving}
                onClick={() => setSubmitMode("estimate")}
                className="pressable w-full rounded-xl border border-line bg-surface py-3 text-sm font-bold text-ink disabled:opacity-50"
              >
                {saving && submitMode === "estimate"
                  ? "جاري الحفظ..."
                  : "عرض سعر"}
              </button>
              <button
                type="submit"
                disabled={saving}
                onClick={() => setSubmitMode("draft")}
                className="pressable w-full rounded-xl border border-line bg-surface-subtle py-3 text-sm font-bold text-ink disabled:opacity-50"
              >
                {saving && submitMode === "draft"
                  ? "جاري الحفظ..."
                  : "مسودة"}
              </button>
              <button
                type="submit"
                disabled={saving}
                onClick={() => setSubmitMode("sent")}
                className="pressable w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-on disabled:opacity-50"
              >
                {saving && submitMode === "sent"
                  ? "جاري الحفظ..."
                  : "حفظ وإرسال"}
              </button>
            </div>
          )
        ) : null}

        {formError || createInvoice.isError || updateInvoice.isError ? (
          <p className="text-center text-xs text-danger">
            {formError ||
              (createInvoice.error instanceof Error
                ? createInvoice.error.message
                : updateInvoice.error instanceof Error
                  ? updateInvoice.error.message
                  : "حدث خطأ")}
          </p>
        ) : null}
      </form>

      <div className="pb-10">
        <button
          type="button"
          onClick={() => setShowFullPreview((value) => !value)}
          className="pressable mb-3 w-full rounded-xl border border-line bg-surface py-2.5 text-xs font-bold text-ink"
        >
          {showFullPreview ? "إخفاء معاينة PDF" : "عرض معاينة PDF الكاملة"}
        </button>
        {showFullPreview ? (
          <InvoicePreviewFrame>
            <PrintableInvoice
              invoice={draftInvoice}
              brand={brand}
              workspaceName={workspaceName}
              logoUrl={brand.logoUrl}
            />
          </InvoicePreviewFrame>
        ) : null}
      </div>
    </div>
  );
}
