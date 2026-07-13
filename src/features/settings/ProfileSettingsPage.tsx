import { Clock3, Save, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/use-auth";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import { updateOwnProfile } from "./settings-api";

const timezones = [
  { value: "Africa/Tripoli", label: "طرابلس (UTC+2)" },
  { value: "Africa/Cairo", label: "القاهرة" },
  { value: "Asia/Riyadh", label: "الرياض" },
  { value: "Europe/Istanbul", label: "إسطنبول" },
  { value: "UTC", label: "التوقيت العالمي UTC" },
];

export function ProfileSettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [timezone, setTimezone] = useState(
    profile?.timezone || "Africa/Tripoli",
  );
  const [nameError, setNameError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setNameError("الاسم يجب أن يكون بين حرفين و80 حرفًا");
      return;
    }
    if (!user?.id) {
      toast.error("تعذر تحديد الحساب الحالي");
      return;
    }

    setNameError("");
    setIsSaving(true);
    try {
      await updateOwnProfile({
        userId: user.id,
        displayName: normalizedName,
        timezone,
      });
      await refreshProfile();
      toast.success("تم تحديث الملف الشخصي");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر تحديث الملف الشخصي",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        title="الملف الشخصي"
        subtitle="الاسم والتوقيت المستخدمان في التقارير والتواريخ."
        backTo="/settings"
      />

      <form onSubmit={(event) => void handleSubmit(event)}>
        <AppCard className="space-y-5 p-4 sm:p-5">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <span className="flex size-11 items-center justify-center rounded-sm bg-primary-soft text-primary">
              <UserRound aria-hidden="true" size={20} />
            </span>
            <div className="min-w-0">
              <p className="font-bold text-ink">بيانات الحساب</p>
              <p className="mt-1 truncate text-xs text-muted">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="settings-display-name"
              className="mb-2 block text-sm font-bold text-ink"
            >
              الاسم الظاهر
            </label>
            <input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              maxLength={80}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "display-name-error" : undefined}
              className="min-h-12 w-full rounded-sm border border-line-strong bg-surface px-4 text-ink placeholder:text-muted"
            />
            {nameError ? (
              <p
                id="display-name-error"
                className="mt-2 text-xs font-semibold text-danger"
              >
                {nameError}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="settings-timezone"
              className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"
            >
              <Clock3 aria-hidden="true" size={16} className="text-primary" />
              المنطقة الزمنية
            </label>
            <select
              id="settings-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="min-h-12 w-full rounded-sm border border-line-strong bg-surface px-4 text-ink"
            >
              {timezones.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-muted">
              يؤثر التوقيت في تجميع الحركات حسب اليوم والشهر.
            </p>
          </div>
        </AppCard>

        <button
          type="submit"
          disabled={isSaving}
          className="pressable mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
        >
          <Save aria-hidden="true" size={18} />
          {isSaving ? "جاري الحفظ…" : "حفظ التغييرات"}
        </button>
      </form>
    </div>
  );
}
