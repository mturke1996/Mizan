import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useId, useState } from "react";
import {
  formatMinorAmount,
  getCurrencyScale,
  parseMajorAmount,
} from "@/domain/money/money";

interface GoalEditorDialogProps {
  open: boolean;
  currency: string;
  currentGoalMinor: bigint | null;
  onOpenChange(open: boolean): void;
  onSave(goalMinor: bigint): void;
}

export function GoalEditorDialog({
  open,
  currency,
  currentGoalMinor,
  onOpenChange,
  onSave,
}: GoalEditorDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(
      currentGoalMinor
        ? formatMinorAmount(currentGoalMinor, { currency, locale: "en-US" })
        : "",
    );
  }, [open, currentGoalMinor, currency]);

  function handleSave() {
    try {
      const minor = parseMajorAmount(value, getCurrencyScale(currency));
      if (minor <= 0n) return;
      onSave(minor);
      onOpenChange(false);
    } catch {
      // Parent shows toast on invalid parse via onSave wrapper if needed.
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-labelledby={titleId}
          className="fixed inset-x-4 top-[15%] z-50 mx-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[0_20px_60px_rgb(27_30_60/18%)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2"
        >
          <Dialog.Title className="text-base font-bold text-ink" id={titleId}>
            هدف الدخل الشهري
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted">
            أدخل المبلغ بالوحدة الرئيسية ({currency})
          </Dialog.Description>
          <label className="mt-4 block">
            <span className="sr-only">المبلغ</span>
            <input
              id={inputId}
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="w-full rounded-xl border border-line bg-surface-subtle px-3 py-2.5 text-sm text-ink"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
            />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <button
                type="button"
                className="pressable min-h-11 rounded-xl border border-line px-4 text-sm font-bold text-ink"
              >
                إلغاء
              </button>
            </Dialog.Close>
            <button
              type="button"
              className="pressable min-h-11 rounded-xl bg-primary px-4 text-sm font-bold text-primary-on"
              onClick={handleSave}
            >
              حفظ
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
