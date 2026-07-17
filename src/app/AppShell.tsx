import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNavigation } from "@/shared/navigation/BottomNavigation";
import { DesktopSidebar } from "@/shared/navigation/DesktopSidebar";
import { OfflineStatusBanner } from "@/shared/pwa/OfflineStatusBanner";

export function AppShell() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;

    const heading = mainRef.current?.querySelector<HTMLElement>("h1");

    if (!heading) return;

    heading.tabIndex = -1;
    heading.focus();
  }, [location.pathname]);

  return (
    <div
      dir="ltr"
      className="min-h-dvh w-full bg-canvas md:grid md:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[15.5rem_minmax(0,1fr)]"
    >
      <a
        href="#main-content"
        className="fixed top-2 right-2 z-50 -translate-y-24 rounded-sm bg-primary px-4 py-3 font-semibold text-primary-on transition-transform focus:translate-y-0"
      >
        انتقل إلى المحتوى
      </a>
      <DesktopSidebar />
      <div
        dir="rtl"
        className="app-shell-safe min-w-0 bg-surface md:bg-canvas md:pt-0 md:ps-0 md:pe-0"
      >
        <OfflineStatusBanner />
        <main
          ref={mainRef}
          id="main-content"
          className="app-scroll-padding mx-auto min-h-dvh w-full max-w-384"
        >
          <Outlet />
        </main>
      </div>
      <BottomNavigation />
    </div>
  );
}
