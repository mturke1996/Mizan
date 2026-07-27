import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

function dismissTopOverlay(): boolean {
  const openOverlay = document.querySelector<HTMLElement>(
    '[role="dialog"][data-state="open"], [aria-modal="true"]:not([hidden])',
  );
  if (!openOverlay) return false;

  const closeControl = openOverlay.querySelector<HTMLElement>(
    '[data-overlay-close], [aria-label="إغلاق"], [aria-label="اغلاق"], button[aria-label*="إغلاق"], button[aria-label*="اغلاق"]',
  );
  if (closeControl) {
    closeControl.click();
    return true;
  }

  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
    }),
  );
  return true;
}

/**
 * Android hardware/gesture back: close overlays first, then pop history, else minimize.
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
        if (dismissTopOverlay()) return;
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
