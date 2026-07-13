import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import {
  fetchCustomerNotifications,
  intelligenceKeys,
  sendCustomerNotification,
} from "./supervisor-intelligence-api";
import { ErrorBlock, LoadingBlock, StatusBadge } from "./SupervisorUi";
import { formatDateAr } from "./supervisor-utils";

const messageSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  note: z.string().trim().min(3).max(500),
});

export interface CustomerMessagesPanelProps {
  userId: string;
  workspaceId: string | null;
}

export function CustomerMessagesPanel({
  userId,
  workspaceId,
}: CustomerMessagesPanelProps) {
  const queryClient = useQueryClient();
  const clientIdRef = useRef(crypto.randomUUID());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const listQuery = useQuery({
    queryKey: intelligenceKeys.customerNotifications(userId, page),
    queryFn: () =>
      fetchCustomerNotifications(userId, pageSize, (page - 1) * pageSize),
  });

  const sendMutation = useMutation({
    mutationFn: (note: string) => {
      const parsed = messageSchema.parse({ title, body, note });
      return sendCustomerNotification({
        userId,
        workspaceId,
        title: parsed.title,
        body: parsed.body,
        note: parsed.note,
        clientId: clientIdRef.current,
      });
    },
    onSuccess: async () => {
      toast.success("تم إرسال الرسالة");
      setConfirmOpen(false);
      setTitle("");
      setBody("");
      clientIdRef.current = crypto.randomUUID();
      await queryClient.invalidateQueries({
        queryKey: intelligenceKeys.customerNotifications(userId, page),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalPages = Math.max(
    1,
    Math.ceil((listQuery.data?.total ?? 0) / pageSize),
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-md border border-line bg-surface-subtle/30 p-3">
        <h3 className="text-sm font-bold text-ink">رسالة فردية</h3>
        <label className="block text-xs font-semibold text-muted">
          العنوان
          <input
            className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          النص
          <textarea
            className="mt-1 block min-h-24 w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </label>
        <button
          className="pressable min-h-11 rounded-sm bg-primary px-3 text-xs font-bold text-primary-on"
          onClick={() => {
            const draft = messageSchema.safeParse({
              title,
              body,
              note: "placeholder",
            });
            if (!draft.success) {
              toast.error("تحقق من العنوان والنص");
              return;
            }
            setConfirmOpen(true);
          }}
          type="button"
        >
          إرسال رسالة
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-ink">سجل رسائل العميل</h3>
        {listQuery.isLoading ? (
          <LoadingBlock rows={3} />
        ) : listQuery.isError ? (
          <ErrorBlock
            message={
              listQuery.error instanceof Error
                ? listQuery.error.message
                : "تعذر التحميل"
            }
            onRetry={() => void listQuery.refetch()}
          />
        ) : (listQuery.data?.rows.length ?? 0) === 0 ? (
          <p className="text-sm text-muted">لا رسائل لهذا العميل.</p>
        ) : (
          <ul className="space-y-2">
            {(listQuery.data?.rows ?? []).map((row) => (
              <li
                className="rounded-md border border-line px-3 py-2"
                key={row.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{row.title}</p>
                  <StatusBadge
                    label={row.readAt ? "مقروءة" : "غير مقروءة"}
                    tone={
                      row.readAt
                        ? "bg-success-soft text-success"
                        : "bg-warning-soft text-warning"
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-muted">{row.body}</p>
                <p className="mt-1 text-[11px] text-soft">
                  {formatDateAr(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {totalPages > 1 ? (
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              السابق
            </button>
            <span className="text-[11px] text-muted">
              {page} / {totalPages}
            </span>
            <button
              className="pressable min-h-10 rounded-sm border border-line px-3 text-xs font-bold disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              type="button"
            >
              التالي
            </button>
          </div>
        ) : null}
      </div>

      <SupervisorActionDialog
        confirmLabel="إرسال"
        description="ستُرسل الرسالة لهذا العميل فقط داخل التطبيق."
        isPending={sendMutation.isPending}
        noteRequired
        onConfirm={(note) => sendMutation.mutate(note)}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="تأكيد إرسال الرسالة"
        tone="primary"
      />
    </div>
  );
}
