import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export interface AppSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Wider sheet for dense content like ledgers */
  size?: "md" | "lg";
}

/**
 * Mobile: bottom sheet. Desktop: centered dialog.
 * Always portaled — avoids “stuck mid-page” when parents use transforms.
 */
export function AppSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: AppSheetProps) {
  const widthClass = size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={description ? "app-sheet-description" : undefined}
          className={[
            "fixed z-50 flex flex-col outline-none",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 max-h-[92dvh]",
            "rounded-t-[28px] border border-line bg-surface",
            "shadow-[0_-16px_48px_rgb(27_30_60/18%)]",
            "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "duration-200",
            // Desktop: true viewport center via portal + translate
            "sm:inset-x-auto sm:inset-y-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto",
            "sm:w-[min(calc(100vw-2rem),42rem)] sm:-translate-x-1/2 sm:-translate-y-1/2",
            "sm:max-h-[min(88dvh,720px)] sm:rounded-[24px]",
            "sm:shadow-[0_24px_64px_rgb(27_30_60/22%)]",
            "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            widthClass,
          ].join(" ")}
        >
          <div className="mx-auto mt-2 h-1.5 w-11 shrink-0 rounded-full bg-line-strong sm:hidden" />

          <div className="flex items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-3 sm:pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold tracking-tight text-ink">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description
                  id="app-sheet-description"
                  className="mt-0.5 text-xs leading-5 text-muted"
                >
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="إغلاق"
                data-overlay-close
                className="pressable grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:bg-surface-subtle hover:text-ink"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 subtle-scrollbar">
            {children}
          </div>

          {footer ? (
            <div className="shrink-0 border-t border-line bg-surface px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
