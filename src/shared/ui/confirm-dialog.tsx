import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, HelpCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual tone of the confirm button. Defaults to "primary". */
  tone?: "primary" | "danger" | "warning";
  /** Show a warning callout above the actions. Use for destructive ops. */
  warning?: string;
}

interface ConfirmContextValue {
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const toneButtonClass: Record<NonNullable<ConfirmOptions["tone"]>, string> = {
  primary: "bg-primary text-primary-on hover:bg-primary-hover",
  danger: "bg-danger text-danger-on hover:opacity-90",
  warning: "bg-warning text-warning-on hover:opacity-90",
};

const toneIconClass: Record<NonNullable<ConfirmOptions["tone"]>, string> = {
  primary: "text-primary",
  danger: "text-danger",
  warning: "text-warning",
};

/**
 * Promise-based replacement for `window.confirm`.
 *
 * ```tsx
 * const confirm = useConfirm();
 * if (!(await confirm({ title: "حذف الفاتورة؟", tone: "danger" }))) return;
 * ```
 */
export function useConfirm(): ConfirmContextValue["confirm"] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmDialogProvider>");
  }
  return ctx.confirm;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const idCounter = useRef(0);

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      idCounter.current += 1;
      return new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      });
    },
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      setPending((current) => {
        current?.resolve(ok);
        return null;
      });
    },
    [],
  );

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  const tone = pending?.tone ?? "primary";
  const confirmLabel = pending?.confirmLabel ?? "تأكيد";
  const cancelLabel = pending?.cancelLabel ?? "إلغاء";
  const Icon = tone === "primary" ? HelpCircle : AlertTriangle;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content
            aria-describedby={pending?.description ? "confirm-description" : undefined}
            aria-labelledby="confirm-title"
            className="fixed inset-x-4 top-[12%] z-50 mx-auto w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-[0_20px_60px_rgb(27_30_60/18%)] sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2"
          >
            <div className="flex items-start gap-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-full bg-surface-subtle ${toneIconClass[tone]}`}
              >
                <Icon aria-hidden="true" size={20} />
              </span>
              <div className="min-w-0">
                <Dialog.Title
                  className="text-base font-bold text-ink"
                  id="confirm-title"
                >
                  {pending?.title}
                </Dialog.Title>
                {pending?.description ? (
                  <Dialog.Description
                    className="mt-1.5 text-sm leading-6 text-muted"
                    id="confirm-description"
                  >
                    {pending.description}
                  </Dialog.Description>
                ) : null}
              </div>
            </div>

            {pending?.warning ? (
              <p
                className="mt-4 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs font-semibold text-warning"
                role="status"
              >
                {pending.warning}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  className="pressable inline-flex min-h-11 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink"
                  type="button"
                  onClick={() => close(false)}
                >
                  {cancelLabel}
                </button>
              </Dialog.Close>
              <button
                className={`pressable inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold ${toneButtonClass[tone]}`}
                type="button"
                onClick={() => close(true)}
              >
                {confirmLabel}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}
