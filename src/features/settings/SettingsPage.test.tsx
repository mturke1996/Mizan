import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  AuthProvider,
  type AuthContextValue,
} from "@/features/auth/AuthProvider";
import { demoAuthValue } from "@/features/auth/demo-auth";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { SettingsPage } from "./SettingsPage";

function renderSettings(authValue: AuthContextValue = demoAuthValue) {
  return render(
    <MemoryRouter>
      <AuthProvider value={authValue}>
        <WorkspaceProvider value={demoWorkspaceValue}>
          <SettingsPage />
        </WorkspaceProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("shows account and subscription settings", () => {
    renderSettings();

    expect(
      screen.getByRole("heading", { name: "الإعدادات" }),
    ).toBeInTheDocument();
    expect(screen.getByText("الاشتراك والفوترة")).toBeInTheDocument();
    expect(screen.getByText("الدينار الليبي (LYD)")).toBeInTheDocument();
    expect(screen.getByText("محمد المركي")).toBeInTheDocument();
    expect(screen.getByText("demo@mizan.app")).toBeInTheDocument();
  });

  it("applies and persists dark mode", async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(
      screen.getByRole("switch", { name: "استخدام الوضع الداكن" }),
    );

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("mizan-theme")).toBe("dark");
  });

  it("shows a logout action", () => {
    renderSettings();

    expect(
      screen.getByRole("button", { name: "تسجيل الخروج" }),
    ).toBeInTheDocument();
  });

  it("shows the manager dashboard entry for supervisor accounts", () => {
    renderSettings({
      ...demoAuthValue,
      profile: demoAuthValue.profile
        ? { ...demoAuthValue.profile, system_role: "supervisor" }
        : null,
    });

    expect(
      screen.getByRole("link", { name: /لوحة تحكم المدير/ }),
    ).toHaveAttribute("href", "/supervisor");
  });
});
