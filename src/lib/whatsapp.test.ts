import { describe, expect, it } from "vitest";
import {
  buildCustomerLedgerWhatsAppText,
  buildDebtWhatsAppReminderText,
  buildInvoiceWhatsAppText,
  buildWhatsAppUrl,
  toWhatsAppDigits,
} from "./whatsapp";

describe("whatsapp helpers", () => {
  it("strips non-digits from phone", () => {
    expect(toWhatsAppDigits("+218 91-234-5678")).toBe("218912345678");
    expect(toWhatsAppDigits(null)).toBe("");
  });

  it("builds wa.me url with and without phone", () => {
    expect(buildWhatsAppUrl("مرحبا", "0912345678")).toBe(
      `https://wa.me/0912345678?text=${encodeURIComponent("مرحبا")}`,
    );
    expect(buildWhatsAppUrl("مرحبا")).toBe(
      `https://wa.me/?text=${encodeURIComponent("مرحبا")}`,
    );
  });

  it("builds receivable reminder text", () => {
    const text = buildDebtWhatsAppReminderText({
      partyName: "أحمد",
      direction: "receivable",
      balanceLabel: "150.000",
      currencyCode: "LYD",
      dueOnLabel: "20 يوليو 2026",
      workspaceName: "ورشة النور",
    });
    expect(text).toContain("أحمد");
    expect(text).toContain("150.000 LYD");
    expect(text).toContain("20 يوليو 2026");
    expect(text).toContain("ورشة النور");
  });

  it("builds payable self-reminder text", () => {
    const text = buildDebtWhatsAppReminderText({
      partyName: "محمد",
      direction: "payable",
      balanceLabel: "50",
      currencyCode: "LYD",
    });
    expect(text).toContain("مستحق لـ محمد");
    expect(text).toContain("50 LYD");
  });

  it("builds invoice whatsapp message", () => {
    const text = buildInvoiceWhatsAppText({
      invoiceNumber: "INV-101",
      customerName: "خالد",
      totalFormatted: "450.000",
      currencyCode: "LYD",
      itemsCount: 3,
      workspaceName: "ميزان للتجارة",
    });
    expect(text).toContain("خالد");
    expect(text).toContain("INV-101");
    expect(text).toContain("450.000 LYD");
    expect(text).toContain("ميزان للتجارة");
  });

  it("builds customer ledger whatsapp message", () => {
    const text = buildCustomerLedgerWhatsAppText({
      customerName: "سالم",
      totalDebits: "1000",
      totalCredits: "400",
      netBalance: "600",
      currencyCode: "LYD",
      workspaceName: "شركة البناء",
    });
    expect(text).toContain("كشف حساب: سالم");
    expect(text).toContain("600 LYD");
    expect(text).toContain("شركة البناء");
  });
});
