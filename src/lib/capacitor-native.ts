/** Native Capacitor hooks — no-op on web. */
export async function initCapacitorNative(): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#F7F8FC" });
    await SplashScreen.hide({ fadeOutDuration: 300 });
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
