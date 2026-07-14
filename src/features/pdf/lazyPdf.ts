import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { formatMinorAmount } from "@/domain/money/money";
import type {
  Invoice,
  InvoiceItem,
  WorkspaceBrand,
} from "@/features/workspace/workspace-types";
import { downloadPdf, sharePdf } from "./pdfService";

export interface InvoicePdfOptions {
  brand?: WorkspaceBrand;
  workspaceName?: string;
  text?: string;
}

function invoiceFileName(invoice: Invoice): string {
  const safe = invoice.invoiceNumber.replace(/[^\w\u0600-\u06FF\-]+/g, "_");
  return `فاتورة-${safe || invoice.id}.pdf`;
}

async function fetchLogoDataUri(
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function buildDocument(
  invoice: Invoice,
  options: InvoicePdfOptions = {},
): Promise<ReactElement<DocumentProps>> {
  const { InvoicePDF } = await import("./InvoicePDF");
  const items: InvoiceItem[] = invoice.items ?? [];
  const logoDataUri = await fetchLogoDataUri(options.brand?.logoUrl);
  return createElement(InvoicePDF, {
    invoice,
    items,
    brand: options.brand,
    workspaceName: options.workspaceName,
    logoDataUri,
  }) as ReactElement<DocumentProps>;
}

function defaultShareText(invoice: Invoice, workspaceName?: string): string {
  const company = workspaceName?.trim() || "ميزان";
  const total = formatMinorAmount(invoice.totalMinor, {
    currency: invoice.currencyCode,
    locale: "en-US",
  });
  const remaining = formatMinorAmount(
    invoice.totalMinor - (invoice.paidMinor ?? 0n),
    { currency: invoice.currencyCode, locale: "en-US" },
  );
  return [
    `فاتورة ${invoice.invoiceNumber}`,
    `من: ${company}`,
    `إلى: ${invoice.clientName}`,
    `الإجمالي: ${total} ${invoice.currencyCode}`,
    `المتبقي: ${remaining} ${invoice.currencyCode}`,
  ].join("\n");
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  options: InvoicePdfOptions = {},
): Promise<void> {
  const document = await buildDocument(invoice, options);
  await downloadPdf(document, invoiceFileName(invoice));
}

export async function shareInvoicePdf(
  invoice: Invoice,
  options: InvoicePdfOptions = {},
): Promise<void> {
  const document = await buildDocument(invoice, options);
  const title = `فاتورة ${invoice.invoiceNumber}`;
  const text = options.text ?? defaultShareText(invoice, options.workspaceName);
  await sharePdf(document, invoiceFileName(invoice), title, text);
}

export function buildInvoiceWhatsAppText(
  invoice: Invoice,
  workspaceName?: string,
): string {
  return defaultShareText(invoice, workspaceName);
}
