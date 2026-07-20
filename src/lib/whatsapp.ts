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
