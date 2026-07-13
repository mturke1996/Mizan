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
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#F7F8FC",
      overlaysWebView: false,
    },
  },
};

export default config;
