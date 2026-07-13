import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  DebtDirection,
  DebtEntry,
  DebtEntryType,
  DebtParty,
  DebtSummary,
} from "@/features/workspace/workspace-types";

export interface DemoDebtCreateInput {
  readonly direction: DebtDirection;
  readonly partyName: string;
  readonly partyPhone?: string | null;
  readonly partyNotes?: string | null;
  readonly principalMinor: bigint;
  readonly currencyCode: string;
  readonly dueOn?: string | null;
  readonly projectId?: string | null;
  readonly projectName?: string | null;
  readonly note?: string | null;
  readonly clientId: string;
}

export interface DemoDebtEntryInput {
  readonly debtId: string;
  readonly entryType: Exclude<DebtEntryType, "open">;
  readonly amountMinor: bigint;
  readonly occurredOn: string;
  readonly note?: string | null;
  readonly clientId: string;
  readonly financialEventId?: string | null;
}

interface CreationIntent {
  readonly debtId: string;
  readonly fingerprint: string;
}

interface EntryIntent {
  readonly entryId: string;
  readonly debtId: string;
  readonly fingerprint: string;
}

export interface DebtStoreState {
  readonly parties: DebtParty[];
  readonly debts: DebtSummary[];
  readonly entriesByDebt: Record<string, DebtEntry[]>;
  readonly creationByClientId: Record<string, CreationIntent>;
  readonly entriesByClientOperation: Record<string, EntryIntent>;
}

export interface DebtStoreActions {
  createDebt: (input: DemoDebtCreateInput) => string;
  postEntry: (input: DemoDebtEntryInput) => DebtEntry;
  replaceState: (state: DebtStoreState) => void;
}

export type DebtStore = DebtStoreState & DebtStoreActions;

const emptyDebtState: DebtStoreState = {
  parties: [],
  debts: [],
  entriesByDebt: {},
  creationByClientId: {},
  entriesByClientOperation: {},
};

function normalizeOptional(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function createFingerprint(input: DemoDebtCreateInput): string {
  return JSON.stringify({
    direction: input.direction,
    partyName: input.partyName.trim(),
    partyPhone: normalizeOptional(input.partyPhone),
    partyNotes: normalizeOptional(input.partyNotes),
    principalMinor: input.principalMinor.toString(),
    currencyCode: input.currencyCode.trim().toUpperCase(),
    dueOn: input.dueOn ?? null,
    projectId: input.projectId ?? null,
    note: normalizeOptional(input.note),
  });
}

function entryOperation(entryType: Exclude<DebtEntryType, "open">): string {
  return `post_debt_${entryType}`;
}

function entryFingerprint(input: DemoDebtEntryInput): string {
  return JSON.stringify({
    debtId: input.debtId,
    entryType: input.entryType,
    amountMinor: input.amountMinor.toString(),
    occurredOn: input.occurredOn,
    note: normalizeOptional(input.note),
    financialEventId: input.financialEventId ?? null,
  });
}

function entryLookupKey(clientId: string, operation: string): string {
  return `${clientId}::${operation}`;
}

function cloneState(state: DebtStoreState): DebtStoreState {
  return {
    parties: state.parties.map((party) => ({ ...party })),
    debts: state.debts.map((debt) => ({ ...debt })),
    entriesByDebt: Object.fromEntries(
      Object.entries(state.entriesByDebt).map(([debtId, entries]) => [
        debtId,
        entries.map((entry) => ({ ...entry })),
      ]),
    ),
    creationByClientId: Object.fromEntries(
      Object.entries(state.creationByClientId ?? {}).map(([clientId, intent]) => [
        clientId,
        { ...intent },
      ]),
    ),
    entriesByClientOperation: Object.fromEntries(
      Object.entries(state.entriesByClientOperation ?? {}).map(([key, intent]) => [
        key,
        { ...intent },
      ]),
    ),
  };
}

function summarizeEntries(
  debt: DebtSummary,
  entries: ReadonlyArray<DebtEntry>,
  latestType: Exclude<DebtEntryType, "open">,
): DebtSummary {
  const balanceMinor = entries.reduce(
    (total, entry) => total + entry.amountMinor,
    0n,
  );
  const paidMinor = -entries
    .filter((entry) => entry.entryType === "payment")
    .reduce((total, entry) => total + entry.amountMinor, 0n);
  const adjustedMinor = entries
    .filter((entry) => entry.entryType === "adjustment")
    .reduce((total, entry) => total + entry.amountMinor, 0n);
  const writtenOffMinor = -entries
    .filter((entry) => entry.entryType === "write_off")
    .reduce((total, entry) => total + entry.amountMinor, 0n);
  const status =
    balanceMinor === 0n
      ? latestType === "write_off"
        ? "written_off"
        : "settled"
      : "partial";

  return {
    ...debt,
    balanceMinor,
    paidMinor,
    adjustedMinor,
    writtenOffMinor,
    status,
    updatedAt: new Date().toISOString(),
  };
}

function validateEntry(debt: DebtSummary, input: DemoDebtEntryInput): void {
  if (debt.status === "settled" || debt.status === "written_off") {
    throw new Error("لا يمكن إضافة حركة إلى دين مغلق");
  }
  if (input.amountMinor === 0n) {
    throw new Error("مبلغ حركة الدين لا يمكن أن يكون صفرًا");
  }
  if (
    (input.entryType === "payment" || input.entryType === "write_off") &&
    input.amountMinor >= 0n
  ) {
    throw new Error("السداد والشطب يجب أن يخفضا رصيد الدين");
  }

  const nextBalance = debt.balanceMinor + input.amountMinor;
  if (nextBalance < 0n) {
    throw new Error("لا يمكن أن تتجاوز الحركة رصيد الدين");
  }
  if (
    input.entryType === "write_off" &&
    -input.amountMinor !== debt.balanceMinor
  ) {
    throw new Error("يجب أن يساوي الشطب كامل الرصيد المتبقي");
  }
}

export function createDebtStore(
  initialState: DebtStoreState = emptyDebtState,
): StoreApi<DebtStore> {
  const ownedInitialState = cloneState(initialState);
  return createStore<DebtStore>()((set, get) => ({
    ...ownedInitialState,
    createDebt: (input) => {
      const partyName = input.partyName.trim();
      if (partyName.length < 2) throw new Error("اكتب اسمًا واضحًا للطرف");
      if (input.principalMinor <= 0n) {
        throw new Error("أدخل مبلغ دين أكبر من صفر");
      }
      if (!input.clientId.trim()) throw new Error("معرّف العملية مطلوب");

      const fingerprint = createFingerprint(input);
      const existingIntent = get().creationByClientId[input.clientId];
      if (existingIntent) {
        if (existingIntent.fingerprint !== fingerprint) {
          throw new Error("تعارضت إعادة المحاولة مع دين سابق");
        }
        return existingIntent.debtId;
      }

      const now = new Date().toISOString();
      const partyPhone = normalizeOptional(input.partyPhone);
      const existingParty = get().parties.find(
        (party) =>
          party.name.trim().toLocaleLowerCase("ar") ===
            partyName.toLocaleLowerCase("ar") && party.phone === partyPhone,
      );
      const party: DebtParty = existingParty ?? {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        name: partyName,
        phone: partyPhone,
        notes: normalizeOptional(input.partyNotes),
        createdBy: "demo",
        createdAt: now,
        updatedAt: now,
      };
      const debtId = crypto.randomUUID();
      const debt: DebtSummary = {
        id: debtId,
        workspaceId: "demo",
        partyId: party.id,
        partyName: party.name,
        partyPhone: party.phone,
        direction: input.direction,
        principalMinor: input.principalMinor,
        balanceMinor: input.principalMinor,
        paidMinor: 0n,
        adjustedMinor: 0n,
        writtenOffMinor: 0n,
        currencyCode: input.currencyCode.trim().toUpperCase(),
        status: "open",
        dueOn: input.dueOn ?? null,
        projectId: input.projectId ?? null,
        projectName: input.projectName ?? null,
        note: normalizeOptional(input.note),
        createdBy: "demo",
        createdAt: now,
        updatedAt: now,
      };
      const openingEntry: DebtEntry = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        debtId,
        entryType: "open",
        amountMinor: input.principalMinor,
        currencyCode: debt.currencyCode,
        occurredOn: now.slice(0, 10),
        note: debt.note,
        financialEventId: null,
        createdBy: "demo",
        clientId: input.clientId,
        operation: "create_debt_open",
        createdAt: now,
      };

      set((state) => ({
        parties: existingParty ? state.parties : [party, ...state.parties],
        debts: [debt, ...state.debts],
        entriesByDebt: {
          ...state.entriesByDebt,
          [debtId]: [openingEntry],
        },
        creationByClientId: {
          ...state.creationByClientId,
          [input.clientId]: { debtId, fingerprint },
        },
      }));
      return debtId;
    },
    postEntry: (input) => {
      const debt = get().debts.find((candidate) => candidate.id === input.debtId);
      if (!debt) throw new Error("الدين غير موجود");
      if (!input.clientId.trim()) throw new Error("معرّف العملية مطلوب");
      const operation = entryOperation(input.entryType);
      const lookupKey = entryLookupKey(input.clientId, operation);
      const fingerprint = entryFingerprint(input);
      const existingIntent = get().entriesByClientOperation[lookupKey];
      if (existingIntent) {
        if (existingIntent.fingerprint !== fingerprint) {
          throw new Error("تعارضت إعادة المحاولة مع حركة سابقة");
        }
        const existing = (get().entriesByDebt[existingIntent.debtId] ?? []).find(
          (entry) => entry.id === existingIntent.entryId,
        );
        if (!existing) throw new Error("تعذر استعادة نتيجة العملية السابقة");
        return existing;
      }

      validateEntry(debt, input);
      const now = new Date().toISOString();
      const entry: DebtEntry = {
        id: crypto.randomUUID(),
        workspaceId: "demo",
        debtId: debt.id,
        entryType: input.entryType,
        amountMinor: input.amountMinor,
        currencyCode: debt.currencyCode,
        occurredOn: input.occurredOn,
        note: normalizeOptional(input.note),
        financialEventId: input.financialEventId ?? null,
        createdBy: "demo",
        clientId: input.clientId,
        operation,
        createdAt: now,
      };
      const entries = [entry, ...(get().entriesByDebt[debt.id] ?? [])];
      const updatedDebt = summarizeEntries(debt, entries, input.entryType);

      set((state) => ({
        entriesByDebt: { ...state.entriesByDebt, [debt.id]: entries },
        debts: state.debts.map((candidate) =>
          candidate.id === debt.id ? updatedDebt : candidate,
        ),
        entriesByClientOperation: {
          ...state.entriesByClientOperation,
          [lookupKey]: {
            entryId: entry.id,
            debtId: debt.id,
            fingerprint,
          },
        },
      }));
      return entry;
    },
    replaceState: (state) => set(cloneState(state)),
  }));
}

const demoParty: DebtParty = {
  id: "demo-party-client",
  workspaceId: "demo",
  name: "شركة النور",
  phone: "0910000000",
  notes: null,
  createdBy: "demo",
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-01T09:00:00.000Z",
};

const demoDebt: DebtSummary = {
  id: "demo-debt-receivable",
  workspaceId: "demo",
  partyId: demoParty.id,
  partyName: demoParty.name,
  partyPhone: demoParty.phone,
  direction: "receivable",
  principalMinor: 2_500_000n,
  balanceMinor: 1_500_000n,
  paidMinor: 1_000_000n,
  adjustedMinor: 0n,
  writtenOffMinor: 0n,
  currencyCode: "LYD",
  status: "partial",
  dueOn: "2026-07-10",
  projectId: null,
  projectName: null,
  note: "دفعة توريد",
  createdBy: "demo",
  createdAt: "2026-07-01T09:00:00.000Z",
  updatedAt: "2026-07-08T09:00:00.000Z",
};

export const demoDebtState: DebtStoreState = {
  parties: [demoParty],
  debts: [demoDebt],
  entriesByDebt: {
    [demoDebt.id]: [
      {
        id: "demo-debt-payment",
        workspaceId: "demo",
        debtId: demoDebt.id,
        entryType: "payment",
        amountMinor: -1_000_000n,
        currencyCode: "LYD",
        occurredOn: "2026-07-08",
        note: "دفعة أولى",
        financialEventId: null,
        createdBy: "demo",
        clientId: "demo-payment",
        operation: "post_debt_payment",
        createdAt: "2026-07-08T09:00:00.000Z",
      },
      {
        id: "demo-debt-open",
        workspaceId: "demo",
        debtId: demoDebt.id,
        entryType: "open",
        amountMinor: 2_500_000n,
        currencyCode: "LYD",
        occurredOn: "2026-07-01",
        note: "دفعة توريد",
        financialEventId: null,
        createdBy: "demo",
        clientId: "demo-open",
        operation: "create_debt_open",
        createdAt: "2026-07-01T09:00:00.000Z",
      },
    ],
  },
  creationByClientId: {},
  entriesByClientOperation: {
    "demo-payment::post_debt_payment": {
      entryId: "demo-debt-payment",
      debtId: demoDebt.id,
      fingerprint: JSON.stringify({
        debtId: demoDebt.id,
        entryType: "payment",
        amountMinor: "-1000000",
        occurredOn: "2026-07-08",
        note: "دفعة أولى",
        financialEventId: null,
      }),
    },
  },
};

export const debtStore = createDebtStore(demoDebtState);

export function useDebtStore<T>(selector: (state: DebtStore) => T): T {
  return useStore(debtStore, selector);
}
