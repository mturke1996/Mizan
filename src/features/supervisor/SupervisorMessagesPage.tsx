import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AppCard } from "@/shared/ui/AppCard";
import { SupervisorActionDialog } from "./SupervisorActionDialog";
import {
  fetchNotificationCampaigns,
  fetchOperationalMetrics,
  intelligenceKeys,
  sendNotificationCampaign,
  type CampaignSegment,
} from "./supervisor-intelligence-api";
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge } from "./SupervisorUi";
import { formatDateAr } from "./supervisor-utils";

const campaignSchema = z.object({
  segment: z.enum([
    "all_active",
    "trialing",
    "expiring_7d",
    "grace",
    "frozen",
  ]),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  note: z.string().trim().min(3).max(500),
});

const SEGMENTS: { id: CampaignSegment; label: string }[] = [
  { id: "all_active", label: "النشطون" },
  { id: "trialing", label: "التجريبيون" },
  { id: "expiring_7d", label: "ينتهي خلال 7 أيام" },
  { id: "grace", label: "المهلة" },
  { id: "frozen", label: "المجمّدون" },
];

function segmentEstimate(
  segment: CampaignSegment,
  metrics:
    | {
        customers: {
          active: number;
          trialing: number;
          grace: number;
          frozen: number;
          expiring7d: number;
        };
      }
    | undefined,
): number | null {
  if (!metrics) return null;
  if (segment === "all_active") return metrics.customers.active;
  if (segment === "trialing") return metrics.customers.trialing;
  if (segment === "expiring_7d") return metrics.customers.expiring7d;
  if (segment === "grace") return metrics.customers.grace;
  return metrics.customers.frozen;
}

export function SupervisorMessagesPage() {
  const queryClient = useQueryClient();
  const clientIdRef = useRef(crypto.randomUUID());
  const [segment, setSegment] = useState<CampaignSegment>("all_active");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - 90);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const metricsQuery = useQuery({
    queryKey: intelligenceKeys.operations(range.from, range.to),
    queryFn: () => fetchOperationalMetrics(range.from, range.to),
  });
  const campaignsQuery = useQuery({
    queryKey: intelligenceKeys.campaigns(0),
    queryFn: () => fetchNotificationCampaigns(50, 0),
  });

  const sendMutation = useMutation({
    mutationFn: (note: string) => {
      const parsed = campaignSchema.parse({
        segment,
        title,
        body,
        note,
      });
      return sendNotificationCampaign({
        ...parsed,
        clientId: clientIdRef.current,
      });
    },
    onSuccess: async (result) => {
      toast.success(`تم إرسال الحملة إلى ${result.recipientCount} مستلم`);
      setConfirmOpen(false);
      setTitle("");
      setBody("");
      clientIdRef.current = crypto.randomUUID();
      await queryClient.invalidateQueries({
        queryKey: intelligenceKeys.all,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const estimate = segmentEstimate(segment, metricsQuery.data);

  function openConfirm() {
    const draft = campaignSchema.safeParse({
      segment,
      title,
      body,
      note: "placeholder",
    });
    if (!draft.success) {
      setFormError("تحقق من العنوان والنص قبل الإرسال.");
      return;
    }
    setFormError(null);
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-6 py-6">
      <div className="lg:hidden">
        <h1 className="text-xl font-bold text-ink">الرسائل</h1>
        <p className="mt-1 text-sm text-muted">حملات إشعار داخل التطبيق</p>
      </div>

      <AppCard className="space-y-4 p-5">
        <h2 className="text-base font-bold text-ink">محرر الحملة</h2>
        <label className="block text-xs font-semibold text-muted">
          الشريحة
          <select
            className="mt-1 block min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-sm text-ink"
            onChange={(event) =>
              setSegment(event.target.value as CampaignSegment)
            }
            value={segment}
          >
            {SEGMENTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <p className="rounded-[10px] bg-surface-subtle px-3 py-2 text-xs text-muted">
          معاينة المستلمين التقريبية:{" "}
          {estimate == null ? "—" : `${estimate} مستلم`} · العدد النهائي يُحسب
          عند الإرسال وقد يختلف عن التقدير.
        </p>
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
            className="mt-1 block min-h-28 w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink"
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </label>
        {formError ? (
          <p className="text-xs font-semibold text-danger">{formError}</p>
        ) : null}
        <button
          className="pressable min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on hover:bg-primary-hover"
          onClick={openConfirm}
          type="button"
        >
          متابعة الإرسال
        </button>
      </AppCard>

      <section aria-labelledby="campaigns-heading">
        <h2 className="mb-3 text-base font-bold text-ink" id="campaigns-heading">
          سجل الحملات
        </h2>
        {campaignsQuery.isLoading ? (
          <LoadingBlock rows={3} />
        ) : campaignsQuery.isError ? (
          <ErrorBlock
            message={
              campaignsQuery.error instanceof Error
                ? campaignsQuery.error.message
                : "تعذر التحميل"
            }
            onRetry={() => void campaignsQuery.refetch()}
          />
        ) : (campaignsQuery.data?.length ?? 0) === 0 ? (
          <EmptyBlock
            description="لم تُرسل أي حملات بعد."
            title="لا حملات"
          />
        ) : (
          <ul className="space-y-3">
            {(campaignsQuery.data ?? []).map((campaign) => (
              <li
                className="rounded-[12px] border border-line bg-surface p-4"
                key={campaign.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{campaign.title}</p>
                    <p className="mt-1 text-xs text-muted">{campaign.body}</p>
                  </div>
                  <StatusBadge
                    label={
                      SEGMENTS.find((item) => item.id === campaign.segment)
                        ?.label ?? campaign.segment
                    }
                    tone="bg-primary-soft text-primary"
                  />
                </div>
                <p className="mt-3 text-[11px] text-soft">
                  {campaign.recipientCount} مستلم · {campaign.readCount} قراءة ·{" "}
                  {campaign.actorName || "منفّذ"} ·{" "}
                  {formatDateAr(campaign.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SupervisorActionDialog
        confirmLabel="إرسال الحملة"
        description={`سيتم إرسال الرسالة إلى شريحة «${
          SEGMENTS.find((item) => item.id === segment)?.label ?? segment
        }». العدد التقريبي: ${estimate ?? "—"}.`}
        isPending={sendMutation.isPending}
        noteRequired
        onConfirm={(note) => sendMutation.mutate(note)}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="تأكيد إرسال الحملة"
        tone="primary"
      />
    </div>
  );
}
