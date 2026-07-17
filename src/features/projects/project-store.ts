import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  CapitalEntry,
  CapitalEntryType,
  InventoryItem,
  InventoryLocation,
  InventoryMovement,
  InventoryMovementType,
  LivestockBatch,
  LivestockEvent,
  LivestockEventType,
  WorkerBalance,
  WorkLogEntry,
} from "@/features/workspace/workspace-types";
import {
  getDefaultProjectModules,
  normalizeProjectModules,
  normalizeProjectType,
  parseProjectModules,
} from "./project-blueprints";
import type { ProjectSummary } from "./project-data";

type BlueprintSummaryFields =
  | "projectType"
  | "modules"
  | "capitalMinor"
  | "capitalRecoveredRate"
  | "inventoryValueMinor"
  | "inventoryItemCount";

export type ProjectStoreProjectInput = Omit<
  ProjectSummary,
  BlueprintSummaryFields
> &
  Partial<Pick<ProjectSummary, BlueprintSummaryFields>>;

export interface DemoProjectTransactionInput {
  readonly projectId: string;
  readonly kind: "income" | "expense";
  readonly amountMinor: bigint;
}

export interface DemoProjectTransactionAdjustment {
  readonly projectId: string;
  readonly kind: "income" | "expense";
  readonly deltaMinor: bigint;
}

export interface DemoCapitalEntryInput {
  readonly projectId: string;
  readonly entryType: CapitalEntryType;
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  readonly note?: string;
  readonly occurredOn: string;
  readonly clientId: string;
}

export interface DemoInventoryUpsertInput {
  readonly projectId: string;
  readonly currencyCode: string;
  readonly name: string;
  readonly quantity: number;
  readonly unitLabel: string;
  readonly unitCostMinor: bigint | null;
  readonly barcode?: string | null;
  readonly locationId?: string | null;
  readonly itemId?: string;
}

export interface DemoCreateLivestockBatchInput {
  readonly projectId: string;
  readonly name: string;
  readonly headCount: number;
  readonly species?: string | null;
  readonly note?: string | null;
}

export interface DemoPostLivestockEventInput {
  readonly projectId: string;
  readonly batchId: string;
  readonly eventType: LivestockEventType;
  readonly quantity: number;
  readonly note?: string | null;
  readonly clientId: string;
}

export interface DemoCreateInventoryLocationInput {
  readonly projectId: string;
  readonly name: string;
}

export interface DemoPostInventoryMovementInput {
  readonly projectId: string;
  readonly itemId: string;
  readonly movementType: InventoryMovementType;
  readonly quantity: number;
  readonly fromLocationId?: string | null;
  readonly toLocationId?: string | null;
  readonly note?: string | null;
  readonly clientId: string;
}

export interface DemoCreateWorkerInput {
  readonly projectId: string;
  readonly name: string;
  readonly dailyWageMinor: bigint;
  readonly currencyCode: string;
  readonly phone?: string;
}

export interface DemoRecordDailyWorkInput {
  readonly projectId: string;
  readonly workerId: string;
  readonly workDate: string;
  readonly clientId: string;
  readonly amountMinor?: bigint;
  readonly currencyCode: string;
  readonly note?: string | null;
}

export interface DemoWageMovementInput {
  readonly projectId: string;
  readonly workerId: string;
  readonly entryType: "bonus" | "deduction" | "withdrawal" | "adjustment";
  readonly amountMinor: bigint;
  readonly workDate: string;
  readonly clientId: string;
  readonly currencyCode: string;
  readonly walletId?: string;
  readonly note?: string | null;
}

export interface DemoUpdateWorkerInput {
  readonly projectId: string;
  readonly workerId: string;
  readonly name?: string;
  readonly phone?: string | null;
  readonly dailyWageMinor?: bigint;
  readonly status?: "active" | "inactive";
}

interface ProjectStore {
  projects: ProjectSummary[];
  capitalByProject: Record<string, CapitalEntry[]>;
  inventoryByProject: Record<string, InventoryItem[]>;
  inventoryLocationsByProject: Record<string, InventoryLocation[]>;
  inventoryMovementsByProject: Record<string, InventoryMovement[]>;
  livestockBatchesByProject: Record<string, LivestockBatch[]>;
  livestockEventsByProject: Record<string, LivestockEvent[]>;
  workersByProject: Record<string, WorkerBalance[]>;
  workLogsByProject: Record<string, WorkLogEntry[]>;
  addProject: (project: ProjectStoreProjectInput) => void;
  updateProject: (
    projectId: string,
    changes: Partial<Omit<ProjectSummary, "id">>,
  ) => void;
  archiveProject: (projectId: string) => void;
  applyProjectTransaction: (input: DemoProjectTransactionInput) => void;
  adjustProjectTransaction: (input: DemoProjectTransactionAdjustment) => void;
  postCapitalEntry: (input: DemoCapitalEntryInput) => void;
  upsertInventoryItem: (input: DemoInventoryUpsertInput) => void;
  archiveInventoryItem: (input: {
    projectId: string;
    itemId: string;
  }) => void;
  createInventoryLocation: (
    input: DemoCreateInventoryLocationInput,
  ) => InventoryLocation;
  postInventoryMovement: (
    input: DemoPostInventoryMovementInput,
  ) => InventoryMovement;
  createLivestockBatch: (
    input: DemoCreateLivestockBatchInput,
  ) => LivestockBatch;
  postLivestockEvent: (input: DemoPostLivestockEventInput) => LivestockEvent;
  createWorker: (input: DemoCreateWorkerInput) => WorkerBalance;
  updateWorker: (input: DemoUpdateWorkerInput) => WorkerBalance;
  recordDailyWork: (input: DemoRecordDailyWorkInput) => WorkLogEntry;
  postWageMovement: (input: DemoWageMovementInput) => WorkLogEntry;
  replaceProjects: (projects: ProjectStoreProjectInput[]) => void;
}

function recoveryRate(
  profitMinor: bigint,
  capitalMinor: bigint,
  outstandingLaborMinor = 0n,
  workersEnabled = false,
): number | null {
  if (capitalMinor <= 0n) return null;
  const laborAdjusted =
    workersEnabled && outstandingLaborMinor > 0n
      ? profitMinor - outstandingLaborMinor
      : profitMinor;
  const scaled = (laborAdjusted * 10_000n) / capitalMinor;
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (scaled > limit) return Number.MAX_SAFE_INTEGER / 100;
  if (scaled < -limit) return -Number.MAX_SAFE_INTEGER / 100;
  return Number(scaled) / 100;
}

function recomputeWorkerTotals(workers: WorkerBalance[]): {
  activeWorkers: number;
  outstandingLaborMinor: bigint;
} {
  const active = workers.filter((worker) => worker.status === "active");
  return {
    activeWorkers: active.length,
    outstandingLaborMinor: active.reduce(
      (total, worker) => total + worker.balanceMinor,
      0n,
    ),
  };
}

function goalProgress(incomeMinor: bigint, goalMinor: bigint | undefined): number {
  if (!goalMinor || goalMinor <= 0n || incomeMinor <= 0n) return 0;
  const percentage = (incomeMinor * 100n) / goalMinor;
  if (percentage >= 100n) return 100;
  return Number(percentage);
}

function inventoryValue(items: InventoryItem[]): {
  inventoryItemCount: number;
  inventoryValueMinor: bigint;
} {
  return {
    inventoryItemCount: items.length,
    inventoryValueMinor: items.reduce((total, item) => {
      if (item.unitCostMinor == null) return total;
      return total + BigInt(Math.round(item.quantity)) * item.unitCostMinor;
    }, 0n),
  };
}

function capitalNet(entries: CapitalEntry[]): bigint {
  return entries.reduce((total, entry) => total + entry.amountMinor, 0n);
}

function normalizeStoredProject(
  project: ProjectStoreProjectInput,
): ProjectSummary {
  const projectType = normalizeProjectType(project.projectType);
  const fallbackModules = getDefaultProjectModules(projectType);
  const parsedModules = parseProjectModules(project.modules);
  const normalizedModules =
    parsedModules ??
    normalizeProjectModules(project.modules, fallbackModules);
  const modules =
    parsedModules === null
      ? {
          ...normalizedModules,
          goal: project.goalMinor !== undefined || normalizedModules.goal,
          workers:
            project.activeWorkers > 0 ||
            project.outstandingLaborMinor !== 0n ||
            normalizedModules.workers,
        }
      : normalizedModules;
  const capitalMinor = project.capitalMinor ?? 0n;

  return {
    ...project,
    projectType,
    modules,
    capitalMinor,
    capitalRecoveredRate: recoveryRate(
      project.profitMinor,
      capitalMinor,
      project.outstandingLaborMinor,
      modules.workers,
    ),
    inventoryValueMinor: project.inventoryValueMinor ?? 0n,
    inventoryItemCount: project.inventoryItemCount ?? 0,
  };
}

function requireProject(
  projects: ProjectSummary[],
  projectId: string,
): ProjectSummary {
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) throw new Error("المشروع غير موجود");
  return project;
}

export function createProjectStore(
  initialProjects: ProjectStoreProjectInput[] = [],
): StoreApi<ProjectStore> {
  return createStore<ProjectStore>()((set, get) => ({
    projects: initialProjects.map(normalizeStoredProject),
    capitalByProject: {},
    inventoryByProject: {},
    inventoryLocationsByProject: {},
    inventoryMovementsByProject: {},
    livestockBatchesByProject: {},
    livestockEventsByProject: {},
    workersByProject: {},
    workLogsByProject: {},
    addProject: (project) =>
      set((state) => ({
        projects: [normalizeStoredProject(project), ...state.projects],
      })),
    updateProject: (projectId, changes) =>
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === projectId
            ? normalizeStoredProject({ ...project, ...changes })
            : project,
        ),
      })),
    archiveProject: (projectId) =>
      set((state) => {
        const project = state.projects.find(
          (candidate) => candidate.id === projectId,
        );
        if (!project) {
          throw new Error("المشروع غير موجود");
        }
        return {
          projects: state.projects.map((candidate) =>
            candidate.id === projectId
              ? normalizeStoredProject({ ...candidate, status: "archived" })
              : candidate,
          ),
        };
      }),
    applyProjectTransaction: (input) =>
      set((state) => {
        if (input.amountMinor <= 0n) {
          throw new Error("يجب أن يكون مبلغ معاملة المشروع أكبر من صفر");
        }
        const project = requireProject(state.projects, input.projectId);
        const incomeMinor =
          project.incomeMinor +
          (input.kind === "income" ? input.amountMinor : 0n);
        const expenseMinor =
          project.expenseMinor +
          (input.kind === "expense" ? input.amountMinor : 0n);
        const profitMinor = incomeMinor - expenseMinor;
        const updated = normalizeStoredProject({
          ...project,
          incomeMinor,
          expenseMinor,
          profitMinor,
          progress: project.goalMinor
            ? goalProgress(incomeMinor, project.goalMinor)
            : project.progress,
        });
        return {
          projects: state.projects.map((candidate) =>
            candidate.id === input.projectId ? updated : candidate,
          ),
        };
      }),
    adjustProjectTransaction: (input) =>
      set((state) => {
        if (input.deltaMinor === 0n) return state;
        const project = requireProject(state.projects, input.projectId);
        const incomeMinor =
          project.incomeMinor +
          (input.kind === "income" ? input.deltaMinor : 0n);
        const expenseMinor =
          project.expenseMinor +
          (input.kind === "expense" ? input.deltaMinor : 0n);
        if (incomeMinor < 0n || expenseMinor < 0n) {
          throw new Error("تعذر تحديث إجماليات المشروع");
        }
        const profitMinor = incomeMinor - expenseMinor;
        const updated = normalizeStoredProject({
          ...project,
          incomeMinor,
          expenseMinor,
          profitMinor,
          progress: project.goalMinor
            ? goalProgress(incomeMinor, project.goalMinor)
            : project.progress,
        });
        return {
          projects: state.projects.map((candidate) =>
            candidate.id === input.projectId ? updated : candidate,
          ),
        };
      }),
    postCapitalEntry: (input) =>
      set((state) => {
        const project = requireProject(state.projects, input.projectId);
        if (!project.modules.capital) {
          throw new Error("وحدة رأس المال غير مفعّلة لهذا المشروع");
        }
        if (input.amountMinor === 0n) {
          throw new Error("مبلغ رأس المال لا يمكن أن يكون صفرًا");
        }
        if (
          (input.entryType === "opening" ||
            input.entryType === "contribution") &&
          input.amountMinor <= 0n
        ) {
          throw new Error("المساهمة والافتتاحي يجب أن يكونا موجبين");
        }
        if (input.entryType === "withdrawal" && input.amountMinor >= 0n) {
          throw new Error("السحب يجب أن يكون بمبلغ سالب");
        }

        const entry: CapitalEntry = {
          id: crypto.randomUUID(),
          workspaceId: "demo",
          projectId: input.projectId,
          entryType: input.entryType,
          amountMinor: input.amountMinor,
          currencyCode: input.currencyCode,
          note: input.note?.trim() || null,
          occurredOn: input.occurredOn,
          createdBy: "demo",
          clientId: input.clientId,
          createdAt: new Date().toISOString(),
        };
        const entries = [
          entry,
          ...(state.capitalByProject[input.projectId] ?? []),
        ];
        const capitalMinor = capitalNet(entries);
        return {
          capitalByProject: {
            ...state.capitalByProject,
            [input.projectId]: entries,
          },
          projects: state.projects.map((candidate) =>
            candidate.id === input.projectId
              ? normalizeStoredProject({
                  ...candidate,
                  capitalMinor,
                })
              : candidate,
          ),
        };
      }),
    upsertInventoryItem: (input) =>
      set((state) => {
        const project = requireProject(state.projects, input.projectId);
        if (!project.modules.inventory) {
          throw new Error("وحدة المخزون غير مفعّلة لهذا المشروع");
        }
        const current = state.inventoryByProject[input.projectId] ?? [];
        const normalizedName = input.name.trim();
        if (normalizedName.length < 2) {
          throw new Error("اكتب اسمًا واضحًا للصنف");
        }
        if (!Number.isFinite(input.quantity) || input.quantity < 0) {
          throw new Error("أدخل كمية صحيحة");
        }

        let nextItems: InventoryItem[];
        if (input.itemId) {
          const exists = current.some((item) => item.id === input.itemId);
          if (!exists) throw new Error("الصنف غير موجود");
          nextItems = current.map((item) =>
            item.id === input.itemId
              ? {
                  ...item,
                  name: normalizedName,
                  quantity: input.quantity,
                  unitLabel: input.unitLabel.trim(),
                  unitCostMinor: input.unitCostMinor,
                  currencyCode: input.currencyCode,
                  barcode: input.barcode ?? item.barcode,
                  locationId: input.locationId ?? item.locationId,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          );
        } else {
          const duplicate = current.some(
            (item) =>
              item.name.trim().toLowerCase() === normalizedName.toLowerCase(),
          );
          if (duplicate) {
            throw new Error("يوجد صنف بنفس الاسم في هذا المشروع");
          }
          const now = new Date().toISOString();
          nextItems = [
            {
              id: crypto.randomUUID(),
              workspaceId: "demo",
              projectId: input.projectId,
              name: normalizedName,
              quantity: input.quantity,
              unitLabel: input.unitLabel.trim(),
              unitCostMinor: input.unitCostMinor,
              currencyCode: input.currencyCode,
              status: "active",
              barcode: input.barcode ?? null,
              locationId: input.locationId ?? null,
              createdBy: "demo",
              createdAt: now,
              updatedAt: now,
            },
            ...current,
          ];
        }

        const totals = inventoryValue(nextItems);
        return {
          inventoryByProject: {
            ...state.inventoryByProject,
            [input.projectId]: nextItems,
          },
          projects: state.projects.map((candidate) =>
            candidate.id === input.projectId
              ? normalizeStoredProject({
                  ...candidate,
                  ...totals,
                })
              : candidate,
          ),
        };
      }),
    archiveInventoryItem: ({ projectId, itemId }) =>
      set((state) => {
        requireProject(state.projects, projectId);
        const nextItems = (state.inventoryByProject[projectId] ?? []).filter(
          (item) => item.id !== itemId,
        );
        const totals = inventoryValue(nextItems);
        return {
          inventoryByProject: {
            ...state.inventoryByProject,
            [projectId]: nextItems,
          },
          projects: state.projects.map((candidate) =>
            candidate.id === projectId
              ? normalizeStoredProject({
                  ...candidate,
                  ...totals,
                })
              : candidate,
          ),
        };
      }),
    createInventoryLocation: (input) => {
      const project = requireProject(get().projects, input.projectId);
      if (!project.modules.inventory) {
        throw new Error("وحدة المخزون غير مفعّلة لهذا المشروع");
      }
      const name = input.name.trim();
      if (!name) throw new Error("اكتب اسم الموقع");
      const now = new Date().toISOString();
      const location: InventoryLocation = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        name,
        createdBy: "demo",
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        inventoryLocationsByProject: {
          ...state.inventoryLocationsByProject,
          [input.projectId]: [
            location,
            ...(state.inventoryLocationsByProject[input.projectId] ?? []),
          ],
        },
      }));
      return location;
    },
    postInventoryMovement: (input) => {
      const state = get();
      const project = requireProject(state.projects, input.projectId);
      if (!project.modules.inventory) {
        throw new Error("وحدة المخزون غير مفعّلة لهذا المشروع");
      }
      const items = state.inventoryByProject[input.projectId] ?? [];
      const item = items.find((candidate) => candidate.id === input.itemId);
      if (!item) throw new Error("الصنف غير موجود");
      if (!Number.isFinite(input.quantity) || input.quantity === 0) {
        throw new Error("أدخل كمية صحيحة");
      }
      const delta =
        input.movementType === "in"
          ? Math.abs(input.quantity)
          : input.movementType === "out"
            ? -Math.abs(input.quantity)
            : input.movementType === "adjust"
              ? input.quantity
              : 0;
      if (item.quantity + delta < 0) {
        throw new Error("الكمية غير كافية");
      }
      const now = new Date().toISOString();
      const movement: InventoryMovement = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        itemId: input.itemId,
        movementType: input.movementType,
        quantity: input.quantity,
        fromLocationId: input.fromLocationId ?? null,
        toLocationId: input.toLocationId ?? null,
        note: input.note ?? null,
        occurredOn: now.slice(0, 10),
        createdBy: "demo",
        clientId: input.clientId,
        createdAt: now,
      };
      const nextItems = items.map((candidate) =>
        candidate.id === input.itemId
          ? {
              ...candidate,
              quantity: candidate.quantity + delta,
              locationId: input.toLocationId ?? candidate.locationId,
              updatedAt: now,
            }
          : candidate,
      );
      const totals = inventoryValue(nextItems);
      set((current) => ({
        inventoryByProject: {
          ...current.inventoryByProject,
          [input.projectId]: nextItems,
        },
        inventoryMovementsByProject: {
          ...current.inventoryMovementsByProject,
          [input.projectId]: [
            movement,
            ...(current.inventoryMovementsByProject[input.projectId] ?? []),
          ],
        },
        projects: current.projects.map((candidate) =>
          candidate.id === input.projectId
            ? normalizeStoredProject({
                ...candidate,
                ...totals,
              })
            : candidate,
        ),
      }));
      return movement;
    },
    createLivestockBatch: (input) => {
      const project = requireProject(get().projects, input.projectId);
      if (!project.modules.livestock) {
        throw new Error("وحدة الحيوانات غير مفعّلة لهذا المشروع");
      }
      const name = input.name.trim();
      if (name.length < 2) throw new Error("اكتب اسم الدفعة");
      if (!Number.isFinite(input.headCount) || input.headCount < 0) {
        throw new Error("أدخل عدد رؤوس صحيحًا");
      }
      const now = new Date().toISOString();
      const batch: LivestockBatch = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        name,
        species: input.species ?? null,
        headCount: input.headCount,
        note: input.note ?? null,
        createdBy: "demo",
        createdAt: now,
        updatedAt: now,
      };
      set((state) => ({
        livestockBatchesByProject: {
          ...state.livestockBatchesByProject,
          [input.projectId]: [
            batch,
            ...(state.livestockBatchesByProject[input.projectId] ?? []),
          ],
        },
      }));
      return batch;
    },
    postLivestockEvent: (input) => {
      const state = get();
      const project = requireProject(state.projects, input.projectId);
      if (!project.modules.livestock) {
        throw new Error("وحدة الحيوانات غير مفعّلة لهذا المشروع");
      }
      const batches = state.livestockBatchesByProject[input.projectId] ?? [];
      const batch = batches.find((candidate) => candidate.id === input.batchId);
      if (!batch) throw new Error("الدفعة غير موجودة");
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw new Error("أدخل كمية صحيحة");
      }
      const delta =
        input.eventType === "hatch" || input.eventType === "birth"
          ? input.quantity
          : -input.quantity;
      if (batch.headCount + delta < 0) {
        throw new Error("العدد غير كافٍ");
      }
      const now = new Date().toISOString();
      const event: LivestockEvent = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        batchId: input.batchId,
        eventType: input.eventType,
        quantity: input.quantity,
        occurredOn: now.slice(0, 10),
        note: input.note ?? null,
        createdBy: "demo",
        clientId: input.clientId,
        createdAt: now,
      };
      set((current) => ({
        livestockBatchesByProject: {
          ...current.livestockBatchesByProject,
          [input.projectId]: (
            current.livestockBatchesByProject[input.projectId] ?? []
          ).map((candidate) =>
            candidate.id === input.batchId
              ? {
                  ...candidate,
                  headCount: candidate.headCount + delta,
                  updatedAt: now,
                }
              : candidate,
          ),
        },
        livestockEventsByProject: {
          ...current.livestockEventsByProject,
          [input.projectId]: [
            event,
            ...(current.livestockEventsByProject[input.projectId] ?? []),
          ],
        },
      }));
      return event;
    },
    createWorker: (input) => {
      const project = requireProject(get().projects, input.projectId);
      if (!project.modules.workers) {
        throw new Error("وحدة العمال غير مفعّلة لهذا المشروع");
      }
      const name = input.name.trim();
      if (name.length < 2) {
        throw new Error("اكتب اسمًا واضحًا للعامل");
      }
      if (input.dailyWageMinor <= 0n) {
        throw new Error("الأجر اليومي يجب أن يكون أكبر من صفر");
      }
      const worker: WorkerBalance = {
        workerId: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        name,
        phone: input.phone?.trim() || null,
        dailyWageMinor: input.dailyWageMinor,
        status: "active",
        balanceMinor: 0n,
        earnedMinor: 0n,
        withdrawnMinor: 0n,
        deductedMinor: 0n,
        workDays: 0,
      };
      set((state) => {
        const workers = [
          worker,
          ...(state.workersByProject[input.projectId] ?? []),
        ];
        const totals = recomputeWorkerTotals(workers);
        return {
          workersByProject: {
            ...state.workersByProject,
            [input.projectId]: workers,
          },
          projects: state.projects.map((candidate) =>
            candidate.id === input.projectId
              ? normalizeStoredProject({
                  ...candidate,
                  ...totals,
                })
              : candidate,
          ),
        };
      });
      return worker;
    },
    updateWorker: (input) => {
      const workers = get().workersByProject[input.projectId] ?? [];
      const existing = workers.find(
        (candidate) => candidate.workerId === input.workerId,
      );
      if (!existing) {
        throw new Error("العامل غير موجود");
      }
      if (input.name !== undefined) {
        const name = input.name.trim();
        if (name.length < 2) {
          throw new Error("اكتب اسمًا واضحًا للعامل");
        }
      }
      if (input.dailyWageMinor !== undefined && input.dailyWageMinor < 0n) {
        throw new Error("الأجر اليومي غير صالح");
      }
      const updated: WorkerBalance = {
        ...existing,
        name: input.name?.trim() ?? existing.name,
        phone:
          input.phone === undefined
            ? existing.phone
            : input.phone?.trim() || null,
        dailyWageMinor: input.dailyWageMinor ?? existing.dailyWageMinor,
        status: input.status ?? existing.status,
      };
      set((state) => {
        const nextWorkers = (
          state.workersByProject[input.projectId] ?? []
        ).map((candidate) =>
          candidate.workerId === input.workerId ? updated : candidate,
        );
        const totals = recomputeWorkerTotals(nextWorkers);
        return {
          workersByProject: {
            ...state.workersByProject,
            [input.projectId]: nextWorkers,
          },
          projects: state.projects.map((candidate) =>
            candidate.id === input.projectId
              ? normalizeStoredProject({
                  ...candidate,
                  ...totals,
                })
              : candidate,
          ),
        };
      });
      return updated;
    },
    recordDailyWork: (input) => {
      const state = get();
      const project = requireProject(state.projects, input.projectId);
      if (!project.modules.workers) {
        throw new Error("وحدة العمال غير مفعّلة لهذا المشروع");
      }
      const workers = state.workersByProject[input.projectId] ?? [];
      const worker = workers.find(
        (candidate) => candidate.workerId === input.workerId,
      );
      if (!worker || worker.status !== "active") {
        throw new Error("العامل غير موجود");
      }
      const existing = (state.workLogsByProject[input.projectId] ?? []).find(
        (log) =>
          log.entryType === "daily_wage" &&
          log.workerId === input.workerId &&
          log.workDate === input.workDate,
      );
      if (existing) {
        return existing;
      }
      const amountMinor = input.amountMinor ?? worker.dailyWageMinor;
      if (amountMinor <= 0n) {
        throw new Error("مبلغ اليومية يجب أن يكون أكبر من صفر");
      }
      const log: WorkLogEntry = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        workerId: input.workerId,
        entryType: "daily_wage",
        workDate: input.workDate,
        amountMinor,
        currencyCode: input.currencyCode,
        note: input.note?.trim() || null,
        createdAt: new Date().toISOString(),
      };
      set((current) => {
        const nextWorkers = (
          current.workersByProject[input.projectId] ?? []
        ).map((candidate) =>
          candidate.workerId === input.workerId
            ? {
                ...candidate,
                balanceMinor: candidate.balanceMinor + amountMinor,
                earnedMinor: candidate.earnedMinor + amountMinor,
                workDays: candidate.workDays + 1,
              }
            : candidate,
        );
        const totals = recomputeWorkerTotals(nextWorkers);
        return {
          workersByProject: {
            ...current.workersByProject,
            [input.projectId]: nextWorkers,
          },
          workLogsByProject: {
            ...current.workLogsByProject,
            [input.projectId]: [
              log,
              ...(current.workLogsByProject[input.projectId] ?? []),
            ],
          },
          projects: current.projects.map((candidate) =>
            candidate.id === input.projectId
              ? normalizeStoredProject({
                  ...candidate,
                  ...totals,
                })
              : candidate,
          ),
        };
      });
      return log;
    },
    postWageMovement: (input) => {
      const state = get();
      const project = requireProject(state.projects, input.projectId);
      if (!project.modules.workers) {
        throw new Error("وحدة العمال غير مفعّلة لهذا المشروع");
      }
      if (input.amountMinor <= 0n) {
        throw new Error("مبلغ الحركة يجب أن يكون أكبر من صفر");
      }
      if (input.entryType === "withdrawal" && !input.walletId) {
        throw new Error("اختر محفظة السحب");
      }
      const workers = state.workersByProject[input.projectId] ?? [];
      const worker = workers.find(
        (candidate) => candidate.workerId === input.workerId,
      );
      if (!worker || worker.status !== "active") {
        throw new Error("العامل غير موجود");
      }
      const signedAmount =
        input.entryType === "bonus" || input.entryType === "adjustment"
          ? input.amountMinor
          : -input.amountMinor;
      const log: WorkLogEntry = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        projectId: input.projectId,
        workerId: input.workerId,
        entryType: input.entryType,
        workDate: input.workDate,
        amountMinor: signedAmount,
        currencyCode: input.currencyCode,
        note: input.note?.trim() || null,
        createdAt: new Date().toISOString(),
      };
      set((current) => {
        const nextWorkers = (
          current.workersByProject[input.projectId] ?? []
        ).map((candidate) => {
          if (candidate.workerId !== input.workerId) return candidate;
          if (input.entryType === "bonus" || input.entryType === "adjustment") {
            return {
              ...candidate,
              balanceMinor: candidate.balanceMinor + input.amountMinor,
              earnedMinor: candidate.earnedMinor + input.amountMinor,
            };
          }
          if (input.entryType === "deduction") {
            return {
              ...candidate,
              balanceMinor: candidate.balanceMinor - input.amountMinor,
              deductedMinor: candidate.deductedMinor + input.amountMinor,
            };
          }
          return {
            ...candidate,
            balanceMinor: candidate.balanceMinor - input.amountMinor,
            withdrawnMinor: candidate.withdrawnMinor + input.amountMinor,
          };
        });
        const totals = recomputeWorkerTotals(nextWorkers);
        return {
          workersByProject: {
            ...current.workersByProject,
            [input.projectId]: nextWorkers,
          },
          workLogsByProject: {
            ...current.workLogsByProject,
            [input.projectId]: [
              log,
              ...(current.workLogsByProject[input.projectId] ?? []),
            ],
          },
          projects: current.projects.map((candidate) =>
            candidate.id === input.projectId
              ? normalizeStoredProject({
                  ...candidate,
                  ...totals,
                })
              : candidate,
          ),
        };
      });
      return log;
    },
    replaceProjects: (projects) =>
      set({
        projects: projects.map(normalizeStoredProject),
        capitalByProject: {},
        inventoryByProject: {},
        inventoryLocationsByProject: {},
        inventoryMovementsByProject: {},
        livestockBatchesByProject: {},
        livestockEventsByProject: {},
        workersByProject: {},
        workLogsByProject: {},
      }),
  }));
}

export const projectStore = createProjectStore();

export function useProjectStore<T>(
  selector: (state: ProjectStore) => T,
): T {
  return useStore(projectStore, selector);
}
