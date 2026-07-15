import { ArrowDownLeft, ArrowUpRight, Paperclip, Pencil, Repeat2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { formatMinorAmount } from "@/domain/money/money";
import { useFinanceStore } from "@/features/finance/finance-store";
import {
  useEventAttachmentsQuery,
  useReverseFinancialEventMutation,
  useUploadEventAttachmentMutation,
} from "@/features/workspace/use-finance-data";
import { useFinanceView } from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { getUserErrorMessage } from "@/lib/user-error";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

const typePresentation = {
  income: {
    label: "دخل",
    icon: ArrowDownLeft,
    tone: "bg-success-soft text-success",
  },
  expense: {
    label: "مصروف",
    icon: ArrowUpRight,
    tone: "bg-danger-soft text-danger",
  },
  transfer: {
    label: "تحويل",
    icon: Repeat2,
    tone: "bg-info-soft text-info",
  },
} as const;

const dateFormatter = new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
  dateStyle: "long",
  timeStyle: "short",
});

export function TransactionDetailPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { isDemo = false, workspaceId } = useWorkspace();
  const { wallets, transactions } = useFinanceView();
  const deleteTransaction = useFinanceStore(
    (state) => state.deleteTransaction,
  );
  const reverseEvent = useReverseFinancialEventMutation();
  const attachmentsQuery = useEventAttachmentsQuery(
    isDemo ? undefined : transactionId,
  );
  const uploadAttachment = useUploadEventAttachmentMutation(
    transactionId ?? "",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const transaction = transactions.find((item) => item.id === transactionId);

  if (!transaction) {
    return (
      <div className="px-4 sm:px-6">
        <PageHeader
          title="المعاملة غير موجودة"
          subtitle="قد تكون حُذفت أو تغير رابطها."
          backTo="/transactions"
        />
      </div>
    );
  }

  const presentation = typePresentation[transaction.kind];
  const Icon = presentation.icon;
  const wallet = wallets.find(
    (item) => item.id === transaction.walletId,
  );
  const destination =
    transaction.kind === "transfer"
      ? wallets.find(
          (item) => item.id === transaction.destinationWalletId,
        )
      : undefined;
  const signedAmount =
    transaction.kind === "income"
      ? transaction.amountMinor
      : -transaction.amountMinor;
  const canEdit = transaction.kind !== "transfer";

  const handleDelete = async () => {
    if (busy || reverseEvent.isPending) return;
    const ok = await confirm({
      title: "حذف المعاملة؟",
      description: "سيتم عكس أثرها على أرصدة المحافظ.",
      tone: "danger",
      confirmLabel: "حذف",
    });
    if (!ok) return;

    setBusy(true);
    try {
      if (isDemo) {
        deleteTransaction(transaction.id);
      } else {
        await reverseEvent.mutateAsync({
          eventId: transaction.id,
          clientId: crypto.randomUUID(),
          reason: "حذف المعاملة",
        });
      }
      toast.success("تم حذف المعاملة");
      navigate("/transactions", { replace: true });
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر حذف المعاملة"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title={transaction.title}
        subtitle={presentation.label}
        backTo="/transactions"
      />

      <AppCard
        elevated
        className="mb-5 flex flex-col items-center px-5 py-7 text-center"
      >
        <span
          className={`flex size-14 items-center justify-center rounded-md ${presentation.tone}`}
        >
          <Icon aria-hidden="true" size={26} strokeWidth={1.8} />
        </span>
        <p
          className={`numeric mt-5 text-3xl font-bold tracking-[-0.035em] ${
            transaction.kind === "income" ? "text-success" : "text-ink"
          }`}
        >
          {signedAmount > 0n ? "+" : ""}
          {formatMinorAmount(signedAmount, {
            currency: transaction.currency,
            locale: "en-US",
          })}
        </p>
        <p className="mt-1 text-xs font-bold text-muted">
          {transaction.currency}
        </p>
      </AppCard>

      <AppCard className="mb-5 overflow-hidden">
        <dl className="divide-y divide-line">
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">النوع</dt>
            <dd className="text-sm font-bold text-ink">
              {presentation.label}
            </dd>
          </div>
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">
              {transaction.kind === "transfer" ? "من محفظة" : "المحفظة"}
            </dt>
            <dd className="text-sm font-bold text-ink">
              {wallet?.name ?? "محفظة محذوفة"}
            </dd>
          </div>
          {destination ? (
            <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted">إلى محفظة</dt>
              <dd className="text-sm font-bold text-ink">
                {destination.name}
              </dd>
            </div>
          ) : null}
          <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-muted">التاريخ</dt>
            <dd className="text-left text-sm font-bold text-ink">
              <time dateTime={transaction.occurredAt}>
                {dateFormatter.format(new Date(transaction.occurredAt))}
              </time>
            </dd>
          </div>
          {transaction.projectId ? (
            <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-muted">المشروع</dt>
              <dd>
                <Link
                  to={`/projects/${transaction.projectId}`}
                  className="text-sm font-bold text-primary"
                >
                  عرض المشروع
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </AppCard>

      {!isDemo && workspaceId ? (
        <AppCard className="mb-5 space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <Paperclip aria-hidden="true" size={16} />
              مرفقات الإثبات
            </h2>
            <button
              className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold text-ink disabled:opacity-60"
              disabled={uploadAttachment.isPending || !transactionId}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {uploadAttachment.isPending ? "جارٍ الرفع…" : "إرفاق ملف"}
            </button>
            <input
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file || !transactionId) return;
                void uploadAttachment
                  .mutateAsync(file)
                  .then(() => toast.success("تم رفع المرفق"))
                  .catch((error) =>
                    toast.error(
                      getUserErrorMessage(error, "تعذر رفع المرفق"),
                    ),
                  );
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
          {attachmentsQuery.isLoading ? (
            <p className="text-xs text-muted">جارٍ تحميل المرفقات…</p>
          ) : (attachmentsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted">
              لا توجد مرفقات بعد. ارفع صورة أو PDF كإثبات.
            </p>
          ) : (
            <ul className="space-y-2">
              {attachmentsQuery.data?.map((attachment) => (
                <li
                  className="rounded-sm bg-surface-subtle px-3 py-2 text-xs text-ink"
                  key={attachment.id}
                >
                  <p className="font-bold">{attachment.fileName}</p>
                  <p className="mt-1 text-muted">
                    {attachment.contentType} ·{" "}
                    <bdi className="numeric" dir="ltr">
                      {attachment.byteSize}
                    </bdi>{" "}
                    بايت
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      ) : null}

      <div className="space-y-3">
        {canEdit ? (
          <Link
            to={`/transactions/${transaction.id}/edit`}
            className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-sm font-bold text-ink hover:bg-surface-subtle"
          >
            <Pencil aria-hidden="true" size={18} />
            تعديل المعاملة
          </Link>
        ) : null}
        <button
          className="pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-danger bg-danger-soft px-5 text-sm font-bold text-danger disabled:opacity-60"
          disabled={busy || reverseEvent.isPending}
          onClick={() => void handleDelete()}
          type="button"
        >
          <Trash2 aria-hidden="true" size={18} />
          {busy ? "جارٍ الحذف…" : "حذف المعاملة"}
        </button>
      </div>
    </div>
  );
}
