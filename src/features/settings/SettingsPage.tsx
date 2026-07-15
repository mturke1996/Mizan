import * as Switch from "@radix-ui/react-switch";
import {
  ArrowLeft,
  Bell,
  Building2,
  CircleHelp,
  Cloud,
  CreditCard,
  LogOut,
  Moon,
  Repeat,
  Shield,
  ShieldCheck,
  Tags,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/use-auth";
import { getAuthErrorMessage } from "@/features/auth/auth-messages";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

const settingsLinks = [
  {
    label: "بيانات المنشأة",
    detail: "الاسم والشعار والبيانات الظاهرة على الفواتير",
    to: "/settings/business",
    icon: Building2,
  },
  {
    label: "التصنيفات",
    detail: "إدارة تصنيفات الدخل والمصروفات للتقارير والميزانيات",
    to: "/settings/categories",
    icon: Tags,
  },
  {
    label: "الحركات المتكررة",
    detail: "جدولة الحركات الدورية وترحيلها تلقائيًا عند الاستحقاق",
    to: "/settings/recurring",
    icon: Repeat,
  },
  {
    label: "الإشعارات",
    detail: "مركز التنبيهات وإذن إشعارات الجهاز",
    to: "/settings/notifications",
    icon: Bell,
  },
  {
    label: "الفريق والتصدير",
    detail: "دعوة أعضاء وتنزيل CSV هادئ",
    to: "/settings/team-export",
    icon: WalletCards,
  },
  {
    label: "النسخ الاحتياطي والمزامنة",
    detail: "حالة الاتصال وتحديث البيانات الآمن",
    to: "/settings/sync",
    icon: Cloud,
  },
  {
    label: "الخصوصية والأمان",
    detail: "كلمة المرور وحالة الحساب والجلسة",
    to: "/settings/security",
    icon: ShieldCheck,
  },
  {
    label: "المساعدة",
    detail: "الأسئلة الشائعة والتواصل",
    to: "/settings/help",
    icon: CircleHelp,
  },
];

function getInitial(name: string): string {
  return name.trim().charAt(0) || "م";
}

export function SettingsPage() {
  const { profile, user, signOut } = useAuth();
  const { membership, currency } = useWorkspace();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.dataset.theme === "dark",
  );

  const displayName =
    profile?.display_name?.trim() ||
    (user?.user_metadata?.display_name as string | undefined)?.trim() ||
    "مستخدم ميزان";
  const email = user?.email ?? "—";
  const currencyLabel =
    currency === "LYD" ? "الدينار الليبي (LYD)" : currency;

  useEffect(() => {
    if (darkMode) {
      document.documentElement.dataset.theme = "dark";
      localStorage.setItem("mizan-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("mizan-theme", "light");
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", darkMode ? "#10111A" : "#F7F8FC");
  }, [darkMode]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      navigate("/auth/login", { replace: true });
    } catch (caught) {
      toast.error(
        getAuthErrorMessage(
          caught instanceof Error
            ? { message: caught.message }
            : { message: String(caught) },
        ),
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="الإعدادات"
        subtitle="حسابك، تفضيلاتك، واشتراكك."
        backTo="/"
      />

      <AppCard className="mb-5 flex items-center gap-4 p-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
          {getInitial(displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-ink">{displayName}</p>
          <p className="mt-1 truncate text-xs text-muted">{email}</p>
        </div>
        <Link
          to="/settings/profile"
          className="pressable flex min-h-11 items-center rounded-sm px-3 text-sm font-bold text-primary hover:bg-primary-soft"
        >
          تعديل
        </Link>
      </AppCard>

      {profile?.system_role === "supervisor" ? (
        <Link to="/supervisor" className="mb-5 block">
          <AppCard className="pressable overflow-hidden border-primary/20 bg-primary-soft p-4 hover:border-primary">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-sm bg-primary text-primary-on">
                <Shield aria-hidden="true" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">لوحة تحكم المدير</p>
                <p className="mt-1 text-xs text-muted">
                  /supervisor — مدفوعات، مساحات، مستخدمون، وسجل كامل
                </p>
              </div>
              <ArrowLeft aria-hidden="true" size={18} className="text-primary" />
            </div>
          </AppCard>
        </Link>
      ) : null}

      <section aria-labelledby="subscription-title" className="mb-6">
        <h2 id="subscription-title" className="mb-3 text-sm font-bold text-ink">
          الاشتراك
        </h2>
        <AppCard className="overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-warning-soft text-warning">
              <CreditCard aria-hidden="true" size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-ink">الاشتراك والفوترة</p>
              </div>
              <p className="mt-1 text-xs text-muted">
                عرض الحالة الفعلية، الخطط، وطلبات إثبات الدفع
              </p>
            </div>
          </div>
          <Link
            to="/settings/subscription"
            className="pressable flex min-h-12 items-center justify-between border-t border-line px-4 text-sm font-bold text-primary hover:bg-primary-soft"
          >
            إدارة الاشتراك
            <ArrowLeft aria-hidden="true" size={17} />
          </Link>
        </AppCard>
      </section>

      <section aria-labelledby="preferences-title" className="mb-6">
        <h2 id="preferences-title" className="mb-3 text-sm font-bold text-ink">
          التفضيلات
        </h2>
        <AppCard className="divide-y divide-line overflow-hidden">
          <div className="flex min-h-16 items-center gap-3 px-4 py-3">
            <span className="flex size-10 items-center justify-center rounded-sm bg-surface-subtle text-muted">
              <Moon aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">الوضع الداكن</p>
              <p className="mt-0.5 text-xs text-muted">مظهر مريح في الإضاءة المنخفضة</p>
            </div>
            <Switch.Root
              checked={darkMode}
              onCheckedChange={setDarkMode}
              aria-label="استخدام الوضع الداكن"
              className="relative h-7 w-12 rounded-full bg-surface-strong transition-colors data-[state=checked]:bg-primary"
            >
              <Switch.Thumb className="block size-5 translate-x-[-4px] rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[-24px]" />
            </Switch.Root>
          </div>

          <Link
            to="/settings/currency"
            className="pressable flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
          >
            <span className="flex size-10 items-center justify-center rounded-sm bg-surface-subtle text-muted">
              <WalletCards aria-hidden="true" size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">العملة الأساسية</p>
              <p className="mt-0.5 text-xs text-muted">
                {membership?.workspaceName
                  ? `${membership.workspaceName} • ${currencyLabel}`
                  : currencyLabel}
              </p>
            </div>
            <ArrowLeft aria-hidden="true" size={17} className="text-soft" />
          </Link>
        </AppCard>
      </section>

      <section aria-labelledby="general-settings-title" className="mb-6">
        <h2
          id="general-settings-title"
          className="mb-3 text-sm font-bold text-ink"
        >
          عام
        </h2>
        <AppCard className="divide-y divide-line overflow-hidden">
          {settingsLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="pressable flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
              >
                <span className="flex size-10 items-center justify-center rounded-sm bg-surface-subtle text-muted">
                  <Icon aria-hidden="true" size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {item.detail}
                  </span>
                </span>
                <ArrowLeft aria-hidden="true" size={17} className="text-soft" />
              </Link>
            );
          })}
        </AppCard>
      </section>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={signingOut}
        className="pressable mb-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-danger/20 bg-danger-soft font-bold text-danger disabled:opacity-60"
      >
        <LogOut aria-hidden="true" size={18} />
        {signingOut ? "جاري الخروج…" : "تسجيل الخروج"}
      </button>
    </div>
  );
}
