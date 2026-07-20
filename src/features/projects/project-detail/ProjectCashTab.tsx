import { useState } from "react";
import { ArrowLeftRight, Banknote, Plus, Wallet } from "lucide-react";
import type { Wallet as WalletType } from "@/domain/finance/finance-state";
import type { CurrencyCode } from "@/domain/ledger/ledger";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
  toSafeMinorNumber,
} from "@/domain/money/money";
import {
  useOpenOrLinkProjectWalletMutation,
  usePostProjectCashEntryMutation,
  useProjectCashBalanceQuery,
  useProjectCashEntriesQuery,
  useSetProjectCashModeMutation,
  useTransferProjectCashToWalletMutation,
} from "@/features/workspace/use-finance-data";
import type {
  ProjectCashMode,
  ProjectSummary,
} from "@/features/workspace/workspace-types";
import { getUserErrorMessage } from "@/lib/user-error";

interface ProjectCashTabProps {
  currency: CurrencyCode;
  project: ProjectSummary;
  wallets: WalletType[];
}

const CASH_MODE_OPTIONS: { value: ProjectCashMode; label: string }[] = [
  { value: "hybrid", label: "مختلط (خزينة + محفظة)" },
  { value: "project_cash", label: "خزينة فقط" },
  { value: "project_wallet", label: "محفظة فقط" },
  { value: "off", label: "معطّل" },
];

export function ProjectCashTab({ currency, project, wallets }: ProjectCashTabProps) {
  const balanceQuery = useProjectCashBalanceQuery(project.id);
  const entriesQuery = useProjectCashEntriesQuery(project.id);
  const postEntry = usePostProjectCashEntryMutation(project.id);
  const transferToWallet = useTransferProjectCashToWalletMutation(project.id);
  const setCashMode = useSetProjectCashModeMutation(project.id);
  const linkWallet = useOpenOrLinkProjectWalletMutation(project.id);

  const [entryType, setEntryType] = useState<"income" | "expense">("income");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferWalletId, setTransferWalletId] = useState(wallets[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const balance = balanceQuery.data?.balanceMinor ?? 0n;
  const entries = entriesQuery.data ?? [];
  const money = { currency, locale: "en-US" as const };
  const scale = getCurrencyScale(currency);
  const inputClass =
    "w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink placeholder:text-muted";

  const parseAmount = (raw: string) =>
    toSafeMinorNumber(parseMajorAmount(raw, scale));

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const minor = parseAmount(amount);
      if (minor <= 0) return;
      await postEntry.mutateAsync({
        entryType,
        amountMinor: minor,
        title: title.trim() || (entryType === "expense" ? "مصروف" : "إيراد"),
      });
      setTitle("");
      setAmount("");
    } catch (err) {
      setError(getUserErrorMessage(err, "تعذر التسجيل"));
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const minor = parseAmount(transferAmount);
      if (minor <= 0 || !transferWalletId) return;
      await transferToWallet.mutateAsync({
        walletId: transferWalletId,
        amountMinor: minor,
      });
      setTransferAmount("");
    } catch (err) {
      setError(getUserErrorMessage(err, "تعذر التحويل"));
    }
  };

  if (project.cashMode === "off" || !project.cashMode) {
    return (
      <section className="rounded-[18px] border border-line bg-surface p-5 text-center">
        <p className="text-sm font-semibold text-ink">خزينة المشروع معطّلة</p>
        <p className="mt-1 text-xs text-muted">
          فعّل «خزينة فقط» أو «مختلط» لتسجيل دخل ومصروف داخل المشروع
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {CASH_MODE_OPTIONS.filter((o) => o.value !== "off").map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCashMode.mutate(opt.value)}
              className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary hover:text-primary"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[18px] border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">وضع خزينة المشروع</h3>
        <div className="flex flex-wrap gap-2">
          {CASH_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCashMode.mutate(opt.value)}
              className={[
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                project.cashMode === opt.value
                  ? "bg-primary text-primary-on"
                  : "bg-surface-subtle text-muted hover:bg-primary-soft hover:text-primary",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-line bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">رصيد الخزينة</p>
            <p
              className={`numeric mt-1 text-2xl font-black ${
                balance < 0n ? "text-danger" : "text-ink"
              }`}
              dir="ltr"
            >
              {formatMinorAmount(balance, money)}
              <span className="ms-1 text-sm font-bold text-muted">{currency}</span>
            </p>
            {balance < 0n ? (
              <p className="mt-1.5 text-[11px] leading-5 text-danger">
                عجز في الخزينة — سيغطيه الإيراد عند إضافته
              </p>
            ) : null}
          </div>
          <Banknote
            className={balance < 0n ? "text-danger" : "text-primary"}
            size={28}
          />
        </div>
        {!project.linkedWalletId ? (
          <button
            type="button"
            onClick={() => linkWallet.mutate(undefined)}
            disabled={linkWallet.isPending}
            className="mt-3 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-on"
          >
            <Wallet size={14} />
            فتح محفظة للمشروع
          </button>
        ) : (
          <p className="mt-2 text-xs font-medium text-success">محفظة مرتبطة</p>
        )}
      </section>

      {(project.cashMode === "project_cash" || project.cashMode === "hybrid") && (
        <section className="rounded-[18px] border border-line bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <Plus size={16} /> تسجيل حركة
          </h3>
          <form onSubmit={handlePostEntry} className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEntryType("income")}
                className={[
                  "flex-1 rounded-xl py-2 text-xs font-bold transition-colors",
                  entryType === "income"
                    ? "bg-success text-white"
                    : "bg-surface-subtle text-muted",
                ].join(" ")}
              >
                إيراد
              </button>
              <button
                type="button"
                onClick={() => setEntryType("expense")}
                className={[
                  "flex-1 rounded-xl py-2 text-xs font-bold transition-colors",
                  entryType === "expense"
                    ? "bg-danger text-white"
                    : "bg-surface-subtle text-muted",
                ].join(" ")}
              >
                مصروف
              </button>
            </div>
            <input
              type="text"
              placeholder="الوصف (اختياري)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              placeholder="المبلغ"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className={`numeric ${inputClass}`}
            />
            {entryType === "expense" ? (
              <p className="text-[11px] leading-5 text-muted">
                يمكن تسجيل المصروف حتى لو الرصيد غير كافٍ؛ يصبح الرصيد سالبًا
                ويغطيه الإيراد لاحقًا. التحويل إلى المحفظة يحتاج رصيدًا كافيًا.
              </p>
            ) : null}
            <button
              type="submit"
              disabled={postEntry.isPending}
              className="pressable w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-on disabled:opacity-50"
            >
              {postEntry.isPending ? "جاري الحفظ..." : "تسجيل"}
            </button>
          </form>
        </section>
      )}

      {wallets.length > 0 &&
      (project.cashMode === "project_cash" || project.cashMode === "hybrid") ? (
        <section className="rounded-[18px] border border-line bg-surface p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
            <ArrowLeftRight size={16} /> تحويل إلى محفظة
          </h3>
          <form onSubmit={handleTransfer} className="space-y-3">
            <select
              value={transferWalletId}
              onChange={(e) => setTransferWalletId(e.target.value)}
              className={inputClass}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="decimal"
              dir="ltr"
              placeholder="المبلغ"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              required
              className={`numeric ${inputClass}`}
            />
            <button
              type="submit"
              disabled={transferToWallet.isPending}
              className="pressable w-full rounded-xl bg-info py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {transferToWallet.isPending ? "جاري التحويل..." : "تحويل"}
            </button>
          </form>
        </section>
      ) : null}

      {error ? <p className="text-center text-xs text-danger">{error}</p> : null}

      <section className="rounded-[18px] border border-line bg-surface p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">آخر الحركات</h3>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">لا توجد حركات بعد</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.slice(0, 20).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    {entry.title ||
                      (entry.entryType === "income"
                        ? "إيراد"
                        : entry.entryType === "expense"
                          ? "مصروف"
                          : entry.entryType === "transfer_in"
                            ? "تحويل وارد"
                            : "تحويل إلى محفظة")}
                  </p>
                  <p className="text-[11px] text-muted">
                    {new Date(entry.createdAt).toLocaleDateString("ar-LY")}
                  </p>
                </div>
                <span
                  className={[
                    "numeric text-sm font-bold",
                    entry.entryType === "income" ? "text-success" : "text-danger",
                  ].join(" ")}
                  dir="ltr"
                >
                  {entry.entryType === "income" ? "+" : "-"}
                  {formatMinorAmount(entry.amountMinor, money)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
