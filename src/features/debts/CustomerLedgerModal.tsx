import { Printer, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DebtSummary as DebtItem } from "@/features/workspace/workspace-types";
import { formatMinorAmount } from "@/domain/money/money";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { buildCustomerLedgerWhatsAppText, openWhatsApp } from "@/lib/whatsapp";
import { AppSheet } from "@/shared/ui/AppSheet";

export interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  debts: readonly DebtItem[];
  initialPartyName?: string;
}

export function CustomerLedgerModal({
  isOpen,
  onClose,
  debts,
  initialPartyName = "",
}: CustomerLedgerModalProps) {
  const { currency, membership } = useWorkspace();
  const [selectedParty, setSelectedParty] = useState(initialPartyName);

  useEffect(() => {
    if (isOpen) setSelectedParty(initialPartyName);
  }, [isOpen, initialPartyName]);

  const parties = useMemo(() => {
    const set = new Set<string>();
    for (const d of debts) {
      if (d.partyName) set.add(d.partyName);
    }
    return Array.from(set).sort();
  }, [debts]);

  const partyDebts = useMemo(() => {
    if (!selectedParty) return debts;
    return debts.filter((d) => d.partyName === selectedParty);
  }, [debts, selectedParty]);

  const summary = useMemo(() => {
    let totalInitial = 0n;
    let totalPaid = 0n;
    for (const d of partyDebts) {
      totalInitial += d.principalMinor;
      totalPaid += d.paidMinor;
    }
    const totalRemaining = totalInitial - totalPaid;
    return {
      totalInitial,
      totalPaid,
      totalRemaining: totalRemaining > 0n ? totalRemaining : 0n,
    };
  }, [partyDebts]);

  const activePartyPhone = partyDebts.find((d) => d.partyPhone)?.partyPhone;

  const handleShareWhatsApp = () => {
    const text = buildCustomerLedgerWhatsAppText({
      customerName: selectedParty || "كشف الحساب العام",
      totalDebits: formatMinorAmount(summary.totalInitial, {
        currency,
        locale: "en-US",
      }),
      totalCredits: formatMinorAmount(summary.totalPaid, {
        currency,
        locale: "en-US",
      }),
      netBalance: formatMinorAmount(summary.totalRemaining, {
        currency,
        locale: "en-US",
      }),
      currencyCode: currency,
      workspaceName: membership?.workspaceName,
    });
    openWhatsApp(text, activePartyPhone);
  };

  return (
    <AppSheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="كشف حساب تفصيلي"
      description="ملخص المستحقات والمدفوعات السابقة"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => window.print()}
            className="pressable flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-ink hover:bg-surface-subtle"
          >
            <Printer aria-hidden="true" size={16} />
            طباعة
          </button>
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="pressable flex min-h-11 items-center justify-center gap-2 rounded-xl bg-success px-4 text-xs font-bold text-white hover:brightness-105"
          >
            <Share2 aria-hidden="true" size={16} />
            إرسال عبر واتساب
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="party-select"
            className="mb-1.5 block text-xs font-bold text-ink"
          >
            اختر الطرف / العميل
          </label>
          <select
            id="party-select"
            value={selectedParty}
            onChange={(e) => setSelectedParty(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-canvas px-3 text-sm font-bold text-ink focus:border-primary focus:outline-hidden"
          >
            <option value="">جميع الأطراف ({debts.length})</option>
            {parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-line bg-canvas px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium text-muted">المسحوبات</p>
            <p className="numeric mt-1 text-sm font-bold text-ink" dir="ltr">
              {formatMinorAmount(summary.totalInitial, {
                currency,
                locale: "en-US",
              })}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">{currency}</p>
          </div>
          <div className="rounded-2xl border border-line bg-canvas px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium text-muted">المدفوعات</p>
            <p className="numeric mt-1 text-sm font-bold text-success" dir="ltr">
              {formatMinorAmount(summary.totalPaid, {
                currency,
                locale: "en-US",
              })}
            </p>
            <p className="mt-0.5 text-[10px] text-muted">{currency}</p>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary-soft px-2.5 py-3 text-center">
            <p className="text-[10px] font-medium text-primary">المتبقي</p>
            <p className="numeric mt-1 text-sm font-bold text-primary" dir="ltr">
              {formatMinorAmount(summary.totalRemaining, {
                currency,
                locale: "en-US",
              })}
            </p>
            <p className="mt-0.5 text-[10px] text-primary/80">{currency}</p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-ink">
            السجلات ({partyDebts.length})
          </h4>
          {partyDebts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              لا توجد سجلات لهذا الطرف
            </p>
          ) : (
            <ul className="space-y-2">
              {partyDebts.map((d) => {
                const rem = BigInt(d.balanceMinor ?? 0n);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line bg-canvas p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {d.partyName}
                        {d.projectName ? ` · ${d.projectName}` : ""}
                      </p>
                      {d.partyPhone ? (
                        <p className="mt-0.5 text-[11px] text-muted" dir="ltr">
                          {d.partyPhone}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-start">
                      <p className="numeric font-bold text-ink" dir="ltr">
                        {formatMinorAmount(rem > 0n ? rem : 0n, {
                          currency,
                          locale: "en-US",
                        })}{" "}
                        {currency}
                      </p>
                      <span
                        className={`text-[10px] font-bold ${
                          d.status === "settled" ? "text-success" : "text-warning"
                        }`}
                      >
                        {d.status === "settled" ? "خالص" : "نشط"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </AppSheet>
  );
}
