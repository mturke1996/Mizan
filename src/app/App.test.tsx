import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { AppProviders } from "./AppProviders";
import { App } from "./App";

function renderApp(route = "/") {
  financeStore.getState().replaceState(demoFinanceState);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={demoWorkspaceValue}
      >
        <App />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("renders the Arabic dashboard as the initial route", () => {
    renderApp("/");

    expect(
      screen.getByRole("heading", { name: "ملخصك المالي" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("24,850").length).toBeGreaterThan(0);
  });

  it("shows five labeled primary navigation destinations", () => {
    renderApp("/");

    const navigation = screen.getByRole("navigation", {
      name: "التنقل الرئيسي",
    });
    const navigationQueries = within(navigation);

    expect(navigation).toBeInTheDocument();
    expect(
      navigationQueries.getByRole("link", { name: "الرئيسية" }),
    ).toBeInTheDocument();
    expect(
      navigationQueries.getByRole("link", { name: "المعاملات" }),
    ).toBeInTheDocument();
    expect(
      navigationQueries.getByRole("link", { name: "المشاريع" }),
    ).toBeInTheDocument();
    expect(
      navigationQueries.getByRole("link", { name: "المحافظ" }),
    ).toBeInTheDocument();
    expect(
      navigationQueries.getByRole("link", { name: "أموالي" }),
    ).toHaveAttribute("href", "/debts");
  });

  it("renders the personal income route", async () => {
    renderApp("/income");

    expect(
      await screen.findByRole("heading", { name: "دخلي" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "أقسام أموالي" }),
    ).toBeInTheDocument();
  });

  it("renders the debt register route", () => {
    renderApp("/debts");

    expect(
      screen.getByRole("heading", { name: "الديون" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "أقسام أموالي" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "فواتير" })).toHaveAttribute(
      "href",
      "/invoices",
    );
  });

  it("moves focus to the new screen heading after navigation", async () => {
    const user = userEvent.setup();
    renderApp("/");

    const navigation = screen.getByRole("navigation", {
      name: "التنقل الرئيسي",
    });

    await user.click(
      within(navigation).getByRole("link", { name: "المعاملات" }),
    );

    expect(
      screen.getByRole("heading", { name: "المعاملات" }),
    ).toHaveFocus();
  });

  it("exposes the notifications link", () => {
    renderApp("/");

    expect(
      screen.getByRole("link", {
        name: "الإشعارات",
      }),
    ).toHaveAttribute("href", "/notifications");
  });

  it("renders the login screen for guests", () => {
    function GuestApp(): ReactElement {
      return (
        <MemoryRouter initialEntries={["/"]}>
          <AppProviders
            authValue={{
              ...demoAuthValue,
              session: null,
              user: null,
              profile: null,
            }}
            workspaceValue={demoWorkspaceValue}
          >
            <App />
          </AppProviders>
        </MemoryRouter>
      );
    }

    render(<GuestApp />);

    expect(
      screen.getByRole("heading", { name: "مرحباً بعودتك" }),
    ).toBeInTheDocument();
  });
});
