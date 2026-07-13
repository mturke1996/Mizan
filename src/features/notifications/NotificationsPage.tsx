import { Bell, CheckCheck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/features/auth/use-auth";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import { EmptyBlock, LoadingBlock } from "@/features/supervisor/SupervisorUi";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, kind, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
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
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });
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
      await queryClient.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });
    },
  });

  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((item) => !item.read_at).length;

  return (
    <div className="page-enter px-4 sm:px-6">
      <PageHeader
        title="الإشعارات"
        subtitle={
          unread > 0 ? `${unread} غير مقروءة` : "كل شيء محدّث"
        }
        backTo="/"
        action={
          unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllReadMutation.mutateAsync()}
              className="pressable flex min-h-11 items-center gap-1.5 rounded-sm px-3 text-xs font-bold text-primary hover:bg-primary-soft"
            >
              <CheckCheck size={16} />
              قراءة الكل
            </button>
          ) : undefined
        }
      />

      {notificationsQuery.isLoading ? (
        <LoadingBlock rows={4} />
      ) : notifications.length === 0 ? (
        <EmptyBlock
          title="لا إشعارات"
          description="ستصلك هنا تنبيهات الاشتراك والمعاملات المهمة."
        />
      ) : (
        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <AppCard
                className={`p-4 transition-colors ${
                  notification.read_at
                    ? "opacity-80"
                    : "border-primary/20 bg-primary-soft/30"
                }`}
              >
                <button
                  type="button"
                  className="w-full text-right"
                  onClick={() => {
                    if (!notification.read_at) {
                      void markReadMutation.mutateAsync(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-subtle text-primary">
                      <Bell aria-hidden="true" size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-ink">{notification.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {notification.body}
                      </p>
                      <p className="mt-2 text-[10px] text-soft">
                        {new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(notification.created_at))}
                      </p>
                    </div>
                  </div>
                </button>
              </AppCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
