import type { ProjectColorToken } from "@/features/workspace/workspace-types";

export const WIZARD_STEPS = [
  {
    number: 1,
    title: "ما نوع مشروعك؟",
    subtitle: "اختر مخططًا يجهّز الوحدات والتصنيفات المناسبة.",
  },
  {
    number: 2,
    title: "جهّز مشروعك",
    subtitle: "راجع الوحدات والتصنيفات قبل إدخال التفاصيل.",
  },
  {
    number: 3,
    title: "تفاصيل المشروع",
    subtitle: "أضف البيانات الأساسية ثم راجع الملخص واحفظ.",
  },
] as const;

export const COLOR_CHOICES = [
  { value: "primary", label: "أزرق", swatch: "bg-primary" },
  { value: "success", label: "أخضر", swatch: "bg-success" },
  { value: "warning", label: "ذهبي", swatch: "bg-warning" },
  { value: "danger", label: "أحمر", swatch: "bg-danger" },
  { value: "info", label: "سماوي", swatch: "bg-info" },
] as const satisfies readonly {
  value: ProjectColorToken;
  label: string;
  swatch: string;
}[];

export const PROJECT_TONES: Record<ProjectColorToken, string> = {
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export const PROJECT_FIELD_CLASS_NAME =
  "min-h-12 w-full rounded-sm border border-control-border bg-surface px-4 text-sm text-ink placeholder:text-muted";
