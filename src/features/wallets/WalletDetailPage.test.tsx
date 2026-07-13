import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { WalletDetailPage } from "./WalletDetailPage";

describe("WalletDetailPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
  });

  it("shows the selected wallet and its transactions", () => {
    render(
      <MemoryRouter initialEntries={["/wallets/cash"]}>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <Routes>
            <Route path="/wallets/:walletId" element={<WalletDetailPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "المحفظة النقدية" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2,450.000")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "تحويل من هذه المحفظة" }),
    ).toHaveAttribute("href", "/transfer?from=cash");
    expect(
      screen.getByRole("button", { name: "تعديل رصيد الخزنة" }),
    ).toBeInTheDocument();
  });

  it("updates the wallet balance from the edit control", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/wallets/cash"]}>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <Routes>
            <Route path="/wallets/:walletId" element={<WalletDetailPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "تعديل رصيد الخزنة" }));
    const input = screen.getByLabelText("الرصيد المستهدف بعملة LYD");
    await user.clear(input);
    await user.type(input, "3000");
    await user.click(screen.getByRole("button", { name: "حفظ الرصيد" }));

    expect(financeStore.getState().wallets[0]?.balanceMinor).toBe(3_000_000n);
  });
});
