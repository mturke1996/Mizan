import type {
  Invoice,
  InvoicePaymentMethod,
} from "@/features/workspace/workspace-types";

export const METHOD_LABELS: Record<InvoicePaymentMethod, string> = {
  cash: "نقدًا",
  bank_transfer: "تحويل بنكي",
  check: "شيك",
  mobile_payment: "دفع إلكتروني",
  other: "أخرى",
};

export function getInvoicePaymentSummary(
  invoice: Pick<Invoice, "totalMinor" | "paidMinor">,
): {
  paidMinor: bigint;
  remainingMinor: bigint;
  progressPct: number;
} {
  const paidMinor = invoice.paidMinor ?? 0n;
  const remainingMinor =
    invoice.totalMinor > paidMinor ? invoice.totalMinor - paidMinor : 0n;

  let progressPct = 0;
  if (invoice.totalMinor > 0n) {
    progressPct = Math.min(
      100,
      Number((paidMinor * 100n) / invoice.totalMinor),
    );
  } else if (paidMinor > 0n) {
    progressPct = 100;
  }

  return { paidMinor, remainingMinor, progressPct };
}

export function canEditInvoice(
  invoice: Pick<Invoice, "status" | "paidMinor">,
): boolean {
  if (invoice.status === "cancelled") return false;
  if ((invoice.paidMinor ?? 0n) !== 0n) return false;
  return (
    invoice.status === "draft" ||
    invoice.status === "sent" ||
    invoice.status === "overdue"
  );
}

export function canCollectPayment(
  invoice: Pick<Invoice, "status" | "totalMinor" | "paidMinor">,
): boolean {
  if (invoice.status === "draft" || invoice.status === "cancelled") {
    return false;
  }
  return getInvoicePaymentSummary(invoice).remainingMinor > 0n;
}
