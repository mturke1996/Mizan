import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import type { TreasuryDirection } from "@/domain/finance/finance-state";
import { useFinanceStore } from "@/features/finance/finance-store";
import { TransactionList } from "@/features/transactions/TransactionList";
import {
  useArchiveWalletMutation,
  usePostTreasuryMovementMutation,
  useRenameWalletMutation,
} from "@/features/workspace/use-finance-data";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { getUserErrorMessage } from "@/lib/user-error";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

export function WalletDetailPage() {
  const { walletId } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { isDemo = false } = useWorkspace();
  const { wallets, transactions: allTransactions } = useFinanceView();
  const applyTreasuryMovement = useFinanceStore(
    (state) => state.applyTreasuryMovement,
  );
  const renameDemoWallet = useFinanceStore((state) => state.renameWallet);
  const archiveDemoWallet = useFinanceStore((state) => state.archiveWallet);
  const postTreasury = usePostTreasuryMovementMutation();
  const renameWallet = useRenameWalletMutation();
  const archiveWallet = useArchiveWalletMutation();
  const wallet = wallets.find((item) => item.id === walletId);
  const transactions = allTransactions.filter(
    (transaction) =>
      transaction.walletId === walletId ||
      (transaction.kind === "transfer" &&
        transaction.destinationWalletId === walletId),
  );
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [treasuryDirection, setTreasuryDirection] =
    useState<TreasuryDirection>("fund");
  const [editingName, setEditingName] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [busy, setBusy] = useState(false);

  if (!wallet) {
    return (
      <div className="px-4 sm:px-6" dir="rtl">
        <PageHeader
          title="المحفظة غير موجودة"
          subtitle="قد تكون حُذفت أو تغير رابطها."
          backTo="/wallets"
        />
      </div>
    );
  }

  const scale = getCurrencyScale(wallet.currency);

  const openTreasuryEditor = (direction: TreasuryDirection) => {
    setTreasuryDirection(direction);
    setAmountInput("");
    setNoteInput("");
    setTreasuryOpen(true);
  };

  const openNameEditor = () => {
    setNameInput(wallet.name);
    setEditingName(true);
  };

  const saveTreasuryMovement = async () => {
    if (busy || postTreasury.isPending) return;
    let amountMinor: bigint;
    try {
      amountMinor = parseMajorAmount(amountInput || "0", scale);
    } catch {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (amountMinor <= 0n) {
      toast.error("أدخل مبلغًا أكبر من صفر");
      return;
    }
    if (
      treasuryDirection === "withdraw" &&
      amountMinor > wallet.balanceMinor
    ) {
      toast.error("الرصيد غير كافٍ لإتمام المعاملة");
      return;
    }

    const note = noteInput.trim() || undefined;
    setBusy(true);
    try {
      if (isDemo) {
        applyTreasuryMovement({
          id: crypto.randomUUID(),
          walletId: wallet.id,
          amountMinor,
          direction: treasuryDirection,
          occurredAt: new Date().toISOString(),
          note,
        });
      } else {
        await postTreasury.mutateAsync({
          walletId: wallet.id,
          amountMinor: toSafeMinorNumber(amountMinor),
          direction: treasuryDirection,
          clientId: crypto.randomUUID(),
          note,
        });
      }
      setTreasuryOpen(false);
      toast.success(
        treasuryDirection === "fund"
          ? "تم تمويل الخزينة"
          : "تم السحب من الخزينة",
      );
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر تسجيل حركة الخزينة"));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (busy || renameWallet.isPending) return;
    const next = nameInput.trim();
    if (!next) {
      toast.error("اكتب اسمًا واضحًا للمحفظة");
      return;
    }
    if (next === wallet.name) {
      setEditingName(false);
      return;
    }
    setBusy(true);
    try {
      if (isDemo) {
        renameDemoWallet(wallet.id, next);
      } else {
        await renameWallet.mutateAsync({ walletId: wallet.id, name: next });
      }
      setEditingName(false);
      toast.success("تم تحديث اسم المحفظة");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر تحديث اسم المحفظة"));
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (busy || archiveWallet.isPending) return;
    const ok = await confirm({
      title: `حذف محفظة «${wallet.name}»؟`,
      description: "ستُخفى من القائمة. يجب أن يكون الرصيد صفرًا أولًا.",
      warning:
        wallet.balanceMinor !== 0n
          ? "الرصيد الحالي ليس صفرًا — اسحب من الخزينة أو حوّل الرصيد قبل الحذف."
          : undefined,
      tone: "danger",
      confirmLabel: "حذف المحفظة",
    });
    if (!ok) return;

    setBusy(true);
    try {
      if (isDemo) {
        archiveDemoWallet(wallet.id);
      } else {
        await archiveWallet.mutateAsync(wallet.id);
      }
      toast.success("تم حذف المحفظة");
      navigate("/wallets");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر حذف المحفظة"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-6" dir="rtl">
      <PageHeader
        title={wallet.name}
        subtitle={`محفظة بعملة ${wallet.currency}`}
        backTo="/wallets"
        action={
          <Link
            to={`/transactions/new?wallet=${wallet.id}`}
            aria-label="إضافة معاملة للمحفظة"
            className="pressable flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          >
            <Plus aria-hidden="true" size={18} />
            معاملة
          </Link>
        }
      />

      <AppCard
        elevated
        className="relative mb-4 overflow-hidden rounded-[22px] p-5 sm:p-6"
        aria-labelledby="wallet-balance-title"
      >
        <div className="pointer-events-none absolute -top-20 -left-16 size-48 rounded-full bg-primary-soft" />
        <div className="relative flex items-start justify-between">
          <div>
            <p id="wallet-balance-title" className="text-sm text-muted">
              الرصيد الحالي
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <strong className="numeric text-[34px] leading-none font-bold tracking-[-0.04em] text-ink">
                {formatMinorAmount(wallet.balanceMinor, {
                  currency: wallet.currency,
                  locale: "en-US",
                })}
              </strong>
              <span className="text-xs font-bold text-muted">
                {wallet.currency}
              </span>
            </p>
            <p className="mt-4 text-xs text-muted">
              {transactions.length} حركات مسجلة
            </p>
          </div>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <WalletCards aria-hidden="true" size={23} />
          </span>
        </div>
      </AppCard>

      {editingName ? (
        <AppCard className="mb-4 space-y-3 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Pencil aria-hidden="true" size={16} />
            تعديل الاسم
          </h3>
          <input
            aria-label="اسم المحفظة"
            className="min-h-11 w-full rounded-xl border border-control-border bg-surface px-3 text-sm"
            onChange={(event) => setNameInput(event.target.value)}
            value={nameInput}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              className="pressable flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface text-sm font-bold text-ink"
              disabled={busy}
              onClick={() => setEditingName(false)}
              type="button"
            >
              إلغاء
            </button>
            <button
              className="pressable flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy || renameWallet.isPending}
              onClick={() => void saveName()}
              type="button"
            >
              حفظ الاسم
            </button>
          </div>
        </AppCard>
      ) : null}

      {treasuryOpen ? (
        <AppCard className="mb-4 space-y-3 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-ink">
            {treasuryDirection === "fund"
              ? "تمويل الخزينة"
              : "سحب من الخزينة"}
          </h3>
          <p className="text-xs text-muted">
            {treasuryDirection === "fund"
              ? "سجّل ضخ فلوس إلى هذه المحفظة (رأس مال أو دعم)."
              : "سجّل سحب فلوس من هذه المحفظة إلى خارج النظام."}
          </p>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="نوع حركة الخزينة"
          >
            <button
              className={[
                "pressable flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold",
                treasuryDirection === "fund"
                  ? "border-success/40 bg-success-soft text-success"
                  : "border-line bg-surface text-ink",
              ].join(" ")}
              disabled={busy}
              onClick={() => setTreasuryDirection("fund")}
              type="button"
            >
              <ArrowDownToLine aria-hidden="true" size={16} />
              تمويل
            </button>
            <button
              className={[
                "pressable flex min-h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold",
                treasuryDirection === "withdraw"
                  ? "border-danger/40 bg-danger-soft text-danger"
                  : "border-line bg-surface text-ink",
              ].join(" ")}
              disabled={busy}
              onClick={() => setTreasuryDirection("withdraw")}
              type="button"
            >
              <ArrowUpFromLine aria-hidden="true" size={16} />
              سحب
            </button>
          </div>
          <input
            aria-label={`مبلغ ${treasuryDirection === "fund" ? "التمويل" : "السحب"} بعملة ${wallet.currency}`}
            className="numeric min-h-11 w-full rounded-xl border border-control-border bg-surface px-3 text-left text-sm"
            dir="ltr"
            inputMode="decimal"
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="0.00"
            value={amountInput}
          />
          <input
            aria-label="ملاحظة اختيارية"
            className="min-h-11 w-full rounded-xl border border-control-border bg-surface px-3 text-sm"
            onChange={(event) => setNoteInput(event.target.value)}
            placeholder="ملاحظة (اختياري)"
            value={noteInput}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              className="pressable flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface text-sm font-bold text-ink"
              disabled={busy}
              onClick={() => setTreasuryOpen(false)}
              type="button"
            >
              إلغاء
            </button>
            <button
              className="pressable flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy || postTreasury.isPending}
              onClick={() => void saveTreasuryMovement()}
              type="button"
            >
              {busy
                ? "جارٍ الحفظ…"
                : treasuryDirection === "fund"
                  ? "تأكيد التمويل"
                  : "تأكيد السحب"}
            </button>
          </div>
        </AppCard>
      ) : (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <button
            className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-subtle"
            onClick={openNameEditor}
            type="button"
          >
            <Pencil aria-hidden="true" size={18} />
            تعديل الاسم
          </button>
          <button
            className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-subtle"
            onClick={() => openTreasuryEditor("fund")}
            type="button"
          >
            <ArrowDownToLine aria-hidden="true" size={18} />
            تمويل الخزينة
          </button>
        </div>
      )}

      {!treasuryOpen ? (
        <button
          className="pressable mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-subtle"
          onClick={() => openTreasuryEditor("withdraw")}
          type="button"
        >
          <ArrowUpFromLine aria-hidden="true" size={18} />
          سحب من الخزينة
        </button>
      ) : null}

      <Link
        to={`/transfer?from=${wallet.id}`}
        aria-label="تحويل من هذه المحفظة"
        className="pressable mb-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-5 text-sm font-bold text-primary-ink hover:bg-primary hover:text-primary-on"
      >
        <ArrowLeftRight aria-hidden="true" size={18} />
        تحويل من هذه المحفظة
      </Link>

      <button
        className="pressable mb-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-5 text-sm font-bold text-danger hover:opacity-90"
        disabled={busy || archiveWallet.isPending}
        onClick={() => void handleArchive()}
        type="button"
      >
        <Trash2 aria-hidden="true" size={18} />
        حذف المحفظة
      </button>

      <section aria-labelledby="wallet-transactions-title">
        <h2
          id="wallet-transactions-title"
          className="mb-3 text-lg font-bold text-ink"
        >
          حركات المحفظة
        </h2>
        <TransactionList
          transactions={transactions}
          wallets={wallets}
          emptyMessage="لا توجد حركات في هذه المحفظة"
        />
      </section>
    </div>
  );
}
