import type { CapacitorConfig } from "@capacitor/cli";
import type {} from "@capacitor/splash-screen";
import type {} from "@capacitor/status-bar";

const config: CapacitorConfig = {
  appId: "com.mizan.finance",
  appName: "ميزان",
  webDir: "dist",
  backgroundColor: "#F7F8FC",
  android: {
    allowMixedContent: false,
    backgroundColor: "#F7F8FC",
  },
  plugins: {
    /**
     * Keep splash until JS is ready (capacitor-best-practices).
     * Hide from initCapacitorNative after SystemBars + first paint.
     */
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#F7F8FC",
      showSpinner: false,
    },
    /**
     * Capacitor 8 SystemBars: edge-to-edge + inject --safe-area-inset-*.
     * App shell uses those vars for padding.
     */
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F7F8FC",
      // Overlay + CSS safe-area insets (required on Android 15 edge-to-edge).
      overlaysWebView: true,
    },
    LocalNotifications: {
      iconColor: "#4338CA",
    },
  },
};

export default config;
