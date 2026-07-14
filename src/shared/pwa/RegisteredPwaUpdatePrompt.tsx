import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { PwaInstallPrompt } from "./PwaInstallPrompt";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";

async function unregisterDevelopmentServiceWorkers() {
  if (!import.meta.env.DEV || !("serviceWorker" in navigator)) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in globalThis) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }
}

/** Prefetch critical money routes so the first real tap feels instant. */
function warmCriticalRoutes() {
  if (import.meta.env.DEV) return;
  void Promise.allSettled([
    import("@/features/debts/DebtsPage"),
    import("@/features/income/IncomePage"),
    import("@/features/invoices/InvoicesPage"),
    import("@/features/transactions/TransactionsPage"),
    import("@/features/wallets/WalletsPage"),
  ]);
}

export function RegisteredPwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: !import.meta.env.DEV,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        warmCriticalRoutes();
      }
    },
  });

  useEffect(() => {
    void unregisterDevelopmentServiceWorkers();
    if (!import.meta.env.DEV) {
      warmCriticalRoutes();
    }
  }, []);

  if (import.meta.env.DEV) {
    return null;
  }

  return (
    <>
      <PwaInstallPrompt />
      <PwaUpdatePrompt
        needRefresh={needRefresh}
        onDismiss={() => setNeedRefresh(false)}
        onUpdate={() => void updateServiceWorker(true)}
      />
    </>
  );
}
