import { useMemo } from "react";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import {
  Scale,
  Clock,
  MessageSquare,
  ArrowUpRight,
} from "lucide-react";
import { formatMinorAmount } from "@/domain/money/money";
import type { DebtSummary } from "@/features/workspace/workspace-types";

interface DebtRecoveryTimelineProps {
  debts: DebtSummary[];
  currency: string;
}

export function DebtRecoveryTimeline({
  debts,
  currency,
}: DebtRecoveryTimelineProps) {
  const activeDebts = useMemo(() => {
    return debts
      .filter((d) => d.status === "open" || d.status === "partial")
      .sort((a, b) => {
        if (!a.dueOn) return 1;
        if (!b.dueOn) return -1;
        return new Date(a.dueOn).getTime() - new Date(b.dueOn).getTime();
      })
      .slice(0, 4);
  }, [debts]);

  const totalReceivablesMinor = useMemo(() => {
    return activeDebts
      .filter((d) => d.direction === "receivable")
      .reduce((sum, d) => sum + d.balanceMinor, 0n);
  }, [activeDebts]);

  const generateWhatsAppLink = (debt: DebtSummary) => {
    const remaining = Number(debt.balanceMinor) / 100;
    const text = encodeURIComponent(
      `مرحباً ${debt.partyName}، للتذكير بمستحق مبلغ ${remaining.toLocaleString("en-US")} ${currency} بخصوص (${debt.note ?? "مستحقات مالية"}). شكراً لك!`
    );
    const phone = debt.partyPhone ? debt.partyPhone.replace(/\D/g, "") : "";
    return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
      className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 backdrop-blur-md shadow-card md:p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/25">
            <Scale size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-ink">
              ما يستحق التحصيل
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              مواعيد الاستحقاق والأطراف التي تحتاج متابعة
            </p>
          </div>
        </div>

        {/* Total Receivable Summary */}
        <div className="rounded-xl border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary">
          <span>إجمالي المستحقات: </span>
          <span className="font-mono dir-ltr inline-block ms-1">
            {formatMinorAmount(totalReceivablesMinor, { currency, locale: "en-US" })} {currency}
          </span>
        </div>
      </div>

      {/* Timeline Items Stream */}
      <div className="mt-4 space-y-3">
        {activeDebts.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            لا توجد ديون أو مستحقات نشطة متأخرة حالياً
          </div>
        ) : (
          activeDebts.map((debt) => {
            const isOverdue = debt.dueOn && new Date(debt.dueOn) < new Date();

            return (
              <div
                key={debt.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-subtle p-3.5 transition-colors hover:border-primary/40 hover:bg-surface-raised"
              >
                {/* Person & Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-bold ${
                      debt.direction === "receivable"
                        ? "bg-success-soft text-success ring-1 ring-success/30"
                        : "bg-warning-soft text-warning ring-1 ring-warning/30"
                    }`}
                  >
                    {debt.direction === "receivable" ? "+" : "-"}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate text-sm font-bold text-ink">
                        {debt.partyName}
                      </strong>
                      <span className="text-[11px] text-muted">({debt.note ?? "مستحق مال"})</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      {debt.dueOn ? (
                        <span
                          className={`flex items-center gap-1 font-mono ${
                            isOverdue ? "text-danger font-bold" : "text-muted"
                          }`}
                        >
                          <Clock size={12} />
                          {debt.dueOn}
                          {isOverdue && " (متأخر)"}
                        </span>
                      ) : (
                        <span>بدون تاريخ استحقاق</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Side Actions & Amount */}
                <div className="flex items-center gap-3">
                  <div className="text-right dir-ltr">
                    <span className="font-mono text-sm font-black text-ink block">
                      {formatMinorAmount(debt.balanceMinor, { currency, locale: "en-US" })} {currency}
                    </span>
                    <span className="text-[10px] text-muted font-sans block">
                      {debt.direction === "receivable" ? "مستحق لك" : "مستحق عليك"}
                    </span>
                  </div>

                  {/* WhatsApp Dispatch Button */}
                  <a
                    href={generateWhatsAppLink(debt)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`تذكير عبر واتساب لـ ${debt.partyName}`}
                    className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/30 transition-transform hover:scale-105 hover:bg-primary hover:text-primary-on"
                  >
                    <MessageSquare size={16} />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Link */}
      <div className="mt-4 flex justify-end">
        <Link
          to="/debts"
          className="flex items-center gap-1.5 text-xs font-bold text-muted hover:text-ink transition-colors"
        >
          <span>عرض كافة سجل الديون والعملاء</span>
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}
