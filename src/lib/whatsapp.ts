/** Digits-only phone for wa.me (keeps country code when present). */
export function toWhatsAppDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

export function buildWhatsAppUrl(
  text: string,
  phone?: string | null,
): string {
  const digits = toWhatsAppDigits(phone);
  const base = digits
    ? `https://wa.me/${digits}?text=`
    : "https://wa.me/?text=";
  return `${base}${encodeURIComponent(text)}`;
}

export function openWhatsApp(text: string, phone?: string | null): void {
  window.open(buildWhatsAppUrl(text, phone), "_blank", "noopener,noreferrer");
}

export interface DebtWhatsAppReminderInput {
  partyName: string;
  partyPhone?: string | null;
  direction: "receivable" | "payable";
  balanceLabel: string;
  currencyCode: string;
  dueOnLabel?: string | null;
  workspaceName?: string | null;
}

export function buildDebtWhatsAppReminderText(
  input: DebtWhatsAppReminderInput,
): string {
  const who = input.workspaceName?.trim() || "ميزان";
  const dueLine = input.dueOnLabel
    ? `\nتاريخ الاستحقاق: ${input.dueOnLabel}`
    : "";

  if (input.direction === "receivable") {
    return [
      `السلام عليكم ${input.partyName}،`,
      "",
      `تذكير ودي بالمبلغ المتبقي: ${input.balanceLabel} ${input.currencyCode}.${dueLine}`,
      "",
      `— ${who}`,
    ].join("\n");
  }

  return [
    `تذكير شخصي: مستحق لـ ${input.partyName}`,
    `المتبقي: ${input.balanceLabel} ${input.currencyCode}.${dueLine}`,
    "",
    `— ${who}`,
  ].join("\n");
}

export interface InvoiceWhatsAppInput {
  invoiceNumber: string;
  customerName: string;
  totalFormatted: string;
  currencyCode: string;
  itemsCount: number;
  issueDate?: string;
  workspaceName?: string | null;
}

export function buildInvoiceWhatsAppText(input: InvoiceWhatsAppInput): string {
  const who = input.workspaceName?.trim() || "ميزان";
  return [
    `السلام عليكم ${input.customerName}،`,
    "",
    `تفاصيل الفاتورة رقم: #${input.invoiceNumber}`,
    `المبلغ الإجمالي: ${input.totalFormatted} ${input.currencyCode}`,
    `عدد العناصر: ${input.itemsCount}`,
    input.issueDate ? `تاريخ الإصدار: ${input.issueDate}` : "",
    "",
    `شكراً لتعاملكم معنا!`,
    `— ${who}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export interface CustomerLedgerWhatsAppInput {
  customerName: string;
  totalDebits: string;
  totalCredits: string;
  netBalance: string;
  currencyCode: string;
  workspaceName?: string | null;
}

export function buildCustomerLedgerWhatsAppText(
  input: CustomerLedgerWhatsAppInput,
): string {
  const who = input.workspaceName?.trim() || "ميزان";
  return [
    `كشف حساب: ${input.customerName}`,
    `إجمالي المسحوبات/الخدمات: ${input.totalDebits} ${input.currencyCode}`,
    `إجمالي المدفوعات: ${input.totalCredits} ${input.currencyCode}`,
    `المتبقي المستحق: ${input.netBalance} ${input.currencyCode}`,
    "",
    `— صادرة من ${who}`,
  ].join("\n");
}
