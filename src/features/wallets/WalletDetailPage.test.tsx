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
    expect(screen.getByText("2,450")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "تحويل من هذه المحفظة" }),
    ).toHaveAttribute("href", "/transfer?from=cash");
    expect(
      screen.getByRole("button", { name: "تمويل الخزينة" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "سحب من الخزينة" }),
    ).toBeInTheDocument();
  });

  it("funds the treasury and records a movement", async () => {
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

    await user.click(screen.getByRole("button", { name: "تمويل الخزينة" }));
    const input = screen.getByLabelText("مبلغ التمويل بعملة LYD");
    await user.clear(input);
    await user.type(input, "550");
    await user.click(screen.getByRole("button", { name: "تأكيد التمويل" }));

    expect(financeStore.getState().wallets[0]?.balanceMinor).toBe(3_000_000n);
    expect(financeStore.getState().transactions[0]).toMatchObject({
      kind: "opening_balance",
      flow: "in",
      amountMinor: 550_000n,
    });
  });
});
