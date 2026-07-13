import { describe, expect, it } from "vitest";
import {
  getPasswordChecks,
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
} from "./password-policy";

describe("password policy", () => {
  it("requires length, a letter, and a number", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(getPasswordChecks("قصيرة1")).toEqual({
      hasMinimumLength: false,
      hasLetter: true,
      hasNumber: true,
    });
    expect(isStrongPassword("strong-password")).toBe(false);
    expect(isStrongPassword("1234567890")).toBe(false);
  });

  it("supports Arabic letters and numerals", () => {
    expect(isStrongPassword("ميزانآمن١٢٣٤")).toBe(true);
  });

  it("accepts a strong Latin password", () => {
    expect(isStrongPassword("MizanSafe2026")).toBe(true);
  });
});
