import { createProjectStore } from "./project-store";
import type { ProjectModules } from "@/features/workspace/workspace-types";

describe("createProjectStore", () => {
  it("adds a new project to the beginning of the list", () => {
    const store = createProjectStore([]);

    store.getState().addProject({
      id: "project-1",
      name: "مشروع جديد",
      description: "وصف المشروع",
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
      incomeMinor: 0n,
      expenseMinor: 0n,
      profitMinor: 0n,
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
    });

    expect(store.getState().projects[0]?.name).toBe("مشروع جديد");
  });

  it("creates and updates enhanced blueprint fields in demo mode", () => {
    const store = createProjectStore([]);
    const modules = {
      transactions: true,
      goal: false,
      workers: true,
      capital: true,
      inventory: true,
    livestock: false,
    };

    store.getState().addProject({
      id: "project-2",
      name: "مشروع طيور",
      description: "وصف المشروع",
      status: "active",
      projectType: "birds",
      modules,
      incomeMinor: 0n,
      expenseMinor: 0n,
      profitMinor: 0n,
      progress: 0,
      mark: "ط",
      tone: "bg-primary-soft text-primary",
      colorToken: "primary",
      outstandingLaborMinor: 0n,
      activeWorkers: 0,
      capitalMinor: 10_000n,
      capitalRecoveredRate: 0,
      inventoryValueMinor: 2_000n,
      inventoryItemCount: 2,
    });
    store.getState().updateProject("project-2", {
      projectType: "goods",
      modules: { ...modules, workers: false },
      capitalMinor: 12_000n,
    });

    expect(store.getState().projects[0]).toMatchObject({
      projectType: "goods",
      modules: { workers: false, capital: true, inventory: true },
      capitalMinor: 12_000n,
      inventoryItemCount: 2,
    });
  });

  it("replaces projects while normalizing legacy demo rows", () => {
    const store = createProjectStore([]);

    store.getState().replaceProjects([
      {
        id: "legacy",
        name: "قديم",
        description: "مشروع قديم",
        status: "active",
        incomeMinor: 0n,
        expenseMinor: 0n,
        profitMinor: 0n,
        progress: 0,
        mark: "ق",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
      },
    ]);

    expect(store.getState().projects).toHaveLength(1);
    expect(store.getState().projects[0]).toMatchObject({
      projectType: "general",
      capitalMinor: 0n,
      inventoryItemCount: 0,
    });
  });

  it("archives an existing demo project", () => {
    const store = createProjectStore([
      {
        id: "project-1",
        name: "مشروع",
        description: "وصف",
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
        incomeMinor: 0n,
        expenseMinor: 0n,
        profitMinor: 0n,
        progress: 0,
        mark: "م",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
      },
    ]);

    store.getState().archiveProject("project-1");

    expect(store.getState().projects[0]?.status).toBe("archived");
  });

  it("reconciles demo goal and labor signals for malformed module objects", () => {
    const store = createProjectStore([]);

    store.getState().replaceProjects([
      {
        id: "malformed-demo",
        name: "قديم",
        description: "مشروع قديم",
        status: "active",
        modules: {
          transactions: true,
          goal: "invalid",
        } as unknown as ProjectModules,
        goalMinor: 5_000n,
        incomeMinor: 0n,
        expenseMinor: 0n,
        profitMinor: 0n,
        progress: 0,
        mark: "ق",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 250n,
        activeWorkers: 0,
      },
    ]);

    expect(store.getState().projects[0]?.modules).toMatchObject({
      transactions: true,
      goal: true,
      workers: true,
    });
  });

  it("keeps valid demo module flags while evidence repairs malformed flags", () => {
    const store = createProjectStore([]);

    store.getState().replaceProjects([
      {
        id: "partial-demo",
        name: "قديم",
        description: "مشروع قديم",
        status: "active",
        modules: {
          transactions: true,
          goal: "invalid",
          workers: false,
          capital: true,
          inventory: true,
        livestock: false,
        } as unknown as ProjectModules,
        goalMinor: 5_000n,
        incomeMinor: 0n,
        expenseMinor: 0n,
        profitMinor: 0n,
        progress: 0,
        mark: "ق",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 1,
      },
    ]);

    expect(store.getState().projects[0]?.modules).toEqual({
      transactions: true,
      goal: true,
      workers: true,
      capital: true,
      inventory: true,
    livestock: false,
    });
  });

  it("recomputes capital recovery after nonzero profit or capital updates", () => {
    const store = createProjectStore([
      {
        id: "recovery-demo",
        name: "مشروع",
        description: "مشروع تجريبي",
        status: "active",
        projectType: "goods",
        modules: {
          transactions: true,
          goal: false,
          workers: false,
          capital: true,
          inventory: true,
        livestock: false,
        },
        incomeMinor: 10_000n,
        expenseMinor: 5_000n,
        profitMinor: 5_000n,
        progress: 0,
        mark: "م",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
        capitalMinor: 10_000n,
        capitalRecoveredRate: 50,
        inventoryValueMinor: 0n,
        inventoryItemCount: 0,
      },
    ]);

    store.getState().updateProject("recovery-demo", {
      capitalMinor: 20_000n,
    });
    expect(store.getState().projects[0]?.capitalRecoveredRate).toBe(25);

    store.getState().updateProject("recovery-demo", {
      profitMinor: 10_000n,
    });
    expect(store.getState().projects[0]?.capitalRecoveredRate).toBe(50);
  });

  it("applies demo project transactions to every derived summary", () => {
    const store = createProjectStore([
      {
        id: "transaction-demo",
        name: "مشروع",
        description: "مشروع تجريبي",
        status: "active",
        projectType: "goods",
        modules: {
          transactions: true,
          goal: true,
          workers: false,
          capital: true,
          inventory: true,
        livestock: false,
        },
        goalMinor: 10_000n,
        incomeMinor: 1_000n,
        expenseMinor: 500n,
        profitMinor: 500n,
        progress: 10,
        mark: "م",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
        capitalMinor: 4_000n,
        capitalRecoveredRate: 12.5,
        inventoryValueMinor: 0n,
        inventoryItemCount: 0,
      },
    ]);

    store.getState().applyProjectTransaction({
      projectId: "transaction-demo",
      kind: "income",
      amountMinor: 3_000n,
    });
    store.getState().applyProjectTransaction({
      projectId: "transaction-demo",
      kind: "expense",
      amountMinor: 1_000n,
    });

    expect(store.getState().projects[0]).toMatchObject({
      incomeMinor: 4_000n,
      expenseMinor: 1_500n,
      profitMinor: 2_500n,
      progress: 40,
      capitalRecoveredRate: 62.5,
    });
  });

  it("preserves progress when a demo project has no measurable goal", () => {
    const store = createProjectStore([
      {
        id: "no-goal-demo",
        name: "مشروع",
        description: "مشروع بلا هدف",
        status: "active",
        incomeMinor: 1_000n,
        expenseMinor: 0n,
        profitMinor: 1_000n,
        progress: 72,
        mark: "م",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
      },
    ]);

    store.getState().applyProjectTransaction({
      projectId: "no-goal-demo",
      kind: "income",
      amountMinor: 500n,
    });

    expect(store.getState().projects[0]?.progress).toBe(72);
  });

  it("supports demo workers, daily work, and wage movements", () => {
    const store = createProjectStore([
      {
        id: "workers-demo",
        name: "مشروع عمال",
        description: "تجريبي",
        status: "active",
        projectType: "food",
        modules: {
          transactions: true,
          goal: false,
          workers: true,
          capital: false,
          inventory: false,
        livestock: false,
        },
        incomeMinor: 0n,
        expenseMinor: 0n,
        profitMinor: 0n,
        progress: 0,
        mark: "ع",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 0n,
        activeWorkers: 0,
        capitalMinor: 0n,
        capitalRecoveredRate: null,
        inventoryValueMinor: 0n,
        inventoryItemCount: 0,
      },
    ]);

    const worker = store.getState().createWorker({
      projectId: "workers-demo",
      name: "أحمد",
      dailyWageMinor: 100_000n,
      currencyCode: "LYD",
    });
    store.getState().recordDailyWork({
      projectId: "workers-demo",
      workerId: worker.workerId,
      workDate: "2026-07-13",
      clientId: "client-daily-1",
      currencyCode: "LYD",
    });
    store.getState().postWageMovement({
      projectId: "workers-demo",
      workerId: worker.workerId,
      entryType: "withdrawal",
      amountMinor: 40_000n,
      workDate: "2026-07-13",
      clientId: "client-withdraw-1",
      currencyCode: "LYD",
      walletId: "wallet-1",
    });

    const workers = store.getState().workersByProject["workers-demo"] ?? [];
    const logs = store.getState().workLogsByProject["workers-demo"] ?? [];
    expect(workers[0]).toMatchObject({
      name: "أحمد",
      balanceMinor: 60_000n,
      earnedMinor: 100_000n,
      withdrawnMinor: 40_000n,
      workDays: 1,
    });
    expect(logs).toHaveLength(2);
    expect(store.getState().projects[0]).toMatchObject({
      activeWorkers: 1,
      outstandingLaborMinor: 60_000n,
    });
  });

  it("uses labor-adjusted capital recovery when workers module is on", () => {
    const store = createProjectStore([
      {
        id: "labor-recovery",
        name: "مشروع",
        description: "وصف",
        status: "active",
        projectType: "services",
        modules: {
          transactions: true,
          goal: false,
          workers: true,
          capital: true,
          inventory: false,
        livestock: false,
        },
        incomeMinor: 5_000n,
        expenseMinor: 1_000n,
        profitMinor: 4_000n,
        progress: 0,
        mark: "م",
        tone: "bg-primary-soft text-primary",
        colorToken: "primary",
        outstandingLaborMinor: 1_000n,
        activeWorkers: 1,
        capitalMinor: 2_000n,
        capitalRecoveredRate: 0,
        inventoryValueMinor: 0n,
        inventoryItemCount: 0,
      },
    ]);

    expect(store.getState().projects[0]?.capitalRecoveredRate).toBe(150);
  });
});
