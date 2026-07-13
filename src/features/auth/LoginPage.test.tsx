import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, type AuthContextValue } from "./AuthProvider";
import { LoginPage } from "./LoginPage";

function renderLogin(signIn = vi.fn(async () => undefined)) {
  const authValue: AuthContextValue = {
    session: null,
    user: null,
    profile: null,
    isLoading: false,
    signIn,
    signUp: async () => ({ requiresEmailConfirmation: false }),
    requestPasswordReset: async () => undefined,
    updatePassword: async () => undefined,
    signOut: async () => undefined,
    refreshProfile: async () => undefined,
  };

  render(
    <MemoryRouter>
      <AuthProvider value={authValue}>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
  return signIn;
}

describe("LoginPage", () => {
  it("rejects malformed email locally without calling the server", async () => {
    const user = userEvent.setup();
    const signIn = renderLogin();

    await user.type(screen.getByLabelText("البريد الإلكتروني"), "invalid");
    await user.type(screen.getByLabelText("كلمة المرور"), "secret");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(
      screen.getByText("أدخل بريدًا إلكترونيًا صحيحًا"),
    ).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("submits normalized credentials", async () => {
    const user = userEvent.setup();
    const signIn = renderLogin();

    await user.type(
      screen.getByLabelText("البريد الإلكتروني"),
      "  user@example.com  ",
    );
    await user.type(screen.getByLabelText("كلمة المرور"), "secret");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));

    expect(signIn).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "secret",
    });
  });
});
