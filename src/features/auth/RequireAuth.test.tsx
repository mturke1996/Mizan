import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider, type AuthContextValue } from "./AuthProvider";
import { demoAuthValue } from "./demo-auth";
import { RequireAuth } from "./RequireAuth";

function renderProtected(
  authValue: AuthContextValue,
  initialPath = "/",
): ReturnType<typeof render> {
  function Tree(): ReactElement {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <AuthProvider value={authValue}>
          <Routes>
            <Route
              path="/auth/update-password"
              element={<p>صفحة تحديث كلمة المرور</p>}
            />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<p>لوحة التحكم</p>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
  }

  return render(<Tree />);
}

describe("RequireAuth", () => {
  it("redirects required password changes away from the dashboard", () => {
    renderProtected({
      ...demoAuthValue,
      profile: {
        ...demoAuthValue.profile!,
        must_change_password: true,
      },
    });

    expect(screen.getByText("صفحة تحديث كلمة المرور")).toBeInTheDocument();
    expect(screen.queryByText("لوحة التحكم")).not.toBeInTheDocument();
  });

  it("allows an active profile without a password-change marker to see protected pages", () => {
    renderProtected(demoAuthValue);

    expect(screen.getByText("لوحة التحكم")).toBeInTheDocument();
  });
});
