import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  addWallet as addWalletToState,
  addWalletTransaction,
  applyTreasuryMovement as applyTreasuryMovementInState,
  archiveWallet as archiveWalletInState,
  deleteTransaction as deleteTransactionFromState,
  renameWallet as renameWalletInState,
  setWalletBalance as setWalletBalanceInState,
  transferBetweenWallets,
  updateTransaction as updateTransactionInState,
  type AddWalletTransactionInput,
  type FinanceState,
  type TransferBetweenWalletsInput,
  type TreasuryDirection,
  type Wallet,
} from "@/domain/finance/finance-state";

interface FinanceActions {
  addWallet: (wallet: Wallet) => void;
  addTransaction: (input: AddWalletTransactionInput) => void;
  transfer: (input: TransferBetweenWalletsInput) => void;
  setWalletBalance: (walletId: string, balanceMinor: bigint) => void;
  applyTreasuryMovement: (input: {
    id: string;
    walletId: string;
    amountMinor: bigint;
    direction: TreasuryDirection;
    occurredAt: string;
    note?: string;
  }) => void;
  renameWallet: (walletId: string, name: string) => void;
  archiveWallet: (walletId: string) => void;
  deleteTransaction: (transactionId: string) => void;
  updateTransaction: (
    transactionId: string,
    input: AddWalletTransactionInput,
  ) => void;
  replaceState: (state: FinanceState) => void;
}

export type FinanceStore = FinanceState & FinanceActions;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

export const demoFinanceState: FinanceState = deepFreeze({
  wallets: [
    {
      id: "cash",
      name: "المحفظة النقدية",
      currency: "LYD",
      balanceMinor: 2_450_000n,
    },
    {
      id: "bank",
      name: "الحساب المصرفي",
      currency: "LYD",
      balanceMinor: 8_750_000n,
    },
    {
      id: "safe",
      name: "الخزنة المنزلية",
      currency: "LYD",
      balanceMinor: 1_250_000n,
    },
    {
      id: "investments",
      name: "محفظة الاستثمارات",
      currency: "LYD",
      balanceMinor: 12_400_000n,
    },
  ],
  transactions: [
    {
      id: "tx-1",
      kind: "income",
      walletId: "bank",
      amountMinor: 1_250_000n,
      currency: "LYD",
      title: "دفعة من متجر الصقور",
      projectId: "falcon-store",
      occurredAt: "2026-07-13T08:45:00.000Z",
    },
    {
      id: "tx-2",
      kind: "expense",
      walletId: "cash",
      amountMinor: 185_000n,
      currency: "LYD",
      title: "مستلزمات المقهى",
      projectId: "coffee-project",
      occurredAt: "2026-07-12T14:20:00.000Z",
    },
    {
      id: "tx-3",
      kind: "transfer",
      walletId: "cash",
      destinationWalletId: "bank",
      amountMinor: 500_000n,
      currency: "LYD",
      title: "تحويل إلى المصرف",
      occurredAt: "2026-07-11T10:00:00.000Z",
    },
  ],
});

export const emptyFinanceState: FinanceState = deepFreeze({
  wallets: [],
  transactions: [],
});

function cloneFinanceState(state: FinanceState): FinanceState {
  return {
    wallets: state.wallets.map((wallet) => ({ ...wallet })),
    transactions: state.transactions.map((transaction) => ({
      ...transaction,
    })),
  };
}

export function createFinanceStore(
  initialState: FinanceState = emptyFinanceState,
): StoreApi<FinanceStore> {
  return createStore<FinanceStore>()((set) => ({
    ...cloneFinanceState(initialState),
    addWallet: (wallet) => {
      const ownedWallet = { ...wallet };
      set((current) =>
        addWalletToState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          ownedWallet,
        ),
      );
    },
    addTransaction: (input) => {
      const ownedInput = { ...input };
      set((current) =>
        addWalletTransaction(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          ownedInput,
        ),
      );
    },
    transfer: (input) =>
      set((current) =>
        transferBetweenWallets(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          input,
        ),
      ),
    setWalletBalance: (walletId, balanceMinor) =>
      set((current) =>
        setWalletBalanceInState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          walletId,
          balanceMinor,
        ),
      ),
    applyTreasuryMovement: (input) =>
      set((current) =>
        applyTreasuryMovementInState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          input,
        ),
      ),
    renameWallet: (walletId, name) =>
      set((current) =>
        renameWalletInState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          walletId,
          name,
        ),
      ),
    archiveWallet: (walletId) =>
      set((current) =>
        archiveWalletInState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          walletId,
        ),
      ),
    deleteTransaction: (transactionId) =>
      set((current) =>
        deleteTransactionFromState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          transactionId,
        ),
      ),
    updateTransaction: (transactionId, input) => {
      const ownedInput = { ...input };
      set((current) =>
        updateTransactionInState(
          {
            wallets: current.wallets,
            transactions: current.transactions,
          },
          transactionId,
          ownedInput,
        ),
      );
    },
    replaceState: (state) => set(cloneFinanceState(state)),
  }));
}

export const financeStore = createFinanceStore();

export function useFinanceStore<T>(
  selector: (state: FinanceStore) => T,
): T {
  return useStore(financeStore, selector);
}
