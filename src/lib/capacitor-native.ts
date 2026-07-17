import { SystemBars, SystemBarsStyle } from "@capacitor/core";

/** Native Capacitor hooks — no-op on web. */
export async function initCapacitorNative(): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  try {
    document.documentElement.classList.add("is-native-app");

    // Capacitor 8 SystemBars: edge-to-edge + --safe-area-inset-* CSS injection.
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });

    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      // Style.Light = dark icons on light backgrounds (aligned with SystemBars).
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: "#F7F8FC" });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // Optional on some platforms / older WebViews.
    }

    try {
      const { initDeviceNotifications } = await import(
        "@/lib/local-notifications"
      );
      await initDeviceNotifications();
    } catch {
      // Local notifications optional until first login sync.
    }

    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 280 });
  } catch {
    // Plugins optional during dev / web builds.
  }
}

export async function hapticSuccess(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Web fallback — silent.
  }
}

export async function hapticWarning(): Promise<void> {
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // Web fallback.
  }
}
