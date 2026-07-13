import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "./money";

describe("getCurrencyScale", () => {
  it("uses three minor digits for the Libyan dinar", () => {
    expect(getCurrencyScale("LYD")).toBe(3);
  });

  it("uses ISO currency precision instead of assuming two digits", () => {
    expect(getCurrencyScale("KRW")).toBe(0);
    expect(getCurrencyScale("JOD")).toBe(3);
  });
});

describe("parseMajorAmount", () => {
  it("parses a decimal amount without floating point rounding", () => {
    expect(parseMajorAmount("1250.5", 3)).toBe(1_250_500n);
  });

  it("rejects values with more digits than the currency supports", () => {
    expect(() => parseMajorAmount("12.3456", 3)).toThrow(
      "الحد الأقصى للأجزاء العشرية هو 3",
    );
  });

  it("rejects malformed grouping separators", () => {
    expect(() => parseMajorAmount("1,,2", 3)).toThrow(
      "أدخل مبلغًا صحيحًا",
    );
  });
});

describe("toSafeMinorNumber", () => {
  it("preserves exact minor units accepted by the API", () => {
    expect(toSafeMinorNumber(1_250_500n)).toBe(1_250_500);
  });

  it("rejects values that JavaScript cannot represent exactly", () => {
    expect(() =>
      toSafeMinorNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    ).toThrow("المبلغ أكبر من الحد الآمن للحفظ");
  });
});

describe("formatMinorAmount", () => {
  it("formats LYD using the requested visible fraction digits", () => {
    expect(
      formatMinorAmount(24_850_000n, {
        currency: "LYD",
        locale: "en-US",
        fractionDigits: 2,
      }),
    ).toBe("24,850.00");
  });

  it("preserves negative values", () => {
    expect(
      formatMinorAmount(-1_250_000n, {
        currency: "LYD",
        locale: "en-US",
        fractionDigits: 2,
      }),
    ).toBe("-1,250.00");
  });
});
