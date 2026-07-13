import { useEffect, useRef } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";
import { SupervisorNav } from "./SupervisorNav";

export function SupervisorShell() {
  const { profile, isLoading } = useAuth();
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

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-5xl items-center justify-center bg-canvas px-4">
        <p className="text-sm text-muted">جارٍ التحقق من الصلاحيات...</p>
      </div>
    );
  }

  if (profile?.system_role !== "supervisor") {
    return <Navigate to="/" replace />;
  }

  const pageMeta =
    [
      {
        path: "/supervisor/payments",
        title: "المدفوعات",
        subtitle: "مراجعة الطلبات وتوثيق القرار",
      },
      {
        path: "/supervisor/plans",
        title: "الخطط",
        subtitle: "أسعار ودورات ومزايا الاشتراك",
      },
      {
        path: "/supervisor/revenue",
        title: "الإيرادات",
        subtitle: "مدفوعات معتمدة حسب العملة",
      },
      {
        path: "/supervisor/messages",
        title: "الرسائل",
        subtitle: "حملات الإشعار والتواصل داخل التطبيق",
      },
      {
        path: "/supervisor/customers",
        title: "العملاء",
        subtitle: "الحسابات والمساحات والاشتراكات",
      },
      {
        path: "/supervisor/subscriptions",
        title: "الاشتراكات",
        subtitle: "التجديد وتغيير الحالة والجدولة",
      },
      {
        path: "/supervisor/workspaces",
        title: "مساحات العمل",
        subtitle: "الاشتراكات والتجارب والحالة التشغيلية",
      },
      {
        path: "/supervisor/audit",
        title: "سجل التدقيق",
        subtitle: "أثر القرارات والوصول الحساس",
      },
      {
        path: "/supervisor/activity",
        title: "سجل التدقيق",
        subtitle: "أثر القرارات والوصول الحساس",
      },
    ].find((item) => location.pathname.startsWith(item.path)) ?? {
      title: "مركز العمليات",
      subtitle: "طابور القرارات ومؤشرات التشغيل الحقيقية",
    };

  return (
    <div
      dir="ltr"
      className="min-h-dvh w-full bg-canvas lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]"
    >
      <a
        href="#supervisor-main"
        className="fixed top-2 right-2 z-50 -translate-y-24 rounded-sm bg-primary px-4 py-3 font-semibold text-primary-on transition-transform focus:translate-y-0"
      >
        انتقل إلى المحتوى
      </a>
      <SupervisorNav />
      <div dir="rtl" className="min-w-0">
        <header className="hidden min-h-[76px] items-center justify-between border-b border-line bg-surface px-8 lg:flex xl:px-10">
          <div>
            <p className="text-lg font-bold tracking-tight text-ink">
              {pageMeta.title}
            </p>
            <p className="mt-0.5 text-xs text-muted">{pageMeta.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/supervisor/payments"
              className="pressable inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-primary px-3.5 text-xs font-bold text-primary-on hover:bg-primary-hover"
            >
              <CreditCard aria-hidden="true" size={15} />
              مراجعة المدفوعات
            </Link>
            <span className="grid size-10 place-items-center rounded-[10px] border border-line bg-canvas text-primary">
              <ShieldCheck aria-hidden="true" size={18} />
            </span>
          </div>
        </header>
        <main
          ref={mainRef}
          id="supervisor-main"
          className="page-enter mx-auto w-full max-w-384 px-4 pb-8 sm:px-6 lg:px-8 xl:px-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
