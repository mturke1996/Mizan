import { FileSpreadsheet, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppSheet } from "@/shared/ui/AppSheet";

export interface CsvImportRow {
  name: string;
  quantity?: number;
  unitLabel?: string;
  unitCost?: string;
  barcode?: string;
  phone?: string;
}

export interface CsvImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: CsvImportRow[]) => void;
  title?: string;
}

export function CsvImporterModal({
  isOpen,
  onClose,
  onImport,
  title = "استيراد بيانات من ملف Excel / CSV",
}: CsvImporterModalProps) {
  const [parsedRows, setParsedRows] = useState<CsvImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setParsedRows([]);
      setFileName(null);
    }
  }, [isOpen]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length <= 1) {
        toast.error("الملف فارغ أو يحتوي على العناوين فقط");
        return;
      }

      const rows: CsvImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split(",").map((col) =>
          col.replace(/^"|"$/g, "").trim(),
        );
        if (cols[0]) {
          rows.push({
            name: cols[0],
            quantity: cols[1] ? Number(cols[1]) : 1,
            unitLabel: cols[2] || "قطعة",
            unitCost: cols[3] || "",
            barcode: cols[4] || "",
            phone: cols[5] || "",
          });
        }
      }

      setParsedRows(rows);
      toast.success(`تم قراءة ${rows.length} صفاً بنجاح`);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) {
      toast.error("لا توجد بيانات للاستيراد");
      return;
    }
    onImport(parsedRows);
    toast.success(`تم استيراد ${parsedRows.length} صفاً بنجاح!`);
    onClose();
  };

  return (
    <AppSheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description="ارفع ملف CSV ثم راجع المعاينة قبل التأكيد"
      size="lg"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            disabled={parsedRows.length === 0}
            onClick={handleConfirmImport}
            className="pressable flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-primary-on hover:bg-primary-hover disabled:opacity-50"
          >
            <FileSpreadsheet aria-hidden="true" size={16} />
            تأكيد واستيراد{" "}
            {parsedRows.length > 0 ? `(${parsedRows.length})` : ""}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl border-2 border-dashed border-line bg-canvas p-6 text-center">
          <Upload size={32} className="mx-auto mb-2 text-muted" />
          <p className="text-xs font-bold text-ink">اختر ملف (.csv)</p>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            صيغة الأعمدة: الاسم، الكمية، الوحدة، التكلفة، الباركود، الهاتف
          </p>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileUpload}
            className="mt-3 block w-full text-xs text-muted file:ms-0 file:me-3 file:rounded-xl file:border-0 file:bg-primary-soft file:px-4 file:py-2 file:text-xs file:font-bold file:text-primary"
          />
          {fileName ? (
            <p className="mt-2 text-[11px] font-semibold text-primary">{fileName}</p>
          ) : null}
        </div>

        {parsedRows.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-ink">
              معاينة البيانات ({parsedRows.length} صف)
            </h4>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-2 text-xs">
              {parsedRows.slice(0, 10).map((row, idx) => (
                <div
                  key={`${row.name}-${idx}`}
                  className="flex justify-between border-b border-line/50 pb-1 text-muted last:border-0"
                >
                  <span className="font-bold text-ink">{row.name}</span>
                  <span>
                    {row.quantity} {row.unitLabel}
                  </span>
                </div>
              ))}
              {parsedRows.length > 10 ? (
                <p className="text-center text-[10px] text-muted">
                  ...و {parsedRows.length - 10} صفوف أخرى
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </AppSheet>
  );
}
