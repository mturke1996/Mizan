import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { TransactionsPage } from "./TransactionsPage";

function wrap(ui: React.ReactNode) {
  return (
    <MemoryRouter>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={demoWorkspaceValue}
      >
        {ui}
      </AppProviders>
    </MemoryRouter>
  );
}

describe("TransactionsPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
  });

  it("renders the searchable transaction history", () => {
    render(wrap(<TransactionsPage />));

    expect(
      screen.getByRole("heading", { name: "المعاملات" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "البحث في المعاملات" }),
    ).toBeInTheDocument();
    expect(screen.getByText("دفعة من متجر الصقور")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "إضافة معاملة" }),
    ).toHaveAttribute("href", "/transactions/new");
  });

  it("shows a useful empty state when search has no matches", async () => {
    const user = userEvent.setup();

    render(wrap(<TransactionsPage />));

    await user.type(
      screen.getByRole("searchbox", { name: "البحث في المعاملات" }),
      "غير موجود",
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "لا توجد معاملات مطابقة",
    );
  });
});
