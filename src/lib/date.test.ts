import {
  formatDashboardDate,
  formatPlainDateAr,
  getArabicGreeting,
  getDateKeyInTimeZone,
} from "./date";

describe("getArabicGreeting", () => {
  it("uses a morning greeting before noon", () => {
    expect(getArabicGreeting(new Date(2026, 6, 13, 8))).toBe("صباح الخير");
  });

  it("uses an evening greeting from noon onward", () => {
    expect(getArabicGreeting(new Date(2026, 6, 13, 16))).toBe("مساء الخير");
  });
});

describe("formatDashboardDate", () => {
  it("formats the actual date with western digits for financial clarity", () => {
    const formatted = formatDashboardDate(new Date(2026, 6, 13));

    expect(formatted).toContain("13");
    expect(formatted).toContain("يوليو");
  });
});

describe("financial date helpers", () => {
  it("uses the user's timezone when choosing today's work date", () => {
    const instant = new Date("2026-07-13T23:30:00.000Z");

    expect(getDateKeyInTimeZone(instant, "Africa/Tripoli")).toBe("2026-07-14");
    expect(getDateKeyInTimeZone(instant, "America/New_York")).toBe(
      "2026-07-13",
    );
  });

  it("formats database dates without shifting the calendar day", () => {
    const formatted = formatPlainDateAr("2026-07-13");

    expect(formatted).toContain("13");
    expect(formatted).toContain("يوليو");
  });
});
