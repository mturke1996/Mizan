import { Megaphone, Send, Sparkles, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SUPERVISOR_SIGNAL_TEMPLATES } from "@/lib/motivational-notifications";
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
  const [activeTemplate, setActiveTemplate] = useState<string>("custom");
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
      toast.success(`تم إرسال الإشارة إلى ${result.recipientCount} مستلم`);
      setConfirmOpen(false);
      setTitle("");
      setBody("");
      setActiveTemplate("custom");
      clientIdRef.current = crypto.randomUUID();
      await queryClient.invalidateQueries({
        queryKey: intelligenceKeys.all,
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const estimate = segmentEstimate(segment, metricsQuery.data);

  function applyTemplate(key: string) {
    const template = SUPERVISOR_SIGNAL_TEMPLATES.find((item) => item.key === key);
    if (!template) return;
    setActiveTemplate(key);
    if (key !== "custom") {
      setTitle(template.title);
      setBody(template.body);
      setFormError(null);
    }
  }

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
        <h1 className="text-xl font-bold text-ink">الإشارات والرسائل</h1>
        <p className="mt-1 text-sm text-muted">
          أرسل تحفيزًا أو تنبيهًا لكل الشريحة بضغطة واحدة
        </p>
      </div>

      <section
        aria-labelledby="quick-signals-heading"
        className="overflow-hidden rounded-[22px] border border-line bg-[linear-gradient(145deg,rgb(67_56_202/12%),rgb(16_185_129/8%)_55%,rgb(245_158_11/10%))] p-5 sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-surface text-primary shadow-[0_8px_24px_rgb(27_30_60/8%)]">
            <Zap aria-hidden="true" size={20} />
          </span>
          <div>
            <h2
              className="text-base font-bold text-ink"
              id="quick-signals-heading"
            >
              إشارات سريعة
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              ثلاث رسائل تحفيزية جاهزة + رسالة مخصّصة. تصل لصندوق المستخدم وعلى
              جهاز أندرويد عند تفعيل الإشعارات.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SUPERVISOR_SIGNAL_TEMPLATES.map((template) => {
            const active = activeTemplate === template.key;
            return (
              <button
                key={template.key}
                type="button"
                onClick={() => applyTemplate(template.key)}
                className={[
                  "pressable rounded-2xl border px-3.5 py-3.5 text-start transition-colors",
                  active
                    ? "border-primary/30 bg-surface shadow-[0_10px_28px_rgb(27_30_60/8%)]"
                    : "border-white/50 bg-surface/70 hover:bg-surface",
                ].join(" ")}
              >
                <span className="flex items-center gap-2 text-xs font-bold text-ink">
                  {template.key === "custom" ? (
                    <Megaphone aria-hidden="true" size={14} className="text-primary" />
                  ) : (
                    <Sparkles aria-hidden="true" size={14} className="text-primary" />
                  )}
                  {template.label}
                </span>
                {template.title ? (
                  <span className="mt-2 line-clamp-2 block text-[11px] leading-4 text-muted">
                    {template.title} — {template.body}
                  </span>
                ) : (
                  <span className="mt-2 block text-[11px] text-muted">
                    اكتب عنوانًا ونصًا حرًا بالأسفل
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <AppCard className="space-y-4 p-5 sm:p-6" elevated>
        <div className="flex items-center gap-2">
          <Send aria-hidden="true" className="text-primary" size={18} />
          <h2 className="text-base font-bold text-ink">محرر الحملة</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-xs font-semibold text-muted">
            الشريحة المستهدفة
            <select
              className="mt-1.5 block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink"
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
          <p className="rounded-xl bg-primary-soft/60 px-3.5 py-2.5 text-xs font-semibold text-primary">
            ≈ {estimate == null ? "—" : estimate} مستلم
          </p>
        </div>

        <label className="block text-xs font-semibold text-muted">
          العنوان
          <input
            className="mt-1.5 block min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink"
            maxLength={120}
            onChange={(event) => {
              setTitle(event.target.value);
              setActiveTemplate("custom");
            }}
            placeholder="مثال: السلام عليكم"
            value={title}
          />
        </label>
        <label className="block text-xs font-semibold text-muted">
          نص الإشارة
          <textarea
            className="mt-1.5 block min-h-28 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-6 text-ink"
            maxLength={2000}
            onChange={(event) => {
              setBody(event.target.value);
              setActiveTemplate("custom");
            }}
            placeholder="اكتب رسالة واضحة ومحفّزة…"
            value={body}
          />
        </label>
        {formError ? (
          <p className="text-xs font-semibold text-danger">{formError}</p>
        ) : null}
        <button
          className="pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-on hover:bg-primary-hover"
          onClick={openConfirm}
          type="button"
        >
          <Send aria-hidden="true" size={16} />
          متابعة الإرسال
        </button>
      </AppCard>

      <section aria-labelledby="campaigns-heading">
        <h2 className="mb-3 text-base font-bold text-ink" id="campaigns-heading">
          سجل الإشارات
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
            description="أرسل أول إشارة تحفيزية من القوالب أعلاه."
            title="لا إشارات بعد"
          />
        ) : (
          <ul className="space-y-3">
            {(campaignsQuery.data ?? []).map((campaign) => (
              <li
                className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-surface-subtle/60"
                key={campaign.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-ink">{campaign.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {campaign.body}
                    </p>
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
        confirmLabel="إرسال الإشارة"
        description={`سيتم إرسال الرسالة إلى شريحة «${
          SEGMENTS.find((item) => item.id === segment)?.label ?? segment
        }». العدد التقريبي: ${estimate ?? "—"}.`}
        isPending={sendMutation.isPending}
        noteRequired
        onConfirm={(note) => sendMutation.mutate(note)}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="تأكيد إرسال الإشارة"
        tone="primary"
      />
    </div>
  );
}
