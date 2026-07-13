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
import { WalletFormPage } from "./WalletFormPage";

describe("WalletFormPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
  });

  it("creates a wallet with an exact opening balance", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/wallets/new"]}>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <Routes>
            <Route path="/wallets/new" element={<WalletFormPage />} />
            <Route path="/wallets" element={<p>تم إنشاء المحفظة</p>} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("اسم المحفظة"), "مصروف المنزل");
    await user.type(screen.getByLabelText("الرصيد الافتتاحي"), "250.000");
    await user.click(screen.getByRole("button", { name: "إنشاء المحفظة" }));

    expect(await screen.findByText("تم إنشاء المحفظة")).toBeInTheDocument();
    expect(financeStore.getState().wallets.at(-1)?.balanceMinor).toBe(
      250_000n,
    );
  });
});
