import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoProjects } from "@/features/projects/project-data";
import { projectStore } from "@/features/projects/project-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { TransactionDetailPage } from "./TransactionDetailPage";
import { TransactionFormPage } from "./TransactionFormPage";

describe("TransactionDetailPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
    projectStore.getState().replaceProjects(demoProjects);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the selected transaction details", () => {
    render(
      <MemoryRouter initialEntries={["/transactions/tx-1"]}>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <Routes>
            <Route
              path="/transactions/:transactionId"
              element={<TransactionDetailPage />}
            />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "دفعة من متجر الصقور" }),
    ).toBeInTheDocument();
    expect(screen.getByText("+1,250.000")).toBeInTheDocument();
    expect(screen.getByText("الحساب المصرفي")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "تعديل المعاملة" }),
    ).toHaveAttribute("href", "/transactions/tx-1/edit");
    expect(
      screen.getByRole("button", { name: "حذف المعاملة" }),
    ).toBeInTheDocument();
  });

  it("deletes the transaction and restores the wallet balance", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/transactions/tx-1"]}>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <Routes>
            <Route
              path="/transactions/:transactionId"
              element={<TransactionDetailPage />}
            />
            <Route path="/transactions" element={<div>قائمة المعاملات</div>} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "حذف المعاملة" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(
      financeStore.getState().transactions.find((item) => item.id === "tx-1"),
    ).toBeUndefined();
    expect(
      financeStore.getState().wallets.find((item) => item.id === "bank")
        ?.balanceMinor,
    ).toBe(7_500_000n);
    expect(screen.getByText("قائمة المعاملات")).toBeInTheDocument();
  });
});

describe("TransactionFormPage edit", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
    projectStore.getState().replaceProjects(demoProjects);
  });

  it("updates wallet amount and project for an existing transaction", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/transactions/tx-1/edit"]}>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <Routes>
            <Route
              path="/transactions/:transactionId/edit"
              element={<TransactionFormPage />}
            />
            <Route
              path="/transactions/:transactionId"
              element={<TransactionDetailPage />}
            />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "تعديل المعاملة" }),
    ).toBeInTheDocument();

    const amount = screen.getByLabelText("المبلغ");
    await user.clear(amount);
    await user.type(amount, "2000");

    await user.selectOptions(screen.getByLabelText("المحفظة / الخزنة"), "cash");
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    const updated = financeStore
      .getState()
      .transactions.find((item) => item.id === "tx-1");
    expect(updated?.walletId).toBe("cash");
    expect(updated?.amountMinor).toBe(2_000_000n);
    expect(
      financeStore.getState().wallets.find((item) => item.id === "bank")
        ?.balanceMinor,
    ).toBe(7_500_000n);
    expect(
      financeStore.getState().wallets.find((item) => item.id === "cash")
        ?.balanceMinor,
    ).toBe(4_450_000n);
  });
});
