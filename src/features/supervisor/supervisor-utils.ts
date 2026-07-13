import { formatMinorAmount } from "@/domain/money/money";

export const subscriptionStatusLabel: Record<string, string> = {
  trialing: "تجريبي",
  active: "نشط",
  grace: "مهلة",
  frozen: "مجمّد",
  expired: "منتهٍ",
  cancelled: "ملغى",
};

export const accountStatusLabel: Record<string, string> = {
  active: "نشط",
  suspended: "موقوف",
  disabled: "معطّل",
};

export const supervisorEventLabel: Record<string, string> = {
  supervisor_freeze: "تجميد من المدير",
  supervisor_unfreeze: "إلغاء تجميد",
  supervisor_extend_trial: "تمديد تجربة",
  payment_approved: "موافقة على دفع",
  payment_rejected: "رفض طلب دفع",
  trial_started: "بدء فترة تجريبية",
  subscription_activated: "تفعيل اشتراك",
};

export function statusTone(status: string | null | undefined): string {
  switch (status) {
    case "active":
    case "trialing":
      return "bg-success-soft text-success";
    case "frozen":
    case "suspended":
      return "bg-info-soft text-info";
    case "expired":
    case "cancelled":
    case "disabled":
      return "bg-danger-soft text-danger";
    case "grace":
      return "bg-warning-soft text-warning";
    default:
      return "bg-surface-subtle text-muted";
  }
}

export function formatMinorCurrency(
  minor: number | string,
  currency: string,
): string {
  try {
    return formatMinorAmount(BigInt(minor), {
      currency,
      locale: "en-US",
    });
  } catch {
    return "—";
  }
}

export function formatDateAr(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-LY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
