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

    // Edge-to-edge + CSS --safe-area-inset-* for padding in the app shell.
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });

    try {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: "#F7F8FC" });
      // Must overlay so inset CSS vars are meaningful on Android 15+.
      // Content clears the status/nav bars via .app-shell-safe / .app-bottom-nav.
      await StatusBar.setOverlaysWebView({ overlay: true });
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

    // Wait one frame so the first paint exists, then fade splash.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 320 });
  } catch {
    // Plugins optional during dev / web builds — still try to hide splash.
    try {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide({ fadeOutDuration: 200 });
    } catch {
      // ignore
    }
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
