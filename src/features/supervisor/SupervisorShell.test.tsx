import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { demoAuthValue } from "@/features/auth/demo-auth";
import { SupervisorShell } from "./SupervisorShell";

vi.mock("./supervisor-api", async () => {
  const actual = await vi.importActual<typeof import("./supervisor-api")>(
    "./supervisor-api",
  );
  return {
    ...actual,
    fetchPlatformStats: vi.fn().mockResolvedValue({
      total_workspaces: 1,
      total_users: 1,
      trialing_count: 0,
      active_count: 1,
      frozen_count: 0,
      churned_count: 0,
      pending_payments: 2,
      pending_amount_minor: "0",
      suspended_users: 0,
    }),
  };
});

function renderSupervisor(role: "user" | "supervisor") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/supervisor"]}>
        <AuthProvider
          value={{
            ...demoAuthValue,
            profile: demoAuthValue.profile
              ? { ...demoAuthValue.profile, system_role: role }
              : null,
          }}
        >
          <Routes>
            <Route path="/" element={<h1>الرئيسية</h1>} />
            <Route element={<SupervisorShell />}>
              <Route path="supervisor" element={<h1>لوحة المدير الفعلية</h1>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorShell", () => {
  it("allows supervisor accounts to open the manager dashboard", () => {
    renderSupervisor("supervisor");

    expect(
      screen.getByRole("heading", { name: "لوحة المدير الفعلية" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "تنقل لوحة المدير" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /العملاء/ }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: /الاشتراكات/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /الخطط/ }).length).toBeGreaterThan(0);
  });

  it("redirects regular users away from supervisor routes", () => {
    renderSupervisor("user");

    expect(screen.getByRole("heading", { name: "الرئيسية" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "لوحة المدير الفعلية" }),
    ).not.toBeInTheDocument();
  });
});
