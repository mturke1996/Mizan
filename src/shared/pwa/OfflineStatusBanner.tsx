import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Banner only when the device is actually offline — avoid cold-start cache flash. */
export function OfflineStatusBanner() {
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

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-30 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-center text-xs font-semibold text-ink"
      dir="rtl"
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff aria-hidden="true" size={14} strokeWidth={2} />
        أنت دون اتصال — تُعرض آخر بيانات محفوظة على الجهاز
      </span>
    </div>
  );
}
