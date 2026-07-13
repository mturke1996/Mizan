import { LogOut, RefreshCw, ShieldX } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./use-auth";

export function RequireAuth() {
  const { session, profile, isLoading, refreshProfile, signOut } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center bg-canvas px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 size-10 animate-pulse rounded-full bg-primary-soft" />
          <p className="text-sm font-medium text-muted">جاري تحميل حسابك…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
    );
  }

  if (!profile) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center bg-canvas px-6">
        <section className="w-full max-w-md rounded-md border border-line bg-surface p-6 text-center [box-shadow:var(--shadow-card)]">
          <RefreshCw
            className="mx-auto mb-4 size-9 text-warning"
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold text-ink">تعذر تحميل ملف الحساب</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            لم نتمكن من التحقق من حالة الحساب. أعد المحاولة قبل متابعة العمل.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void refreshProfile().catch(() => undefined)}
              className="pressable min-h-11 rounded-sm bg-primary px-4 font-bold text-primary-on"
            >
              إعادة المحاولة
            </button>
            <button
              type="button"
              onClick={() => void signOut().catch(() => undefined)}
              className="pressable min-h-11 rounded-sm bg-surface-subtle px-4 font-bold text-ink"
            >
              تسجيل الخروج
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (profile.account_status !== "active") {
    const isSuspended = profile.account_status === "suspended";
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center bg-canvas px-6">
        <section className="w-full max-w-md rounded-md border border-line bg-surface p-6 text-center [box-shadow:var(--shadow-card)]">
          <ShieldX
            className="mx-auto mb-4 size-10 text-danger"
            aria-hidden="true"
          />
          <h1 className="text-xl font-bold text-ink">
            {isSuspended ? "الحساب موقوف مؤقتًا" : "الحساب معطّل"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            {isSuspended
              ? "أوقف المشرف الوصول إلى هذا الحساب مؤقتًا. راجع الدعم لاستعادة الوصول."
              : "لا يمكن استخدام هذا الحساب حاليًا. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ."}
          </p>
          <button
            type="button"
            onClick={() => void signOut().catch(() => undefined)}
            className="pressable mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-surface-subtle px-5 font-bold text-ink"
          >
            <LogOut className="size-4" aria-hidden="true" />
            تسجيل الخروج
          </button>
        </section>
      </main>
    );
  }

  if (
    profile.must_change_password &&
    location.pathname !== "/auth/update-password"
  ) {
    return <Navigate to="/auth/update-password?required=1" replace />;
  }

  return <Outlet />;
}
