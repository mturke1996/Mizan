import { describe, expect, it } from "vitest";
import { getAuthErrorMessage } from "./auth-messages";

describe("getAuthErrorMessage", () => {
  it("maps invalid credentials to Arabic", () => {
    expect(
      getAuthErrorMessage({
        message: "Invalid login credentials",
      }),
    ).toBe("البريد الإلكتروني أو كلمة المرور غير صحيحة");
  });

  it("does not expose whether a signup email already exists", () => {
    expect(
      getAuthErrorMessage({
        message: "User already registered",
      }),
    ).toBe("تعذر إنشاء الحساب. جرّب تسجيل الدخول أو استعادة كلمة المرور.");
  });

  it("explains compromised passwords safely", () => {
    expect(
      getAuthErrorMessage({
        message: "Password has been found in a data breach",
      }),
    ).toBe("كلمة المرور ظهرت في تسريب سابق. اختر كلمة مرور جديدة وفريدة.");
  });

  it("falls back to a safe Arabic message", () => {
    expect(
      getAuthErrorMessage({
        message: "Something unexpected",
      }),
    ).toBe("تعذر إكمال العملية. حاول مرة أخرى.");
  });
});
