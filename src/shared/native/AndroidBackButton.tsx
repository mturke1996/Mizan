import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

/**
 * Android hardware/gesture back: pop in-app history first, exit only at root.
 */
export function AndroidBackButton() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      return;
    }

    let remove: (() => void) | undefined;
    void import("@capacitor/app").then(({ App }) => {
      const sub = App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          navigate(-1);
          return;
        }
        void App.minimizeApp();
      });
      void sub.then((handle) => {
        remove = () => {
          void handle.remove();
        };
      });
    });

    return () => remove?.();
  }, [navigate]);

  return null;
}
