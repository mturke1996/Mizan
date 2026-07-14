import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useWorkspace } from "@/features/workspace/use-workspace";

/** Subtle banner when the PWA is offline or serving cached workspace data. */
export function OfflineStatusBanner() {
  const { isOfflineCache = false } = useWorkspace();
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Prefer the hard offline signal; only show cache hint while online sync is pending.
  if (!offline && !isOfflineCache) return null;

  const message = offline
    ? "وضع دون اتصال — تُعرض آخر بيانات محفوظة على الجهاز"
    : "بيانات محفوظة محليًا — جاري المزامنة عند توفر الشبكة";

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-[11px] font-semibold text-ink"
      dir="rtl"
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff aria-hidden="true" size={13} strokeWidth={2} />
        {message}
      </span>
    </div>
  );
}
