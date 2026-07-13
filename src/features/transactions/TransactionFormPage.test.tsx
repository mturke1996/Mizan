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
import { TransactionFormPage } from "./TransactionFormPage";

function wrap(ui: React.ReactNode, route: string) {
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

describe("TransactionFormPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
    projectStore.getState().replaceProjects(demoProjects);
  });

  it("adds a precise LYD income and returns to the history", async () => {
    const user = userEvent.setup();
    const originalBalance = demoFinanceState.wallets[0]?.balanceMinor ?? 0n;

    render(
      wrap(
        <Routes>
          <Route path="/transactions/new" element={<TransactionFormPage />} />
          <Route path="/transactions" element={<p>تم حفظ المعاملة</p>} />
        </Routes>,
        "/transactions/new?type=income",
      ),
    );

    await user.type(screen.getByLabelText("المبلغ"), "100.500");
    await user.type(screen.getByLabelText("البيان"), "دفعة جديدة");
    await user.click(
      screen.getByRole("button", { name: "حفظ المعاملة" }),
    );

    expect(await screen.findByText("تم حفظ المعاملة")).toBeInTheDocument();
    expect(financeStore.getState().wallets[0]?.balanceMinor).toBe(
      originalBalance + 100_500n,
    );
  });

  it("announces validation errors beside invalid fields", async () => {
    const user = userEvent.setup();

    render(wrap(<TransactionFormPage />, "/transactions/new"));

    await user.click(
      screen.getByRole("button", { name: "حفظ المعاملة" }),
    );

    const amount = screen.getByLabelText("المبلغ");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAccessibleDescription("أدخل مبلغًا أكبر من صفر");
  });

  it("updates the linked project summary for a demo transaction", async () => {
    const user = userEvent.setup();
    projectStore.getState().replaceProjects([
      {
        id: "transaction-project",
        name: "مشروع تجريبي",
        description: "مشروع",
        status: "active",
        projectType: "services",
        modules: {
          transactions: true,
          goal: true,
          workers: false,
          capital: true,
          inventory: false,
        livestock: false,
        },
        goalMinor: 1_000_000n,
        incomeMinor: 100_000n,
        expenseMinor: 50_000n,
        profitMinor: 50_000n,
        progress: 10,
        mark: "م",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
        capitalMinor: 200_000n,
        capitalRecoveredRate: 25,
        inventoryValueMinor: 0n,
        inventoryItemCount: 0,
      },
    ]);

    render(
      wrap(
        <Routes>
          <Route path="/transactions/new" element={<TransactionFormPage />} />
          <Route path="/transactions" element={<p>تم حفظ المعاملة</p>} />
        </Routes>,
        "/transactions/new?type=income&project=transaction-project",
      ),
    );

    await user.type(screen.getByLabelText("المبلغ"), "100.000");
    await user.type(screen.getByLabelText("البيان"), "دفعة مشروع");
    await user.click(
      screen.getByRole("button", { name: "حفظ المعاملة" }),
    );
    await screen.findByText("تم حفظ المعاملة");

    expect(projectStore.getState().projects[0]).toMatchObject({
      incomeMinor: 200_000n,
      expenseMinor: 50_000n,
      profitMinor: 150_000n,
      progress: 20,
      capitalRecoveredRate: 75,
    });
  });
});
