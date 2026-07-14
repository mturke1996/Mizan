import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "mizan-pwa-install-dismissed";

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label="تثبيت ميزان"
      className="fixed inset-x-0 bottom-[calc(4.5rem+var(--safe-bottom))] z-50 mx-auto w-[min(28rem,calc(100%-1.5rem))] rounded-2xl border border-line bg-surface p-4 shadow-[0_16px_40px_rgb(27_30_60/14%)] lg:bottom-6"
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
          <Download aria-hidden="true" size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink">ثبّت ميزان على جهازك</p>
          <p className="mt-1 text-xs leading-5 text-muted">
            يُحمّل التطبيق للعمل بسرعة وسلاسة حتى عند ضعف الاتصال.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="pressable min-h-10 flex-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setVisible(false);
                setDeferred(null);
              }}
            >
              تثبيت
            </button>
            <button
              type="button"
              className="pressable min-h-10 rounded-xl bg-surface-subtle px-3 text-xs font-semibold text-muted"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, "1");
                setVisible(false);
              }}
            >
              لاحقًا
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="إغلاق"
          className="pressable grid size-8 place-items-center rounded-full text-muted hover:bg-surface-subtle"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
