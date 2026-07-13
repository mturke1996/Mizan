import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("guest authentication", () => {
  test("redirects guests and exposes a complete login flow", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "مرحباً بعودتك" }),
    ).toBeVisible();
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
    await expect(page.getByLabel("كلمة المرور", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "نسيت كلمة المرور؟" }),
    ).toHaveAttribute("href", "/auth/forgot-password");

    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page.getByText("أدخل بريدك الإلكتروني")).toBeVisible();
    await expect(page.getByText("أدخل كلمة المرور")).toBeVisible();

    await page
      .getByLabel("كلمة المرور", { exact: true })
      .fill("MizanSafe2026");
    await page.getByRole("button", { name: "إظهار كلمة المرور" }).click();
    await expect(
      page.getByLabel("كلمة المرور", { exact: true }),
    ).toHaveAttribute("type", "text");
  });

  test("validates signup password and confirmation before sending", async ({
    page,
  }) => {
    await page.goto("/auth/signup");

    await page.getByLabel("الاسم").fill("محمد");
    await page.getByLabel("البريد الإلكتروني").fill("user@example.com");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("weak");
    await page.getByLabel("تأكيد كلمة المرور").fill("different");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();

    await expect(
      page.getByText("استوفِ متطلبات كلمة المرور أدناه"),
    ).toBeVisible();
    await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible();
  });

  test("validates password recovery without exposing accounts", async ({
    page,
  }) => {
    await page.goto("/auth/forgot-password");

    await expect(
      page.getByRole("heading", { name: "استعادة كلمة المرور" }),
    ).toBeVisible();
    await page.getByLabel("البريد الإلكتروني").fill("not-an-email");
    await page.getByRole("button", { name: "إرسال رابط الاستعادة" }).click();
    await expect(
      page.getByText("أدخل بريدًا إلكترونيًا صحيحًا"),
    ).toBeVisible();
  });

  test("applies the saved dark theme before rendering authentication", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("mizan-theme", "dark");
    });
    await page.goto("/auth/login");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#10111A",
    );
  });

  for (const route of [
    "/auth/login",
    "/auth/signup",
    "/auth/forgot-password",
    "/auth/update-password",
  ]) {
    test(`has no automatically detectable accessibility issues at ${route}`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.getByRole("main")).toBeVisible();

      const result = await new AxeBuilder({ page }).analyze();

      expect(result.violations).toEqual([]);
    });
  }
});
