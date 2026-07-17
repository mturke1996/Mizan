import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export interface SupervisorActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "warning" | "danger";
  isPending: boolean;
  noteRequired?: boolean;
  onOpenChange(open: boolean): void;
  onConfirm(note: string): void;
  children?: ReactNode;
}

const toneButtonClass: Record<
  NonNullable<SupervisorActionDialogProps["tone"]>,
  string
> = {
  primary: "bg-primary text-primary-on hover:bg-primary-hover",
  warning: "bg-warning text-warning-on hover:opacity-90",
  danger: "bg-danger text-danger-on hover:opacity-90",
};

export function SupervisorActionDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = "primary",
  isPending,
  noteRequired = true,
  onOpenChange,
  onConfirm,
  children,
}: SupervisorActionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmedNote = note.trim();
  const noteValid = !noteRequired || trimmedNote.length >= 3;
  const showNoteError = noteRequired && touched && !noteValid;

  function handleOpenChange(next: boolean) {
    if (!next && isPending) return;
    if (!next) {
      setNote("");
      setTouched(false);
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    setTouched(true);
    if (!noteValid || isPending) return;
    onConfirm(trimmedNote);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className="fixed inset-x-4 top-[max(1rem,var(--safe-top))] z-50 mx-auto max-h-[min(80vh,calc(100dvh-2rem-var(--safe-top)-var(--safe-bottom)))] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-surface p-5 pb-[max(1.25rem,var(--safe-bottom))] shadow-[0_20px_60px_rgb(27_30_60/18%)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2"
          onEscapeKeyDown={(event) => {
            if (isPending) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isPending) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title
                className="text-lg font-bold text-ink"
                id={titleId}
              >
                {title}
              </Dialog.Title>
              <Dialog.Description
                className="mt-1 text-sm text-muted"
                id={descriptionId}
              >
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="إغلاق"
                className="pressable grid size-11 shrink-0 place-items-center rounded-sm border border-line bg-surface text-muted hover:bg-surface-subtle hover:text-ink disabled:opacity-50"
                disabled={isPending}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </Dialog.Close>
          </div>

          {tone === "danger" ? (
            <p
              className="mt-4 rounded-md border border-danger/20 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger"
              role="status"
            >
              تحذير: هذا إجراء حسّاس وقد يؤثر على وصول العميل فورًا.
            </p>
          ) : null}

          {children ? <div className="mt-4 space-y-3">{children}</div> : null}

          {noteRequired ? (
            <div className="mt-4">
              <label
                className="mb-1.5 block text-sm font-bold text-ink"
                htmlFor={noteId}
              >
                ملاحظة المدير
              </label>
              <textarea
                className="min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
                disabled={isPending}
                id={noteId}
                onBlur={() => setTouched(true)}
                onChange={(event) => setNote(event.target.value)}
                placeholder="اكتب سبب الإجراء (3 أحرف على الأقل)"
                value={note}
              />
              {showNoteError ? (
                <p className="mt-1.5 text-xs font-semibold text-danger" role="alert">
                  الملاحظة مطلوبة وبحد أدنى 3 أحرف
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <button
                className="pressable inline-flex min-h-11 items-center justify-center rounded-sm border border-line-strong bg-surface px-4 text-sm font-bold text-ink disabled:opacity-50"
                disabled={isPending}
                type="button"
              >
                إلغاء
              </button>
            </Dialog.Close>
            <button
              className={`pressable inline-flex min-h-11 items-center justify-center rounded-sm px-4 text-sm font-bold disabled:opacity-50 ${toneButtonClass[tone]}`}
              disabled={isPending}
              onClick={handleConfirm}
              type="button"
            >
              {isPending ? "جارٍ التنفيذ…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
