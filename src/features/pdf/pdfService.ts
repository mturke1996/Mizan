import { pdf, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { ensurePdfFontsLoaded } from "./pdfFonts";

export async function generatePdfBlob(
  document: ReactElement<DocumentProps>,
): Promise<Blob> {
  await ensurePdfFontsLoaded();
  const instance = pdf(document);
  return instance.toBlob();
}

function triggerAnchorDownload(url: string, fileName: string): void {
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  anchor.rel = "noopener";
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function downloadPdf(
  document: ReactElement<DocumentProps>,
  fileName: string,
): Promise<void> {
  try {
    const blob = await generatePdfBlob(document);
    const url = URL.createObjectURL(blob);
    const safeName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;

    const tab = window.open(url, "_blank", "noopener,noreferrer");
    if (!tab) {
      triggerAnchorDownload(url, safeName);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("تم تنزيل ملف PDF");
      return;
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success("تم فتح ملف PDF");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "تعذر تنزيل ملف PDF",
    );
    throw error;
  }
}

export async function sharePdf(
  document: ReactElement<DocumentProps>,
  fileName: string,
  title = "فاتورة ميزان",
  text?: string,
): Promise<void> {
  try {
    const blob = await generatePdfBlob(document);
    const safeName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
    const file = new File([blob], safeName, { type: "application/pdf" });

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      await navigator.share({
        title,
        ...(text ? { text } : {}),
        files: [file],
      });
      toast.success("تمت مشاركة الفاتورة");
      return;
    }

    await downloadPdf(document, safeName);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return;
    }
    toast.error(
      error instanceof Error ? error.message : "تعذر مشاركة ملف PDF",
    );
    throw error;
  }
}
