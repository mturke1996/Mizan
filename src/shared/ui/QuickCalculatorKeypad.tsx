import { Calculator, Check, Delete, RotateCcw } from "lucide-react";
import { useState } from "react";

interface QuickCalculatorKeypadProps {
  initialValue?: string;
  onApply: (calculatedValue: string) => void;
  onClose?: () => void;
}

export function QuickCalculatorKeypad({
  initialValue = "",
  onApply,
  onClose,
}: QuickCalculatorKeypadProps) {
  const [expression, setExpression] = useState<string>(initialValue || "0");
  const [hasEvaluated, setHasEvaluated] = useState(false);

  const handleDigit = (digit: string) => {
    if (hasEvaluated || expression === "0") {
      setExpression(digit);
      setHasEvaluated(false);
    } else {
      setExpression((prev) => prev + digit);
    }
  };

  const handleOperator = (op: string) => {
    setHasEvaluated(false);
    const lastChar = expression.trim().slice(-1);
    if (["+", "-", "*", "/"].includes(lastChar)) {
      setExpression((prev) => prev.slice(0, -1) + op);
    } else {
      setExpression((prev) => prev + op);
    }
  };

  const handleClear = () => {
    setExpression("0");
    setHasEvaluated(false);
  };

  const handleBackspace = () => {
    if (expression.length <= 1 || hasEvaluated) {
      setExpression("0");
      setHasEvaluated(false);
    } else {
      setExpression((prev) => prev.slice(0, -1));
    }
  };

  const handleEvaluate = (): string => {
    try {
      const sanitized = expression.replace(/×/g, "*").replace(/÷/g, "/");
      if (!/^[0-9+\-*/.\s]+$/.test(sanitized)) {
        return expression;
      }
      const result = new Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        const formatted = Number.isInteger(result)
          ? result.toString()
          : result.toFixed(2).replace(/\.?0+$/, "");
        setExpression(formatted);
        setHasEvaluated(true);
        return formatted;
      }
    } catch {
      // If incomplete expression, leave as is
    }
    return expression;
  };

  const handleConfirm = () => {
    const finalVal = handleEvaluate();
    onApply(finalVal);
    if (onClose) onClose();
  };

  return (
    <div
      className="w-full max-w-xs rounded-2xl border border-border bg-surface p-3 shadow-xl transition-all dark:bg-dark-surface dark:border-dark-surface-raised"
      dir="ltr"
    >
      <div className="mb-2 flex items-center justify-between border-b border-border/50 pb-2 dark:border-dark-surface-raised">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted dark:text-dark-muted">
          <Calculator className="h-4 w-4 text-primary" />
          <span>حاسبة سريعة</span>
        </div>
        <div className="text-right text-lg font-bold tracking-tight text-ink dark:text-dark-ink">
          {expression}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={handleClear}
          className="flex h-10 items-center justify-center rounded-xl bg-danger-soft text-danger font-semibold transition hover:opacity-80 active:scale-95"
          title="مسح"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => handleOperator("/")}
          className="flex h-10 items-center justify-center rounded-xl bg-surface-subtle font-bold text-primary transition hover:bg-primary-soft active:scale-95 dark:bg-dark-surface-raised"
        >
          ÷
        </button>
        <button
          type="button"
          onClick={() => handleOperator("*")}
          className="flex h-10 items-center justify-center rounded-xl bg-surface-subtle font-bold text-primary transition hover:bg-primary-soft active:scale-95 dark:bg-dark-surface-raised"
        >
          ×
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="flex h-10 items-center justify-center rounded-xl bg-surface-subtle font-semibold text-muted transition hover:bg-surface-strong active:scale-95 dark:bg-dark-surface-raised dark:text-dark-muted"
          title="حذف"
        >
          <Delete className="h-4 w-4" />
        </button>

        {["7", "8", "9"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="flex h-10 items-center justify-center rounded-xl bg-surface font-semibold text-ink shadow-sm ring-1 ring-border/40 transition hover:bg-surface-subtle active:scale-95 dark:bg-dark-surface-raised dark:text-dark-ink dark:ring-0"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOperator("-")}
          className="flex h-10 items-center justify-center rounded-xl bg-surface-subtle font-bold text-primary transition hover:bg-primary-soft active:scale-95 dark:bg-dark-surface-raised"
        >
          -
        </button>

        {["4", "5", "6"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="flex h-10 items-center justify-center rounded-xl bg-surface font-semibold text-ink shadow-sm ring-1 ring-border/40 transition hover:bg-surface-subtle active:scale-95 dark:bg-dark-surface-raised dark:text-dark-ink dark:ring-0"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => handleOperator("+")}
          className="flex h-10 items-center justify-center rounded-xl bg-surface-subtle font-bold text-primary transition hover:bg-primary-soft active:scale-95 dark:bg-dark-surface-raised"
        >
          +
        </button>

        {["1", "2", "3"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="flex h-10 items-center justify-center rounded-xl bg-surface font-semibold text-ink shadow-sm ring-1 ring-border/40 transition hover:bg-surface-subtle active:scale-95 dark:bg-dark-surface-raised dark:text-dark-ink dark:ring-0"
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={handleEvaluate}
          className="flex h-10 items-center justify-center rounded-xl bg-primary-soft font-bold text-primary transition hover:bg-primary/20 active:scale-95"
        >
          =
        </button>

        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="col-span-2 flex h-10 items-center justify-center rounded-xl bg-surface font-semibold text-ink shadow-sm ring-1 ring-border/40 transition hover:bg-surface-subtle active:scale-95 dark:bg-dark-surface-raised dark:text-dark-ink dark:ring-0"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleDigit(".")}
          className="flex h-10 items-center justify-center rounded-xl bg-surface font-semibold text-ink shadow-sm ring-1 ring-border/40 transition hover:bg-surface-subtle active:scale-95 dark:bg-dark-surface-raised dark:text-dark-ink dark:ring-0"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className="flex h-10 items-center justify-center rounded-xl bg-primary font-bold text-white shadow-md transition hover:opacity-90 active:scale-95"
          title="تطبيق المبلغ"
        >
          <Check className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
