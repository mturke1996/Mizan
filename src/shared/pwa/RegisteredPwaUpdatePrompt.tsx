import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
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

export function RegisteredPwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: !import.meta.env.DEV,
  });

  useEffect(() => {
    void unregisterDevelopmentServiceWorkers();
  }, []);

  if (import.meta.env.DEV) {
    return null;
  }

  return (
    <PwaUpdatePrompt
      needRefresh={needRefresh}
      onDismiss={() => setNeedRefresh(false)}
      onUpdate={() => void updateServiceWorker(true)}
    />
  );
}
