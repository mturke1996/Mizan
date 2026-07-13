import { RefreshCw, X } from "lucide-react";

interface PwaUpdatePromptProps {
  needRefresh: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
}

export function PwaUpdatePrompt({
  needRefresh,
  onUpdate,
  onDismiss,
}: PwaUpdatePromptProps) {
  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-[calc(88px+var(--safe-bottom))] left-4 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-md border border-line-strong bg-surface p-3 [box-shadow:var(--shadow-float)]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
        <RefreshCw aria-hidden="true" size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">يتوفر تحديث جديد لميزان</p>
        <button
          type="button"
          onClick={onUpdate}
          className="pressable mt-1 min-h-11 rounded-sm text-sm font-semibold text-primary hover:text-primary-hover"
        >
          تحديث التطبيق الآن
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="تذكيري لاحقًا"
        className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-subtle hover:text-ink"
      >
        <X aria-hidden="true" size={19} />
      </button>
    </div>
  );
}
