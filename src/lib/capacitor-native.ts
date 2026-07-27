import { SystemBars, SystemBarsStyle } from "@capacitor/core";

export async function updateNativeSystemBars(isDark: boolean): Promise<void> {
  try {
    await SystemBars.setStyle({
      style: isDark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    });
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({
      style: isDark ? Style.Dark : Style.Light,
    });
    await StatusBar.setBackgroundColor({
      color: isDark ? "#10111A" : "#F7F8FC",
    });
    // Keep overlay for Android 15 edge-to-edge; CSS --safe-top floors the inset.
    await StatusBar.setOverlaysWebView({ overlay: true });
    try {
      await StatusBar.show();
    } catch {
      // Some OEMs disallow explicit show — ignore.
    }
  } catch {
    // Optional on web or unsupported webviews
  }
}

/** Native Capacitor hooks — no-op on web. */
export async function initCapacitorNative(): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = (
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  try {
    document.documentElement.classList.add("is-native-app");

    const isDark = document.documentElement.dataset.theme === "dark";
    await updateNativeSystemBars(isDark);

    // Watch for dynamic theme changes and sync native status/system bars
    const observer = new MutationObserver(() => {
      const darkNow = document.documentElement.dataset.theme === "dark";
      void updateNativeSystemBars(darkNow);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

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

export async function hapticSelection(): Promise<void> {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Web fallback — silent.
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
