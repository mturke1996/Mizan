import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import { demoAuthValue } from "@/features/auth/demo-auth";
import {
  demoFinanceState,
  financeStore,
} from "@/features/finance/finance-store";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import type { ProjectSummary } from "@/features/workspace/workspace-types";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { projectStore } from "./project-store";

function makeProject(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project-detail",
    name: "مشروع الدليل",
    description: "وصف مالي واضح",
    status: "active",
    projectType: "general",
    modules: {
      transactions: true,
      goal: false,
      workers: false,
      capital: false,
      inventory: false,
      livestock: false,
      ...overrides.modules,
    } as ProjectSummary["modules"],
    incomeMinor: 0n,
    expenseMinor: 0n,
    profitMinor: 0n,
    progress: 0,
    mark: "م",
    tone: "bg-primary-soft text-primary-ink",
    colorToken: "primary",
    outstandingLaborMinor: 0n,
    activeWorkers: 0,
    capitalMinor: 0n,
    capitalRecoveredRate: null,
    inventoryValueMinor: 0n,
    inventoryItemCount: 0,
    ...overrides,
  };
}

function projectTransaction(
  id: string,
  kind: "income" | "expense",
  amountMinor: bigint,
  title = id,
): FinanceTransaction {
  return {
    id,
    kind,
    walletId: "cash",
    amountMinor,
    currency: "LYD",
    title,
    projectId: "project-detail",
    occurredAt: "2026-07-13T08:00:00.000Z",
  };
}

function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

function renderPage({
  project = makeProject(),
  transactions = [],
  initialEntry = `/projects/${project.id}`,
}: {
  project?: ProjectSummary;
  transactions?: FinanceTransaction[];
  initialEntry?: string;
} = {}) {
  projectStore.getState().replaceProjects([project]);
  financeStore.getState().replaceState({
    wallets: demoFinanceState.wallets,
    transactions,
  });

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={demoWorkspaceValue}
      >
        <Routes>
          <Route
            path="/projects/:projectId"
            element={
              <>
                <ProjectDetailPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage", () => {
  beforeEach(() => {
    financeStore.getState().replaceState(demoFinanceState);
    projectStore.getState().replaceProjects([]);
  });

  it("omits disabled module tabs and normalizes a deep link without losing other query parameters", async () => {
    renderPage({
      initialEntry:
        "/projects/project-detail?project=retained-project&tab=workers",
    });

    const tabs = screen.getByRole("tablist", { name: "أقسام المشروع" });
    expect(within(tabs).getAllByRole("tab")).toHaveLength(3);
    expect(
      within(tabs).getByRole("tab", { name: "نظرة عامة" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(tabs).getByRole("tab", { name: "الخزينة" }),
    ).toBeInTheDocument();
    expect(
      within(tabs).getByRole("tab", { name: "المعاملات" }),
    ).toBeInTheDocument();
    expect(
      within(tabs).queryByRole("tab", { name: "العمال" }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("العمال");

    const panel = screen.getByRole("tabpanel");
    const overviewTab = within(tabs).getByRole("tab", {
      name: "نظرة عامة",
    });
    expect(overviewTab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", overviewTab.id);

    await waitFor(() => {
      const search = screen.getByTestId("location-search").textContent ?? "";
      expect(search).toContain("project=retained-project");
      expect(search).toContain("tab=overview");
    });
  });

  it("renders the adaptive tab set and links a requested panel to its tab", () => {
    const project = makeProject({
      modules: {
        transactions: true,
        goal: true,
        workers: true,
        capital: true,
        inventory: true,
      livestock: false,
      },
    });

    renderPage({
      project,
      initialEntry: `/projects/${project.id}?tab=inventory`,
    });

    const tabs = screen.getByRole("tablist", { name: "أقسام المشروع" });
    expect(
      within(tabs).getAllByRole("tab").map((tab) => tab.textContent),
    ).toEqual([
      "نظرة عامة",
      "الخزينة",
      "رأس المال",
      "العمال",
      "المخزون",
      "المعاملات",
    ]);
    const inventoryTab = within(tabs).getByRole("tab", {
      name: "المخزون",
    });
    const panel = screen.getByRole("tabpanel");
    expect(inventoryTab).toHaveAttribute("aria-selected", "true");
    expect(inventoryTab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", inventoryTab.id);
  });

  it("shows evidence-based hero health, type, exact stats, and overview content", () => {
    const project = makeProject({
      name: "متجر الصقور",
      projectType: "birds",
      modules: {
        transactions: true,
        goal: true,
        workers: true,
        capital: true,
        inventory: true,
      livestock: false,
      },
      goalMinor: 10_000n,
      incomeMinor: 9_000n,
      expenseMinor: 2_000n,
      profitMinor: 7_000n,
      progress: 90,
      outstandingLaborMinor: 1_000n,
      activeWorkers: 1,
      capitalMinor: 10_000n,
      capitalRecoveredRate: 60,
      inventoryValueMinor: 2_000n,
      inventoryItemCount: 1,
      colorToken: "warning",
    });
    renderPage({
      project,
      transactions: [
        projectTransaction("income-1", "income", 5_000n),
        projectTransaction("income-2", "income", 4_000n),
        projectTransaction("expense-1", "expense", 2_000n),
      ],
    });

    const hero = screen.getByRole("region", {
      name: "ملف المشروع متجر الصقور",
    });
    expect(
      within(hero).getByRole("heading", { name: "متجر الصقور" }),
    ).toBeInTheDocument();
    expect(within(hero).getByText("تربية طيور وعصافير")).toBeInTheDocument();
    expect(
      within(hero).getByRole("progressbar", { name: "صحة المشروع" }),
    ).toHaveAttribute("aria-valuenow", "90");
    expect(within(hero).getByText("ممتاز")).toBeInTheDocument();
    expect(within(hero).getByText("الربح بعد العمال")).toBeInTheDocument();
    expect(within(hero).getByText("6")).toHaveAttribute("dir", "ltr");
    expect(within(hero).getByText("هامش الربح")).toBeInTheDocument();
    expect(within(hero).getByText("66.66%")).toBeInTheDocument();
    expect(within(hero).getByText("استرداد رأس المال")).toBeInTheDocument();
    expect(within(hero).getByText("عائد رأس المال (ROI)")).toBeInTheDocument();
    expect(within(hero).getAllByText("60%").length).toBeGreaterThanOrEqual(1);
    expect(
      within(hero).getByRole("link", { name: "معاملة جديدة" }),
    ).toHaveAttribute(
      "href",
      "/transactions/new?project=project-detail",
    );
    expect(
      within(hero).getByRole("button", { name: "إعدادات المشروع" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "ملخص الأداء" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "اكتمل إعداد المشروع" }),
    ).toBeInTheDocument();
    expect(screen.getByText("مستحقات العمال مغطاة")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "اتجاه الدخل والمصروف للمشروع",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("التقدم نحو الهدف")).toBeInTheDocument();
  });

  it("shows actionable setup and a clear chart empty state without inventing a trend", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "خطوات الإعداد" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "سجّل أول معاملة" }),
    ).toHaveAttribute(
      "href",
      "/transactions/new?project=project-detail",
    );
    expect(
      screen.getByRole("heading", {
        name: "لا توجد بيانات كافية لرسم الاتجاه",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", {
        name: "اتجاه الدخل والمصروف للمشروع",
      }),
    ).not.toBeInTheDocument();
  });

  it("uses filtered demo history in the transactions tab", async () => {
    const user = userEvent.setup();
    renderPage({
      transactions: [
        projectTransaction("demo-history", "income", 1_250n, "دفعة تجريبية"),
        {
          ...projectTransaction("other", "income", 99n, "دفعة مشروع آخر"),
          projectId: "other-project",
        },
      ],
    });

    await user.click(screen.getByRole("tab", { name: "المعاملات" }));

    expect(screen.getByText("دفعة تجريبية")).toBeInTheDocument();
    expect(screen.queryByText("دفعة مشروع آخر")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "إضافة معاملة جديدة" }),
    ).toHaveAttribute(
      "href",
      "/transactions/new?project=project-detail",
    );
  });

  it("updates demo modules, clears a disabled goal, retains hidden data, and resolves the active tab", async () => {
    const user = userEvent.setup();
    const project = makeProject({
      projectType: "goods",
      modules: {
        transactions: true,
        goal: true,
        workers: true,
        capital: true,
        inventory: true,
      livestock: false,
      },
      goalMinor: 50_000n,
      outstandingLaborMinor: 7_500n,
      activeWorkers: 3,
      inventoryValueMinor: 19_000n,
      inventoryItemCount: 4,
    });
    renderPage({
      project,
      initialEntry: `/projects/${project.id}?tab=workers`,
    });

    expect(
      screen.getByRole("heading", {
        name: "سجل العمال واليوميات",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "تقويم الحضور اليومي" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "إعدادات المشروع" }),
    );

    const settings = screen.getByRole("dialog", {
      name: "إعدادات المشروع",
    });
    expect(
      within(settings).getAllByText("تجارة بضائع").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(settings).getByText(/إخفاء الوحدة لا يحذف بياناتها السابقة/),
    ).toBeInTheDocument();
    expect(
      within(settings).getByRole("checkbox", { name: "المعاملات" }),
    ).toBeDisabled();
    expect(
      within(settings).getByRole("textbox", { name: /هدف الإيرادات/ }),
    ).toBeInTheDocument();

    await user.click(
      within(settings).getByRole("checkbox", { name: "الهدف" }),
    );
    await user.click(
      within(settings).getByRole("checkbox", { name: "العمال" }),
    );
    await user.click(
      within(settings).getByRole("button", { name: "حفظ الإعدادات" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("tab", { name: "العمال" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "نظرة عامة" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    const stored = projectStore
      .getState()
      .projects.find((candidate) => candidate.id === project.id);
    expect(stored?.modules.goal).toBe(false);
    expect(stored?.modules.workers).toBe(false);
    expect(stored?.goalMinor).toBeUndefined();
    expect(stored?.outstandingLaborMinor).toBe(7_500n);
    expect(stored?.activeWorkers).toBe(3);
    expect(stored?.inventoryValueMinor).toBe(19_000n);
    expect(stored?.inventoryItemCount).toBe(4);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location-search")).toHaveTextContent(
        "tab=overview",
      );
    });
  });

  it("saves a goal amount from settings and completes the setup step", async () => {
    const user = userEvent.setup();
    renderPage({
      project: makeProject({
        modules: {
          transactions: true,
          goal: true,
          workers: false,
          capital: false,
          inventory: false,
        livestock: false,
        },
      }),
      transactions: [
        projectTransaction("seed-income", "income", 500n, "دفعة أولية"),
      ],
    });

    expect(
      screen.getByRole("button", { name: "حدّد هدف المشروع" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "إعدادات المشروع" }),
    );
    const settings = screen.getByRole("dialog", {
      name: "إعدادات المشروع",
    });
    const goalInput = within(settings).getByRole("textbox", {
      name: /هدف الإيرادات/,
    });
    await user.clear(goalInput);
    await user.type(goalInput, "1000");
    await user.click(
      within(settings).getByRole("button", { name: "حفظ الإعدادات" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const stored = projectStore
      .getState()
      .projects.find((candidate) => candidate.id === "project-detail");
    expect(stored?.goalMinor).toBe(1_000_000n);
    expect(
      screen.getByRole("heading", { name: "اكتمل إعداد المشروع" }),
    ).toBeInTheDocument();
  });

  it("records demo capital and inventory from their tabs", async () => {
    const user = userEvent.setup();
    const project = makeProject({
      modules: {
        transactions: true,
        goal: false,
        workers: false,
        capital: true,
        inventory: true,
      livestock: false,
      },
    });
    renderPage({
      project,
      initialEntry: `/projects/${project.id}?tab=capital`,
    });

    await user.click(screen.getByRole("button", { name: "مساهمة" }));
    await user.type(
      screen.getByLabelText(/مبلغ رأس المال/),
      "250",
    );
    await user.click(screen.getByRole("button", { name: "حفظ الحركة" }));

    await waitFor(() => {
      expect(projectStore.getState().projects[0]?.capitalMinor).toBe(
        250_000n,
      );
    });
    expect(screen.getAllByText("مساهمة").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: "المخزون" }));
    await user.type(screen.getByLabelText("اسم الصنف"), "علف");
    await user.type(screen.getByLabelText("الكمية"), "10");
    await user.type(screen.getByLabelText(/تكلفة الوحدة/), "5");
    await user.click(screen.getByRole("button", { name: "حفظ الصنف" }));

    await waitFor(() => {
      expect(projectStore.getState().projects[0]?.inventoryItemCount).toBe(1);
      expect(projectStore.getState().projects[0]?.inventoryValueMinor).toBe(
        50_000n,
      );
    });
    expect(screen.getByText("علف")).toBeInTheDocument();
  });
});
