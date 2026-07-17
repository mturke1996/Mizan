import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { WalletsPage } from "./WalletsPage";

describe("WalletsPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
  });

  it("shows the combined balance and every wallet", () => {
    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <WalletsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "المحافظ" }),
    ).toBeInTheDocument();
    expect(screen.getByText("24,850")).toBeInTheDocument();
    expect(screen.getAllByText("المحفظة النقدية").length).toBeGreaterThan(0);
    expect(screen.getAllByText("محفظة الاستثمارات").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "تحويل" })).toHaveAttribute(
      "href",
      "/transfer",
    );
  });

  it("teaches a new user how to create the first wallet", () => {
    financeStore.getState().replaceState({ wallets: [], transactions: [] });

    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <WalletsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.getByText("ابدأ بمحفظتك الأولى")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "إنشاء محفظة" }),
    ).toHaveAttribute("href", "/wallets/new");
    expect(screen.queryByText("24,850")).not.toBeInTheDocument();
  });
});
