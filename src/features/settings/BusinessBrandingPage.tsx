import { Building2, ImagePlus, Save, Trash2 } from "lucide-react";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import {
  EMPTY_WORKSPACE_BRAND,
  updateWorkspaceBrandingRpc,
  uploadWorkspaceLogo,
} from "@/features/workspace/workspace-api";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted";

export function BusinessBrandingPage() {
  const { membership, workspaceId, refresh } = useWorkspace();
  const brand = membership?.brand ?? EMPTY_WORKSPACE_BRAND;

  const [workspaceName, setWorkspaceName] = useState(
    membership?.workspaceName ?? "",
  );
  const [legalName, setLegalName] = useState(brand.legalName ?? "");
  const [phone, setPhone] = useState(brand.phone ?? "");
  const [address, setAddress] = useState(brand.address ?? "");
  const [taxId, setTaxId] = useState(brand.taxId ?? "");
  const [invoiceFooter, setInvoiceFooter] = useState(
    brand.invoiceFooter ?? "",
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    brand.logoUrl,
  );
  const [clearLogo, setClearLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setClearLogo(false);
    setLogoFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const handleClearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setClearLogo(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceId) {
      setFormError("مساحة العمل غير متاحة");
      return;
    }
    if (!workspaceName.trim()) {
      setFormError("اسم مساحة العمل مطلوب");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      let logoPath: string | undefined;
      if (logoFile) {
        logoPath = await uploadWorkspaceLogo(workspaceId, logoFile);
      }

      await updateWorkspaceBrandingRpc({
        workspaceId,
        name: workspaceName.trim(),
        legalName: legalName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        taxId: taxId.trim() || null,
        invoiceFooter: invoiceFooter.trim() || null,
        logoPath,
        clearLogo: clearLogo && !logoFile,
      });
      await refresh();
      toast.success("تم حفظ بيانات المنشأة");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "تعذر حفظ بيانات المنشأة",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <PageHeader
        title="بيانات المنشأة"
        subtitle="الاسم والشعار والبيانات الظاهرة على الفواتير"
        backTo="/settings"
      />

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 pb-8">
        <AppCard className="rounded-[18px] p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3 border-b border-line pb-4">
            <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <Building2 size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-bold text-ink">الهوية التجارية</p>
              <p className="mt-0.5 text-xs text-muted">
                تظهر هذه البيانات في معاينة الفاتورة وملف PDF
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                اسم النشاط (يظهر على الفاتورة) *
              </label>
              <input
                type="text"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                الاسم الرسمي في السجل (اختياري)
              </label>
              <input
                type="text"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                className={inputClass}
                placeholder="إن وُجد — يُفضَّل على اسم النشاط في الفاتورة"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                الهاتف
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                العنوان
              </label>
              <textarea
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                الرقم الضريبي
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(event) => setTaxId(event.target.value)}
                className={inputClass}
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                تذييل الفاتورة
              </label>
              <textarea
                value={invoiceFooter}
                onChange={(event) => setInvoiceFooter(event.target.value)}
                rows={3}
                className={inputClass}
                placeholder="مثال: شكرًا لتعاملكم معنا"
              />
            </div>
          </div>
        </AppCard>

        <AppCard className="rounded-[18px] p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-bold text-ink">شعار المنشأة</h2>
          {logoPreview ? (
            <div className="mb-3 flex items-center gap-3">
              <img
                src={logoPreview}
                alt="شعار المنشأة"
                className="h-16 max-w-[180px] rounded-lg border border-line object-contain bg-surface-subtle p-2"
              />
              <button
                type="button"
                onClick={handleClearLogo}
                className="pressable inline-flex items-center gap-1 rounded-xl bg-danger-soft px-3 py-2 text-xs font-bold text-danger"
              >
                <Trash2 size={14} />
                إزالة الشعار
              </button>
            </div>
          ) : (
            <p className="mb-3 text-xs text-muted">لم يتم رفع شعار بعد</p>
          )}
          <label className="pressable inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface-subtle px-3 text-xs font-bold text-ink">
            <ImagePlus size={15} />
            اختيار صورة
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={handleLogoChange}
            />
          </label>
        </AppCard>

        <button
          type="submit"
          disabled={saving}
          className="pressable inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-on disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? "جاري الحفظ…" : "حفظ بيانات المنشأة"}
        </button>

        {formError ? (
          <p className="text-center text-xs text-danger">{formError}</p>
        ) : null}
      </form>
    </div>
  );
}
