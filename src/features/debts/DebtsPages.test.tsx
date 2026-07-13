import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoProjects } from "@/features/projects/project-data";
import { projectStore } from "@/features/projects/project-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { debtStore, demoDebtState } from "./debt-store";
import { DebtDetailPage } from "./DebtDetailPage";
import { DebtFormPage } from "./DebtFormPage";
import { DebtsPage } from "./DebtsPage";

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="الرابط الحالي">{location.search}</output>;
}

function DebtDestination() {
  const { debtId } = useParams();
  return <p>تفاصيل الدين المحفوظ: {debtId}</p>;
}

function renderDemo(ui: React.ReactNode, initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={demoWorkspaceValue}
      >
        {ui}
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("debt pages", () => {
  beforeEach(() => {
    debtStore.getState().replaceState(demoDebtState);
    financeStore.getState().replaceState(demoFinanceState);
    projectStore.getState().replaceProjects(demoProjects);
  });

  it("keeps list filters in the URL and shows the matching debt rows", async () => {
    const user = userEvent.setup();
    renderDemo(
      <>
        <DebtsPage />
        <LocationProbe />
      </>,
      "/debts?filter=payable",
    );

    expect(
      screen.getByRole("heading", { name: "الديون" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("شركة النور")).not.toBeInTheDocument();
    expect(screen.getByText("لا توجد ديون مطابقة")).toBeInTheDocument();

    const filters = screen.getByRole("navigation", { name: "تصفية الديون" });
    await user.click(within(filters).getByRole("link", { name: "الكل" }));

    expect(screen.getByText("شركة النور")).toBeInTheDocument();
    expect(screen.getByLabelText("الرابط الحالي")).toHaveTextContent(
      "?filter=all",
    );
  });

  it("creates a precise demo debt and redirects to its detail route", async () => {
    const user = userEvent.setup();
    debtStore.getState().replaceState({
      parties: [],
      debts: [],
      entriesByDebt: {},
      creationByClientId: {},
      entriesByClientOperation: {},
    });

    renderDemo(
      <Routes>
        <Route path="/debts/new" element={<DebtFormPage />} />
        <Route path="/debts/:debtId" element={<DebtDestination />} />
      </Routes>,
      "/debts/new",
    );

    await user.click(screen.getByRole("radio", { name: "مستحق لي" }));
    await user.type(screen.getByLabelText("اسم الطرف"), "محمود السنوسي");
    await user.type(screen.getByLabelText("رقم الهاتف (اختياري)"), "0912345678");
    await user.type(screen.getByLabelText("المبلغ"), "125.500");
    await user.type(
      screen.getByLabelText("تاريخ الاستحقاق (اختياري)"),
      "2026-08-01",
    );
    await user.click(screen.getByRole("button", { name: "إنشاء الدين" }));

    expect(
      await screen.findByText(/تفاصيل الدين المحفوظ:/),
    ).toBeInTheDocument();
    const created = debtStore.getState().debts[0];
    expect(created).toMatchObject({
      partyName: "محمود السنوسي",
      partyPhone: "0912345678",
      direction: "receivable",
      principalMinor: 125_500n,
      balanceMinor: 125_500n,
      dueOn: "2026-08-01",
      status: "open",
    });
  });

  it("posts a partial demo payment and records its wallet transaction", async () => {
    const user = userEvent.setup();
    renderDemo(
      <Routes>
        <Route path="/debts/:debtId" element={<DebtDetailPage />} />
      </Routes>,
      "/debts/demo-debt-receivable",
    );

    expect(
      screen.getByRole("heading", { name: "شركة النور" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("مبلغ الحركة"), "500");
    await user.selectOptions(
      screen.getByLabelText("المحفظة (اختياري)"),
      "bank",
    );
    await user.click(screen.getByRole("button", { name: "حفظ الحركة" }));

    await waitFor(() => {
      expect(
        debtStore
          .getState()
          .debts.find((debt) => debt.id === "demo-debt-receivable")
          ?.balanceMinor,
      ).toBe(1_000_000n);
    });
    expect(
      debtStore.getState().entriesByDebt["demo-debt-receivable"]?.[0],
    ).toMatchObject({
      entryType: "payment",
      amountMinor: -500_000n,
    });
    expect(
      financeStore.getState().wallets.find((wallet) => wallet.id === "bank")
        ?.balanceMinor,
    ).toBe(9_250_000n);
    expect(
      screen.getByLabelText("الرصيد المتبقي"),
    ).toHaveTextContent("1,000.000");
  });
});
