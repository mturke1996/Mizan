import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Cloud,
  CloudOff,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
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

import {
  ensureNotificationPermission,
  scheduleMotivationalNotifications,
} from "@/lib/local-notifications";
import { MOTIVATIONAL_NOTIFICATIONS } from "@/lib/motivational-notifications";
import { Capacitor } from "@capacitor/core";

type DevicePermission = NotificationPermission | "unsupported" | "checking";

function notificationPermission(): DevicePermission {
  if (Capacitor.isNativePlatform()) return "default";
  return "Notification" in window ? Notification.permission : "unsupported";
}

export function NotificationSettingsPage() {
  const [permission, setPermission] = useState<DevicePermission>(
    notificationPermission,
  );
  const [requesting, setRequesting] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  async function requestPermission() {
    setRequesting(true);
    try {
      const granted = await ensureNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      if (granted && Capacitor.isNativePlatform()) {
        await scheduleMotivationalNotifications();
      }
    } finally {
      setRequesting(false);
    }
  }

  async function rescheduleMotivational() {
    setScheduling(true);
    try {
      const granted = await ensureNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      if (!granted) {
        toast.error("فعّل إذن الإشعارات أولًا");
        return;
      }
      await scheduleMotivationalNotifications();
      toast.success("تم جدولة الإشعارات التحفيزية اليومية");
    } finally {
      setScheduling(false);
    }
  }

  const permissionCopy = {
    checking: "جارٍ التحقق من إذن الجهاز…",
    default: "لم يُحسم إذن إشعارات الجهاز بعد.",
    granted: Capacitor.isNativePlatform()
      ? "إشعارات الجهاز مفعّلة — تصل حتى والتطبيق مقفل."
      : "إشعارات الجهاز مسموحة في هذا المتصفح.",
    denied: Capacitor.isNativePlatform()
      ? "الإشعارات محظورة من إعدادات التطبيق على الجهاز."
      : "الإشعارات محظورة من إعدادات المتصفح.",
    unsupported: "هذا المتصفح لا يدعم إشعارات الجهاز.",
  }[permission];

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="الإشعارات"
        subtitle="تنبيهات الحساب والإشارات التحفيزية على الجهاز."
        backTo="/settings"
      />

      <AppCard className="mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
            <Bell aria-hidden="true" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-ink">مركز إشعارات ميزان</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              صندوق داخل التطبيق دائمًا، وعلى أندرويد تُعرض إشارات الإدارة
              والتحفيز كتبيهات جهاز.
            </p>
            <Link
              to="/notifications"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary"
            >
              فتح مركز الإشعارات
            </Link>
          </div>
        </div>
      </AppCard>

      <AppCard className="mb-4 p-4 sm:p-5">
        <h2 className="font-bold text-ink">إذن الجهاز</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{permissionCopy}</p>
        {permission === "default" || permission === "checking" ? (
          <button
            type="button"
            disabled={requesting}
            onClick={() => void requestPermission()}
            className="pressable mt-4 min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:opacity-60"
          >
            {requesting ? "جاري الطلب…" : "السماح بالإشعارات"}
          </button>
        ) : null}
        {permission === "denied" ? (
          <p className="mt-3 rounded-sm bg-warning-soft p-3 text-xs leading-5 text-warning">
            افتح إعدادات التطبيق على الهاتف وفعّل الإشعارات يدويًا.
          </p>
        ) : null}
        {permission === "granted" ? (
          <button
            type="button"
            disabled={scheduling}
            onClick={() => void rescheduleMotivational()}
            className="pressable mt-4 min-h-11 rounded-xl border border-line bg-surface-subtle px-4 text-sm font-bold text-ink disabled:opacity-60"
          >
            {scheduling ? "جاري الجدولة…" : "إعادة جدولة التحفيز اليومي"}
          </button>
        ) : null}
      </AppCard>

      <AppCard className="p-4 sm:p-5">
        <h2 className="font-bold text-ink">الإشعارات التحفيزية اليومية</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          ثلاث رسائل عامة تُجدول على الجهاز وتظهر حتى والتطبيق مقفل.
        </p>
        <ul className="mt-4 space-y-2">
          {MOTIVATIONAL_NOTIFICATIONS.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-line bg-canvas/70 px-3.5 py-3"
            >
              <p className="text-xs font-bold text-ink">
                {item.title}
                <span className="ms-2 font-semibold text-muted">
                  {String(item.hour).padStart(2, "0")}:
                  {String(item.minute).padStart(2, "0")}
                </span>
              </p>
              <p className="mt-1 text-[12px] leading-5 text-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </AppCard>
    </div>
  );
}

export function SyncSettingsPage() {
  const queryClient = useQueryClient();
  const { workspaceId, refresh } = useWorkspace();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [queueStatus, setQueueStatus] = useState({ pending: 0, failed: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) {
      setQueueStatus({ pending: 0, failed: 0 });
      return;
    }
    let cancelled = false;
    void (async () => {
      const { countOfflineJobs } = await import("@/lib/offline-queue");
      const status = await countOfflineJobs(workspaceId);
      if (!cancelled) setQueueStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, lastChecked]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      if (workspaceId && navigator.onLine) {
        try {
          const { flushPendingTransactionJobs } = await import(
            "@/lib/offline-queue"
          );
          const { postTransactionRpc } = await import(
            "@/features/workspace/workspace-api"
          );
          const flushResult = await flushPendingTransactionJobs(
            workspaceId,
            (job) =>
              postTransactionRpc({
                workspaceId: job.workspaceId,
                walletId: job.walletId,
                kind: job.kind,
                amountMinor: job.amountMinor,
                description: job.description,
                clientId: job.clientId,
                ...(job.projectId ? { projectId: job.projectId } : {}),
                ...(job.categoryId ? { categoryId: job.categoryId } : {}),
              }),
          );
          if (flushResult.synced > 0 || flushResult.failed > 0) {
            toast.message(
              `مزامنة الطابور: ${flushResult.synced} نجحت، ${flushResult.failed} فشلت`,
            );
          }
        } catch {
          // queue flush is best-effort before live refresh
        }
      }
      await refresh();
      if (workspaceId) {
        await queryClient.invalidateQueries({
          predicate: (query) => query.queryKey.includes(workspaceId),
        });
        try {
          const { refreshOperationalNotificationsRpc } = await import(
            "@/features/workspace/workspace-api"
          );
          await refreshOperationalNotificationsRpc(workspaceId);
        } catch {
          // optional
        }
      }
      setLastChecked(new Date());
      toast.success("تم تحديث البيانات من الخادم");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر تحديث البيانات",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="المزامنة"
        subtitle="حالة الاتصال وتحديث البيانات من مصدرها."
        backTo="/settings"
      />

      <AppCard className="mb-4 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-11 items-center justify-center rounded-sm ${
              isOnline
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger"
            }`}
          >
            {isOnline ? (
              <Cloud aria-hidden="true" size={21} />
            ) : (
              <CloudOff aria-hidden="true" size={21} />
            )}
          </span>
          <div>
            <h2 className="font-bold text-ink">
              {isOnline ? "متصل بالخادم" : "لا يوجد اتصال"}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {lastChecked
                ? `آخر تحديث ناجح ${lastChecked.toLocaleTimeString("ar-LY", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "لم يُطلب تحديث يدوي في هذه الجلسة"}
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard className="mb-4 p-4 sm:p-5">
        <h2 className="font-bold text-ink">طابور الأوفلاين</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          المعاملات المحفوظة محليًا عبر Dexie عند انقطاع الشبكة (post_transaction
          فقط).
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-sm bg-surface-subtle p-3">
            <dt className="text-xs text-muted">بانتظار المزامنة</dt>
            <dd className="numeric mt-1 text-lg font-bold text-ink">
              {queueStatus.pending}
            </dd>
          </div>
          <div className="rounded-sm bg-surface-subtle p-3">
            <dt className="text-xs text-muted">فشل</dt>
            <dd className="numeric mt-1 text-lg font-bold text-danger">
              {queueStatus.failed}
            </dd>
          </div>
        </dl>
      </AppCard>

      <AppCard className="p-4 sm:p-5">
        <h2 className="font-bold text-ink">مصدر البيانات</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          الأرصدة والحركات والمشاريع تُقرأ من مساحة العمل المحمية في Supabase.
          عند عودة الاتصال، استخدم التحديث لجلب أحدث نسخة مؤكدة.
        </p>
        <button
          type="button"
          disabled={!isOnline || isRefreshing}
          onClick={() => void handleRefresh()}
          className="pressable mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            aria-hidden="true"
            size={17}
            className={isRefreshing ? "animate-spin" : ""}
          />
          {isRefreshing ? "جاري التحديث…" : "تحديث الآن"}
        </button>
      </AppCard>
    </div>
  );
}

export function SecuritySettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
      navigate("/auth/login", { replace: true });
    } catch (error) {
      toast.error(
        getAuthErrorMessage(
          error instanceof Error
            ? { message: error.message }
            : { message: String(error) },
        ),
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="الخصوصية والأمان"
        subtitle="كلمة المرور وحالة الحساب والجلسة الحالية."
        backTo="/settings"
      />

      <AppCard className="mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-success-soft text-success">
            <ShieldCheck aria-hidden="true" size={21} />
          </span>
          <div>
            <h2 className="font-bold text-ink">الحساب نشط</h2>
            <p className="mt-1 text-xs text-muted">{user?.email ?? "—"}</p>
            <p className="mt-2 text-xs leading-5 text-muted">
              الحالة: {profile?.account_status ?? "غير متاحة"} • الصلاحية:{" "}
              {profile?.system_role === "supervisor" ? "مدير المنصة" : "مستخدم"}
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard className="divide-y divide-line overflow-hidden">
        <Link
          to="/auth/update-password"
          className="pressable flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-subtle"
        >
          <span className="flex size-10 items-center justify-center rounded-sm bg-primary-soft text-primary">
            <KeyRound aria-hidden="true" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">
              تغيير كلمة المرور
            </span>
            <span className="mt-1 block text-xs text-muted">
              استخدم كلمة قوية لا تعيد استعمالها
            </span>
          </span>
        </Link>
        <div className="flex min-h-16 items-center gap-3 px-4 py-3">
          <span className="flex size-10 items-center justify-center rounded-sm bg-surface-subtle text-muted">
            <LockKeyhole aria-hidden="true" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">
              عزل مساحة العمل
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted">
              الوصول للبيانات مقيّد بالعضوية وسياسات RLS.
            </span>
          </span>
        </div>
      </AppCard>

      <button
        type="button"
        disabled={isSigningOut}
        onClick={() => void handleSignOut()}
        className="pressable mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm border border-danger/20 bg-danger-soft font-bold text-danger disabled:opacity-60"
      >
        <LogOut aria-hidden="true" size={18} />
        {isSigningOut ? "جاري الخروج…" : "إنهاء الجلسة الحالية"}
      </button>
    </div>
  );
}

export function CurrencySettingsPage() {
  const { currency, membership } = useWorkspace();
  const currencyLabel =
    currency === "LYD" ? "الدينار الليبي" : `العملة ${currency}`;

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="العملة الأساسية"
        subtitle="مرجع التقارير والأرصدة داخل مساحة العمل."
        backTo="/settings"
      />

      <AppCard className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
            <WalletCards aria-hidden="true" size={21} />
          </span>
          <div>
            <p className="text-xs text-muted">
              {membership?.workspaceName ?? "مساحة العمل"}
            </p>
            <h2 className="mt-1 text-lg font-bold text-ink">
              {currencyLabel} ({currency})
            </h2>
          </div>
        </div>
        <p className="mt-5 rounded-sm bg-warning-soft p-3 text-sm leading-6 text-warning">
          لا يغيّر ميزان العملة تلقائيًا بعد بدء التسجيل، لأن ذلك سيعيد تفسير
          مبالغ تاريخية دون سعر صرف. أنشئ المحافظ وسجّل الحركات بعملتها الصحيحة
          للحفاظ على دقة الحسابات.
        </p>
      </AppCard>
    </div>
  );
}

export function HelpSettingsPage() {
  const questions = [
    {
      title: "كيف تُحسب الأرصدة؟",
      body: "من قيود الحركات الفعلية فقط؛ التحويل لا يُحسب دخلاً أو مصروفًا.",
    },
    {
      title: "كيف تُحسب أرباح المشروع؟",
      body: "الدخل ناقص المصروف، ثم تُعرض نتيجة أدق بعد خصم مستحقات العمال غير المسددة.",
    },
    {
      title: "لماذا بعض التحليلات غير متاحة؟",
      body: "ميزان لا يخترع نسبًا عند نقص البيانات. سجّل حركات كافية واربط المصروفات بالتصنيفات والمشاريع.",
    },
    {
      title: "ماذا أفعل عند تعذر المزامنة؟",
      body: "تحقق من الاتصال، ثم افتح صفحة المزامنة واضغط «تحديث الآن». لا تكرر العملية المالية إذا كان الطلب لا يزال قيد التنفيذ.",
    },
  ];

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="المساعدة"
        subtitle="إجابات مباشرة عن الحسابات والاستخدام الآمن."
        backTo="/settings"
      />

      <AppCard className="mb-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-sm bg-info-soft text-info">
            <LifeBuoy aria-hidden="true" size={21} />
          </span>
          <div>
            <h2 className="font-bold text-ink">ميزان يفضّل الدقة على التخمين</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              راجع التوضيحات أدناه، أو استخدم رسائل الخطأ وإعادة المحاولة داخل
              الصفحة المتأثرة.
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard className="divide-y divide-line overflow-hidden">
        {questions.map((question) => (
          <details key={question.title} className="group px-4 py-3.5">
            <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-bold text-ink">
              {question.title}
              <CheckCircle2
                aria-hidden="true"
                size={17}
                className="shrink-0 text-primary"
              />
            </summary>
            <p className="mt-2 text-sm leading-6 text-muted">{question.body}</p>
          </details>
        ))}
      </AppCard>
    </div>
  );
}
