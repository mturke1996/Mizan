import { describe, expect, it } from "vitest";
import {
  buildDebtWhatsAppReminderText,
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
});
