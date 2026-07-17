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
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#F7F8FC",
      showSpinner: false,
    },
    /**
     * Modern Android (15+) is edge-to-edge. SystemBars injects
     * --safe-area-inset-* CSS variables used by the app shell.
     */
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F7F8FC",
      overlaysWebView: false,
    },
    LocalNotifications: {
      iconColor: "#4338CA",
    },
  },
};

export default config;
