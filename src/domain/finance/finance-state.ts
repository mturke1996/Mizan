import {
  createTransferEntries,
  type CurrencyCode,
} from "@/domain/ledger/ledger";

export interface Wallet {
  id: string;
  name: string;
  currency: CurrencyCode;
  balanceMinor: bigint;
  kind?: "cash" | "bank" | "savings" | "investment";
}

interface BaseTransaction {
  id: string;
  amountMinor: bigint;
  currency: CurrencyCode;
  title: string;
  occurredAt: string;
  projectId?: string;
  categoryId?: string;
  note?: string;
}

export interface WalletTransaction extends BaseTransaction {
  kind: "income" | "expense";
  walletId: string;
}

export interface TransferTransaction extends BaseTransaction {
  kind: "transfer";
  walletId: string;
  destinationWalletId: string;
}

/** Opening balance, treasury fund, or treasury withdraw (equity — not P&L). */
export interface OpeningBalanceTransaction extends BaseTransaction {
  kind: "opening_balance";
  walletId: string;
  /** in = تمويل/افتتاحي, out = سحب من الخزينة */
  flow: "in" | "out";
}

export type FinanceTransaction =
  | WalletTransaction
  | TransferTransaction
  | OpeningBalanceTransaction;

export type TreasuryDirection = "fund" | "withdraw";

/** Signed effect on the primary wallet (transfer uses source perspective). */
export function signedTransactionAmount(
  transaction: FinanceTransaction,
): bigint {
  if (transaction.kind === "income") return transaction.amountMinor;
  if (transaction.kind === "expense") return -transaction.amountMinor;
  if (transaction.kind === "opening_balance") {
    return transaction.flow === "in"
      ? transaction.amountMinor
      : -transaction.amountMinor;
  }
  return -transaction.amountMinor;
}

export interface FinanceState {
  wallets: Wallet[];
  transactions: FinanceTransaction[];
}

export type AddWalletTransactionInput = WalletTransaction;

export type TransferBetweenWalletsInput = Omit<
  TransferTransaction,
  "kind" | "walletId" | "destinationWalletId"
> & {
  sourceWalletId: string;
  destinationWalletId: string;
};

function getWallet(state: FinanceState, walletId: string): Wallet {
  const wallet = state.wallets.find((candidate) => candidate.id === walletId);

  if (!wallet) {
    throw new Error("المحفظة غير موجودة");
  }

  return wallet;
}

function validatePositiveAmount(amountMinor: bigint): void {
  if (amountMinor <= 0n) {
    throw new Error("يجب أن يكون المبلغ أكبر من صفر");
  }
}

export function addWallet(
  state: FinanceState,
  wallet: Wallet,
): FinanceState {
  if (state.wallets.some((candidate) => candidate.id === wallet.id)) {
    throw new Error("المحفظة موجودة بالفعل");
  }

  if (!wallet.name.trim()) {
    throw new Error("اسم المحفظة مطلوب");
  }

  if (wallet.balanceMinor < 0n) {
    throw new Error("لا يمكن أن يكون الرصيد الافتتاحي سالبًا");
  }

  return {
    wallets: [...state.wallets, wallet],
    transactions: state.transactions,
  };
}

export function addWalletTransaction(
  state: FinanceState,
  input: AddWalletTransactionInput,
): FinanceState {
  validatePositiveAmount(input.amountMinor);

  const wallet = getWallet(state, input.walletId);

  if (wallet.currency !== input.currency) {
    throw new Error("عملة المعاملة لا تطابق عملة المحفظة");
  }

  const signedAmount =
    input.kind === "income" ? input.amountMinor : -input.amountMinor;

  return {
    wallets: state.wallets.map((candidate) =>
      candidate.id === wallet.id
        ? {
            ...candidate,
            balanceMinor: candidate.balanceMinor + signedAmount,
          }
        : candidate,
    ),
    transactions: [input, ...state.transactions],
  };
}

export function setWalletBalance(
  state: FinanceState,
  walletId: string,
  balanceMinor: bigint,
): FinanceState {
  if (balanceMinor < 0n) {
    throw new Error("لا يمكن أن يكون الرصيد سالبًا");
  }

  getWallet(state, walletId);

  return {
    wallets: state.wallets.map((wallet) =>
      wallet.id === walletId
        ? {
            ...wallet,
            balanceMinor,
          }
        : wallet,
    ),
    transactions: state.transactions,
  };
}

export function applyTreasuryMovement(
  state: FinanceState,
  input: {
    id: string;
    walletId: string;
    amountMinor: bigint;
    direction: TreasuryDirection;
    occurredAt: string;
    note?: string;
  },
): FinanceState {
  if (input.amountMinor <= 0n) {
    throw new Error("أدخل مبلغًا أكبر من صفر");
  }

  const wallet = getWallet(state, input.walletId);
  const flow: OpeningBalanceTransaction["flow"] =
    input.direction === "fund" ? "in" : "out";

  if (flow === "out" && wallet.balanceMinor < input.amountMinor) {
    throw new Error("الرصيد غير كافٍ لإتمام المعاملة");
  }

  const nextBalance =
    flow === "in"
      ? wallet.balanceMinor + input.amountMinor
      : wallet.balanceMinor - input.amountMinor;

  const title =
    input.note?.trim() ||
    (flow === "in"
      ? `تمويل الخزينة — ${wallet.name}`
      : `سحب من الخزينة — ${wallet.name}`);

  const transaction: OpeningBalanceTransaction = {
    id: input.id,
    kind: "opening_balance",
    walletId: wallet.id,
    flow,
    amountMinor: input.amountMinor,
    currency: wallet.currency,
    title,
    occurredAt: input.occurredAt,
  };

  return {
    wallets: state.wallets.map((candidate) =>
      candidate.id === wallet.id
        ? { ...candidate, balanceMinor: nextBalance }
        : candidate,
    ),
    transactions: [transaction, ...state.transactions],
  };
}

export function renameWallet(
  state: FinanceState,
  walletId: string,
  name: string,
): FinanceState {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("اسم المحفظة مطلوب");
  getWallet(state, walletId);
  if (
    state.wallets.some(
      (wallet) =>
        wallet.id !== walletId &&
        wallet.name.trim().toLocaleLowerCase("ar") ===
          trimmed.toLocaleLowerCase("ar"),
    )
  ) {
    throw new Error("يوجد محفظة بنفس الاسم");
  }

  return {
    wallets: state.wallets.map((wallet) =>
      wallet.id === walletId ? { ...wallet, name: trimmed } : wallet,
    ),
    transactions: state.transactions,
  };
}

export function archiveWallet(
  state: FinanceState,
  walletId: string,
): FinanceState {
  const wallet = getWallet(state, walletId);
  if (wallet.balanceMinor !== 0n) {
    throw new Error("انقل الرصيد أو صفّره قبل حذف المحفظة");
  }

  return {
    wallets: state.wallets.filter((candidate) => candidate.id !== walletId),
    transactions: state.transactions,
  };
}

export function deleteTransaction(
  state: FinanceState,
  transactionId: string,
): FinanceState {
  const transaction = state.transactions.find(
    (candidate) => candidate.id === transactionId,
  );

  if (!transaction) {
    throw new Error("المعاملة غير موجودة");
  }

  if (transaction.kind === "transfer") {
    const sourceWallet = getWallet(state, transaction.walletId);
    const destinationWallet = getWallet(
      state,
      transaction.destinationWalletId,
    );

    if (destinationWallet.balanceMinor < transaction.amountMinor) {
      throw new Error("لا يمكن حذف التحويل لأن رصيد محفظة الاستلام غير كافٍ");
    }

    return {
      wallets: state.wallets.map((wallet) => {
        if (wallet.id === sourceWallet.id) {
          return {
            ...wallet,
            balanceMinor: wallet.balanceMinor + transaction.amountMinor,
          };
        }
        if (wallet.id === destinationWallet.id) {
          return {
            ...wallet,
            balanceMinor: wallet.balanceMinor - transaction.amountMinor,
          };
        }
        return wallet;
      }),
      transactions: state.transactions.filter(
        (candidate) => candidate.id !== transactionId,
      ),
    };
  }

  const wallet = getWallet(state, transaction.walletId);
  const reversalDelta = -signedTransactionAmount(transaction);
  const nextBalance = wallet.balanceMinor + reversalDelta;

  if (nextBalance < 0n) {
    throw new Error("لا يمكن حذف المعاملة لأن الرصيد سيصبح سالبًا");
  }

  return {
    wallets: state.wallets.map((candidate) =>
      candidate.id === wallet.id
        ? {
            ...candidate,
            balanceMinor: nextBalance,
          }
        : candidate,
    ),
    transactions: state.transactions.filter(
      (candidate) => candidate.id !== transactionId,
    ),
  };
}

export function updateTransaction(
  state: FinanceState,
  transactionId: string,
  input: AddWalletTransactionInput,
): FinanceState {
  if (input.id !== transactionId) {
    throw new Error("معرّف المعاملة غير متطابق");
  }

  const existing = state.transactions.find(
    (candidate) => candidate.id === transactionId,
  );
  if (!existing) {
    throw new Error("المعاملة غير موجودة");
  }
  if (existing.kind === "transfer" || existing.kind === "opening_balance") {
    throw new Error("تعديل هذه الحركة غير مدعوم من هذه الشاشة");
  }

  const without = deleteTransaction(state, transactionId);
  return addWalletTransaction(without, input);
}

export function transferBetweenWallets(
  state: FinanceState,
  input: TransferBetweenWalletsInput,
): FinanceState {
  const sourceWallet = getWallet(state, input.sourceWalletId);
  const destinationWallet = getWallet(state, input.destinationWalletId);

  if (
    sourceWallet.currency !== input.currency ||
    destinationWallet.currency !== input.currency
  ) {
    throw new Error("عملة التحويل لا تطابق عملة المحافظ");
  }

  const entries = createTransferEntries({
    eventId: input.id,
    sourceWalletId: input.sourceWalletId,
    destinationWalletId: input.destinationWalletId,
    amountMinor: input.amountMinor,
    currency: input.currency,
  });

  if (sourceWallet.balanceMinor < input.amountMinor) {
    throw new Error("الرصيد غير كافٍ لإتمام التحويل");
  }

  const transaction: TransferTransaction = {
    id: input.id,
    kind: "transfer",
    walletId: input.sourceWalletId,
    destinationWalletId: input.destinationWalletId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    title: input.title,
    occurredAt: input.occurredAt,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.note ? { note: input.note } : {}),
  };

  return {
    wallets: state.wallets.map((wallet) => {
      const entry = entries.find(
        (candidate) => candidate.walletId === wallet.id,
      );

      return entry
        ? {
            ...wallet,
            balanceMinor: wallet.balanceMinor + entry.amountMinor,
          }
        : wallet;
    }),
    transactions: [transaction, ...state.transactions],
  };
}
