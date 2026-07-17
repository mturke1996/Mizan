import {
  Bell,
  Check,
  CheckCheck,
  CreditCard,
  Settings2,
  Shield,
  Trash2,
  Wallet,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/use-auth";
import { EmptyBlock, LoadingBlock } from "@/features/supervisor/SupervisorUi";
import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { useConfirm } from "@/shared/ui/confirm-dialog";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";
import {
  invalidateNotificationQueries,
  notificationKeys,
} from "./notification-keys";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

type InboxFilter = "all" | "unread" | "read";

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "unread", label: "غير مقروء" },
  { id: "read", label: "مقروء" },
];

function kindMeta(kind: string): {
  label: string;
  Icon: typeof Bell;
  tone: string;
} {
  if (kind === "billing" || kind === "payment") {
    return {
      label: kind === "payment" ? "دفع" : "اشتراك",
      Icon: CreditCard,
      tone: "bg-warning-soft text-warning",
    };
  }
  if (kind === "workspace") {
    return {
      label: "مساحة عمل",
      Icon: Wallet,
      tone: "bg-info-soft text-info",
    };
  }
  if (kind === "operational") {
    return {
      label: "تشغيلي",
      Icon: Shield,
      tone: "bg-primary-soft text-primary",
    };
  }
  return {
    label: "نظام",
    Icon: Bell,
    tone: "bg-primary-soft text-primary",
  };
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const notificationsQuery = useQuery({
    queryKey: notificationKeys.list(user?.id),
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, kind, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
    enabled: Boolean(user?.id),
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateNotificationQueries(queryClient, user?.id);
    },
    onError: (error: Error) => {
      toast.error(getUserErrorMessage(error, "تعذر تعليم الإشعار كمقروء"));
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user!.id)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم تعليم كل الإشعارات كمقروءة");
      await invalidateNotificationQueries(queryClient, user?.id);
    },
    onError: (error: Error) => {
      toast.error(getUserErrorMessage(error, "تعذر تعليم الكل كمقروء"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم حذف الإشعار");
      await invalidateNotificationQueries(queryClient, user?.id);
    },
    onError: (error: Error) => {
      toast.error(getUserErrorMessage(error, "تعذر حذف الإشعار"));
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("تم تفريغ صندوق الإشعارات");
      await invalidateNotificationQueries(queryClient, user?.id);
    },
    onError: (error: Error) => {
      toast.error(getUserErrorMessage(error, "تعذر تفريغ الإشعارات"));
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((item) => !item.read_at).length;
  const filtered = useMemo(() => {
    if (filter === "unread") return notifications.filter((item) => !item.read_at);
    if (filter === "read") return notifications.filter((item) => item.read_at);
    return notifications;
  }, [filter, notifications]);

  async function handleMarkRead(id: string) {
    setPendingId(id);
    try {
      await markReadMutation.mutateAsync(id);
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(notification: NotificationRow) {
    const ok = await confirm({
      title: "حذف الإشعار؟",
      description: notification.title,
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
      tone: "danger",
      warning: "سيُحذف نهائيًا من صندوقك ولن يمكن استرجاعه.",
    });
    if (!ok) return;
    setPendingId(notification.id);
    try {
      await deleteMutation.mutateAsync(notification.id);
    } finally {
      setPendingId(null);
    }
  }

  async function handleClearAll() {
    const ok = await confirm({
      title: "تفريغ كل الإشعارات؟",
      description: "سيتم حذف جميع الرسائل من صندوقك.",
      confirmLabel: "تفريغ الكل",
      cancelLabel: "إلغاء",
      tone: "danger",
      warning: "هذا الإجراء نهائي ولا يمكن التراجع عنه.",
    });
    if (!ok) return;
    await deleteAllMutation.mutateAsync();
  }

  return (
    <div className="page-enter px-4 pb-6 sm:px-6">
      <PageHeader
        title="الإشعارات"
        subtitle={unread > 0 ? `${unread} غير مقروءة` : "كل شيء محدّث"}
        backTo="/"
        action={
          <div className="flex items-center gap-1.5">
            {unread > 0 ? (
              <button
                type="button"
                disabled={markAllReadMutation.isPending}
                onClick={() => void markAllReadMutation.mutateAsync()}
                className="pressable flex min-h-10 items-center gap-1.5 rounded-xl bg-primary-soft px-3 text-xs font-bold text-primary disabled:opacity-60"
              >
                <CheckCheck size={15} aria-hidden="true" />
                قراءة الكل
              </button>
            ) : null}
            {notifications.length > 0 ? (
              <button
                type="button"
                disabled={deleteAllMutation.isPending}
                onClick={() => void handleClearAll()}
                className="pressable flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-danger hover:bg-danger-soft disabled:opacity-60"
              >
                <Trash2 size={15} aria-hidden="true" />
                تفريغ
              </button>
            ) : null}
          </div>
        }
      />

      <div
        role="tablist"
        aria-label="تصفية الإشعارات"
        className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-line/70 bg-surface-subtle/70 p-0.5"
      >
        {FILTERS.map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.id)}
              className={[
                "pressable min-h-9 rounded-lg text-[11px] font-bold transition-colors",
                active
                  ? "bg-surface text-primary shadow-[0_2px_8px_rgb(27_30_60/5%)]"
                  : "text-muted hover:text-ink",
              ].join(" ")}
            >
              {item.label}
              {item.id === "unread" && unread > 0 ? (
                <span className="ms-1 numeric text-[10px] opacity-80">
                  {unread}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {notificationsQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : notificationsQuery.isError ? (
        <ErrorState
          message={getUserErrorMessage(
            notificationsQuery.error,
            "تعذر تحميل الإشعارات",
          )}
          onRetry={() => void notificationsQuery.refetch()}
        />
      ) : notifications.length === 0 ? (
        <EmptyBlock
          title="لا إشعارات"
          description="ستصلك هنا تنبيهات الاشتراك والإشارات والتحفيز. فعّل إشعارات الجهاز لتصلك والتطبيق مقفل."
        />
      ) : filtered.length === 0 ? (
        <EmptyBlock
          title={filter === "unread" ? "لا غير مقروء" : "لا مقروء"}
          description="غيّر التصفية لعرض باقي الصندوق."
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((notification, index) => {
            const meta = kindMeta(notification.kind);
            const Icon = meta.Icon;
            const unreadItem = !notification.read_at;
            const busy = pendingId === notification.id;
            return (
              <li
                key={notification.id}
                className="page-enter"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <AppCard
                  className={[
                    "overflow-hidden p-0 transition-[border-color,background-color,opacity] duration-200",
                    unreadItem
                      ? "border-primary/25 bg-primary-soft/25"
                      : "opacity-90",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3 px-4 pt-4">
                    <span
                      className={[
                        "grid size-10 shrink-0 place-items-center rounded-2xl",
                        meta.tone,
                      ].join(" ")}
                    >
                      <Icon aria-hidden="true" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-bold tracking-tight text-ink text-pretty">
                          {notification.title}
                        </p>
                        {unreadItem ? (
                          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-on">
                            جديد
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 text-sm leading-6 text-muted text-pretty">
                        {notification.body}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-soft">
                        <span
                          className={[
                            "rounded-md px-1.5 py-0.5 font-bold",
                            meta.tone,
                          ].join(" ")}
                        >
                          {meta.label}
                        </span>
                        <span>{formatWhen(notification.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-line/70 px-3 py-2.5">
                    {unreadItem ? (
                      <button
                        type="button"
                        disabled={busy || markReadMutation.isPending}
                        onClick={() => void handleMarkRead(notification.id)}
                        className="pressable inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold text-primary-on disabled:opacity-60"
                      >
                        <Check size={15} aria-hidden="true" />
                        قراءة
                      </button>
                    ) : (
                      <span className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-subtle px-3 text-xs font-bold text-muted">
                        <CheckCheck size={15} aria-hidden="true" />
                        مقروء
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy || deleteMutation.isPending}
                      onClick={() => void handleDelete(notification)}
                      aria-label={`حذف ${notification.title}`}
                      className="pressable inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-bold text-danger hover:bg-danger-soft disabled:opacity-60"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      حذف
                    </button>
                  </div>
                </AppCard>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5">
        <Link
          to="/settings/notifications"
          className="pressable flex min-h-12 items-center justify-between rounded-2xl border border-line bg-surface px-4 text-sm font-bold text-ink hover:bg-surface-subtle"
        >
          <span className="inline-flex items-center gap-2">
            <Settings2 aria-hidden="true" size={16} className="text-primary" />
            إعدادات إشعارات الجهاز
          </span>
          <span className="text-xs font-semibold text-muted">تحفيز يومي</span>
        </Link>
      </div>
    </div>
  );
}
