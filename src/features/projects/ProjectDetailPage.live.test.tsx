import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import type { FinanceTransaction } from "@/domain/finance/finance-state";
import type {
  ProjectSummary,
  WorkerBalance,
  WorkLogEntry,
} from "@/features/workspace/workspace-types";

const mocks = vi.hoisted(() => ({
  projectTransactions: vi.fn(),
  projectsView: vi.fn(),
  financeView: vi.fn(),
  workersQuery: vi.fn(),
  workLogsQuery: vi.fn(),
  createWorkerHook: vi.fn(),
  recordWorkHook: vi.fn(),
  wageMovementHook: vi.fn(),
  updateProjectHook: vi.fn(),
  projectRefetch: vi.fn(),
  projectsRefresh: vi.fn(),
  financeRefresh: vi.fn(),
  workersRefetch: vi.fn(),
  workLogsRefetch: vi.fn(),
  createWorker: {
    mutateAsync: vi.fn(),
  },
  recordWork: {
    mutateAsync: vi.fn(),
  },
  wageMovement: {
    mutateAsync: vi.fn(),
  },
  updateProject: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  workspace: {
    current: {
      workspaceId: "workspace-1",
      currency: "LYD",
      isDemo: false,
    } as {
      workspaceId: string | null;
      currency: string;
      isDemo: boolean;
    },
  },
}));

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({ profile: { timezone: "UTC" } }),
}));

vi.mock("@/features/workspace/use-workspace", () => ({
  useWorkspace: () => mocks.workspace.current,
}));

vi.mock("@/features/workspace/use-finance-view", () => ({
  useProjectsView: () => mocks.projectsView(),
  useFinanceView: () => mocks.financeView(),
}));

vi.mock("@/features/workspace/use-finance-data", () => ({
  useProjectTransactionsQuery: (projectId: string | undefined) =>
    mocks.projectTransactions(projectId),
  useWorkersQuery: (projectId: string | undefined) =>
    mocks.workersQuery(projectId),
  useWorkLogsQuery: (projectId: string | undefined) =>
    mocks.workLogsQuery(projectId),
  useCreateWorkerMutation: (projectId: string) =>
    mocks.createWorkerHook(projectId),
  useRecordDailyWorkMutation: (projectId: string) =>
    mocks.recordWorkHook(projectId),
  usePostWageMovementMutation: (projectId: string) =>
    mocks.wageMovementHook(projectId),
  useUpdateProjectMutation: (projectId: string) =>
    mocks.updateProjectHook(projectId),
  useProjectAchievementUnlocksQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useWorkspaceAchievementUnlocksQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useRecordProjectAchievementUnlockMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRecordWorkspaceAchievementUnlockMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUnlockProjectAchievementMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useUnlockWorkspaceAchievementMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useProjectMembersQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useWorkspaceMemberOptionsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useUpsertProjectMemberMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSetProjectParentMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useLivestockBatchesQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useLivestockEventsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useCreateLivestockBatchMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  usePostLivestockEventMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useInventoryLocationsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useInventoryMovementsQuery: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
}));

import { ProjectDetailPage } from "./ProjectDetailPage";

const project: ProjectSummary = {
  id: "project-live",
  name: "مشروع مباشر",
  description: "سجل كامل",
  status: "active",
  projectType: "general",
  modules: {
    transactions: true,
    goal: false,
    workers: false,
    capital: false,
    inventory: false,
  livestock: false,
  },
  incomeMinor: 9_000n,
  expenseMinor: 1_000n,
  profitMinor: 8_000n,
  progress: 0,
  mark: "م",
  tone: "bg-primary-soft text-primary",
  colorToken: "primary",
  outstandingLaborMinor: 0n,
  activeWorkers: 0,
  capitalMinor: 0n,
  capitalRecoveredRate: null,
  inventoryValueMinor: 0n,
  inventoryItemCount: 0,
};

function transaction(
  id: string,
  title: string,
  amountMinor: bigint,
): FinanceTransaction {
  return {
    id,
    kind: "income",
    walletId: "wallet-1",
    amountMinor,
    currency: "LYD",
    title,
    projectId: project.id,
    occurredAt: "2026-07-10T10:00:00.000Z",
  };
}

function renderPage(
  initialEntry = `/projects/${project.id}`,
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/projects/:projectId"
          element={<ProjectDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectDetailPage live history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createWorker.mutateAsync.mockResolvedValue(undefined);
    mocks.recordWork.mutateAsync.mockResolvedValue(undefined);
    mocks.wageMovement.mutateAsync.mockResolvedValue(undefined);
    mocks.updateProject.isPending = false;
    mocks.updateProject.mutateAsync.mockResolvedValue(undefined);
    mocks.createWorkerHook.mockReturnValue(mocks.createWorker);
    mocks.recordWorkHook.mockReturnValue(mocks.recordWork);
    mocks.wageMovementHook.mockReturnValue(mocks.wageMovement);
    mocks.updateProjectHook.mockReturnValue(mocks.updateProject);
    mocks.workersQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.workersRefetch,
    });
    mocks.workLogsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.workLogsRefetch,
    });
    mocks.workspace.current = {
      workspaceId: "workspace-1",
      currency: "LYD",
      isDemo: false,
    };
    mocks.projectsView.mockReturnValue({
      projects: [project],
      isLoading: false,
      error: null,
      refresh: mocks.projectsRefresh,
    });
    mocks.financeView.mockReturnValue({
      wallets: [
        {
          id: "wallet-1",
          name: "الخزنة",
          currency: "LYD",
          balanceMinor: 20_000n,
        },
      ],
      transactions: [
        transaction("capped-global", "حركة من السجل المحدود", 9_000n),
      ],
      isLoading: false,
      error: null,
      refresh: mocks.financeRefresh,
    });
    mocks.projectTransactions.mockReturnValue({
      data: [transaction("full-history", "حركة من السجل الكامل", 125n)],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.projectRefetch,
    });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not query or render worker content when the module is disabled", () => {
    renderPage();

    expect(mocks.workersQuery).not.toHaveBeenCalled();
    expect(mocks.workLogsQuery).not.toHaveBeenCalled();
    expect(mocks.createWorkerHook).not.toHaveBeenCalled();
    expect(mocks.recordWorkHook).not.toHaveBeenCalled();
    expect(mocks.wageMovementHook).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("العمال");
  });

  it("uses complete live project history instead of the capped global feed", () => {
    renderPage(`/projects/${project.id}?tab=transactions`);

    expect(mocks.projectTransactions).toHaveBeenCalledWith(project.id);
    expect(screen.getByText("حركة من السجل الكامل")).toBeInTheDocument();
    expect(screen.queryByText("حركة من السجل المحدود")).not.toBeInTheDocument();
  });

  it("keeps demo mode on filtered in-memory transactions", () => {
    mocks.workspace.current = {
      workspaceId: null,
      currency: "LYD",
      isDemo: true,
    };

    renderPage(`/projects/${project.id}?tab=transactions`);

    expect(screen.getByText("حركة من السجل المحدود")).toBeInTheDocument();
    expect(screen.queryByText("حركة من السجل الكامل")).not.toBeInTheDocument();
  });

  it("preserves live worker balances, logs, actions, validations, and client IDs", async () => {
    const user = userEvent.setup();
    const workerProject: ProjectSummary = {
      ...project,
      modules: { ...project.modules, workers: true },
      outstandingLaborMinor: 3_000n,
      activeWorkers: 1,
    };
    const worker: WorkerBalance = {
      workerId: "worker-1",
      workspaceId: "workspace-1",
      projectId: project.id,
      name: "سالم",
      phone: null,
      dailyWageMinor: 1_250n,
      status: "active",
      balanceMinor: 3_000n,
      earnedMinor: 5_000n,
      withdrawnMinor: 1_500n,
      deductedMinor: 500n,
      workDays: 4,
    };
    const log: WorkLogEntry = {
      id: "log-1",
      workspaceId: "workspace-1",
      projectId: project.id,
      workerId: worker.workerId,
      entryType: "daily_wage",
      workDate: "2026-07-12",
      amountMinor: 1_250n,
      currencyCode: "LYD",
      note: null,
      createdAt: "2026-07-12T09:00:00.000Z",
    };
    mocks.projectsView.mockReturnValue({
      projects: [workerProject],
      isLoading: false,
      error: null,
      refresh: mocks.projectsRefresh,
    });
    mocks.workersQuery.mockReturnValue({
      data: [worker],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.workersRefetch,
    });
    mocks.workLogsQuery.mockReturnValue({
      data: [log],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mocks.workLogsRefetch,
    });

    renderPage(`/projects/${project.id}?tab=workers`);

    expect(mocks.workersQuery).toHaveBeenCalledWith(project.id);
    expect(mocks.workLogsQuery).toHaveBeenCalledWith(project.id);
    expect(screen.getAllByText("سالم")).toHaveLength(2);
    expect(screen.getByText("4 يوم عمل")).toBeInTheDocument();
    expect(screen.getByText("سالم · يومية")).toBeInTheDocument();

    await user.type(screen.getByLabelText("اسم العامل"), "محمود");
    await user.type(
      screen.getByLabelText("الأجر اليومي بعملة LYD"),
      "1.750",
    );
    await user.click(screen.getByRole("button", { name: "إضافة عامل" }));
    expect(mocks.createWorker.mutateAsync).toHaveBeenCalledWith({
      name: "محمود",
      dailyWageMinor: 1_750,
    });

    await user.selectOptions(screen.getByLabelText("العامل"), "worker-1");
    await user.click(screen.getByRole("button", { name: "حفظ الحركة" }));
    expect(mocks.recordWork.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: "worker-1",
        workDate: "2026-07-13",
        clientId: "00000000-0000-4000-8000-000000000001",
      }),
    );

    const toastError = vi.spyOn(toast, "error");
    await user.click(screen.getByRole("button", { name: "سحب" }));
    await user.type(
      screen.getByLabelText("مبلغ الحركة بعملة LYD"),
      "2.000",
    );
    await user.click(screen.getByRole("button", { name: "حفظ الحركة" }));
    expect(toastError).toHaveBeenCalledWith("اختر محفظة السحب");
    expect(mocks.wageMovement.mutateAsync).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByLabelText("محفظة سحب أجر العامل"),
      "wallet-1",
    );
    await user.click(screen.getByRole("button", { name: "حفظ الحركة" }));
    expect(window.confirm).toHaveBeenCalledWith(
      "تأكيد تسجيل سحب العامل من المحفظة؟",
    );
    expect(mocks.wageMovement.mutateAsync).toHaveBeenCalledWith({
      workerId: "worker-1",
      entryType: "withdrawal",
      amountMinor: 2_000,
      workDate: "2026-07-13",
      clientId: "00000000-0000-4000-8000-000000000001",
      walletId: "wallet-1",
    });
  });

  it("shows worker query errors inside the enabled tab and retries both sources", () => {
    mocks.projectsView.mockReturnValue({
      projects: [
        {
          ...project,
          modules: { ...project.modules, workers: true },
        },
      ],
      isLoading: false,
      error: null,
      refresh: mocks.projectsRefresh,
    });
    mocks.workersQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("تعذر تحميل أرصدة العمال"),
      refetch: mocks.workersRefetch,
    });

    renderPage(`/projects/${project.id}?tab=workers`);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "تعذر تحميل أرصدة العمال",
    );
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(mocks.workersRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.workLogsRefetch).toHaveBeenCalledTimes(1);
  });

  it("saves live module settings with clearGoal and resolves a disabled active tab", async () => {
    const user = userEvent.setup();
    mocks.projectsView.mockReturnValue({
      projects: [
        {
          ...project,
          projectType: "services",
          modules: {
            ...project.modules,
            goal: true,
            workers: true,
          },
          goalMinor: 25_000n,
        },
      ],
      isLoading: false,
      error: null,
      refresh: mocks.projectsRefresh,
    });

    renderPage(`/projects/${project.id}?tab=workers`);
    await user.click(
      screen.getByRole("button", { name: "إعدادات المشروع" }),
    );
    const settings = screen.getByRole("dialog", {
      name: "إعدادات المشروع",
    });
    await user.click(
      within(settings).getByRole("checkbox", { name: "الهدف" }),
    );
    await user.click(
      within(settings).getByRole("checkbox", { name: "العمال" }),
    );
    await user.click(
      within(settings).getByRole("button", { name: "حفظ الإعدادات" }),
    );

    expect(mocks.updateProjectHook).toHaveBeenCalledWith(project.id);
    expect(mocks.updateProject.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.updateProject.mutateAsync).toHaveBeenCalledWith({
      projectType: "services",
      modules: {
        transactions: true,
        goal: false,
        workers: false,
        capital: false,
        inventory: false,
      livestock: false,
      },
      clearGoal: true,
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("tab", { name: "العمال" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "نظرة عامة" }),
      ).toHaveAttribute("aria-selected", "true");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows live project-history loading and error states with retry", () => {
    mocks.projectTransactions.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: mocks.projectRefetch,
    });
    const firstRender = renderPage();

    expect(
      screen.getByLabelText("جاري تحميل تفاصيل المشروع"),
    ).toBeInTheDocument();

    firstRender.unmount();
    mocks.projectTransactions.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("تعذر تحميل السجل الكامل"),
      refetch: mocks.projectRefetch,
    });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "تعذر تحميل السجل الكامل",
    );
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(mocks.projectRefetch).toHaveBeenCalledTimes(1);
    expect(mocks.projectsRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.financeRefresh).toHaveBeenCalledTimes(1);
  });
});
