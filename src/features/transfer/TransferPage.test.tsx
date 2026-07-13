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
import { TransferPage } from "./TransferPage";

function wrap(ui: React.ReactNode, route = "/transfer") {
  return (
    <MemoryRouter initialEntries={[route]}>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={demoWorkspaceValue}
      >
        {ui}
      </AppProviders>
    </MemoryRouter>
  );
}

describe("TransferPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
  });

  it("moves money between the selected wallets", async () => {
    const user = userEvent.setup();
    const sourceBefore = demoFinanceState.wallets[0]?.balanceMinor ?? 0n;
    const destinationBefore =
      demoFinanceState.wallets[1]?.balanceMinor ?? 0n;

    render(
      wrap(
        <Routes>
          <Route path="/transfer" element={<TransferPage />} />
          <Route path="/wallets" element={<p>تم التحويل بنجاح</p>} />
        </Routes>,
      ),
    );

    await user.type(screen.getByLabelText("مبلغ التحويل"), "100.000");
    await user.click(screen.getByRole("button", { name: "تأكيد التحويل" }));

    expect(await screen.findByText("تم التحويل بنجاح")).toBeInTheDocument();
    expect(financeStore.getState().wallets[0]?.balanceMinor).toBe(
      sourceBefore - 100_000n,
    );
    expect(financeStore.getState().wallets[1]?.balanceMinor).toBe(
      destinationBefore + 100_000n,
    );
  });

  it("announces when the source balance is insufficient", async () => {
    const user = userEvent.setup();

    render(wrap(<TransferPage />));

    await user.type(screen.getByLabelText("مبلغ التحويل"), "99999");
    await user.click(screen.getByRole("button", { name: "تأكيد التحويل" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "الرصيد غير كافٍ لإتمام التحويل",
    );
  });

  it("does not offer a transfer between different currencies", () => {
    financeStore.getState().replaceState({
      wallets: [
        {
          id: "lyd",
          name: "دينار",
          currency: "LYD",
          balanceMinor: 10_000n,
        },
        {
          id: "usd",
          name: "دولار",
          currency: "USD",
          balanceMinor: 10_000n,
        },
      ],
      transactions: [],
    });

    render(wrap(<TransferPage />));

    expect(
      screen.getByRole("heading", {
        name: "تحتاج محفظتين بالعملة نفسها",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "تأكيد التحويل" }),
    ).not.toBeInTheDocument();
  });
});
