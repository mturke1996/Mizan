import { CheckCircle2, Circle, Link2Off } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getSupabaseClient } from "@/lib/supabase";
import { getUserErrorMessage } from "@/lib/user-error";
import { AuthLayout } from "./AuthLayout";
import { getAuthErrorMessage } from "./auth-messages";
import { PasswordField } from "./PasswordField";
import { useAuth } from "./use-auth";
import {
  getPasswordChecks,
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
} from "./password-policy";

export function UpdatePasswordPage() {
  const { session, profile, isLoading, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isRequired =
    searchParams.get("required") === "1" ||
    Boolean(profile?.must_change_password);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const checks = getPasswordChecks(password);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextPasswordError = isStrongPassword(password)
      ? null
      : "استوفِ متطلبات كلمة المرور أدناه";
    const nextConfirmationError =
      confirmation === password ? null : "كلمتا المرور غير متطابقتين";
    setPasswordError(nextPasswordError);
    setConfirmationError(nextConfirmationError);
    if (nextPasswordError || nextConfirmationError) return;

    setSubmitting(true);
    try {
      await updatePassword(password);
      if (isRequired) {
        const supabase = getSupabaseClient();
        const { error: completeError } = await supabase.rpc(
          "complete_required_password_change",
        );
        if (completeError) throw completeError;
      }
      await signOut();
      navigate("/auth/login", {
        replace: true,
        state: { notice: "تم تحديث كلمة المرور. سجّل الدخول بكلمتك الجديدة." },
      });
    } catch (caught) {
      const authMessage = getAuthErrorMessage(
        caught instanceof Error
          ? { message: caught.message }
          : { message: String(caught) },
      );
      setError(
        getUserErrorMessage(
          caught instanceof Error
            ? { message: caught.message }
            : caught,
          authMessage,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <AuthLayout
        title="التحقق من الرابط"
        description="نراجع رابط الاستعادة الآمن قبل السماح بتغيير كلمة المرور."
      >
        <div className="grid gap-3" role="status">
          <div className="h-12 animate-pulse rounded-sm bg-surface-strong" />
          <div className="h-12 animate-pulse rounded-sm bg-surface-strong" />
          <span className="sr-only">جاري التحقق من الرابط</span>
        </div>
      </AuthLayout>
    );
  }

  if (!session) {
    return (
      <AuthLayout
        title="الرابط غير صالح"
        description="انتهت صلاحية رابط الاستعادة أو تم استخدامه من قبل."
        footer={
          <Link
            to="/auth/forgot-password"
            className="font-bold text-primary hover:underline"
          >
            طلب رابط جديد
          </Link>
        }
      >
        <div className="rounded-md bg-warning-soft p-5 text-warning">
          <Link2Off className="mb-4 size-8" aria-hidden="true" />
          <p className="font-bold">لا توجد جلسة استعادة نشطة</p>
          <p className="mt-2 text-sm leading-6">
            اطلب رابطًا جديدًا وافتحه على هذا الجهاز لإكمال العملية بأمان.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="عيّن كلمة مرور جديدة"
      description="استخدم كلمة مختلفة عن كلماتك السابقة ولا تشاركها مع أي شخص."
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <PasswordField
          label="كلمة المرور الجديدة"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(value) => {
            setPassword(value);
            setPasswordError(null);
          }}
          placeholder={`${PASSWORD_MIN_LENGTH} أحرف على الأقل`}
          error={passwordError}
        />

        <ul
          className="grid grid-cols-1 gap-2 rounded-sm bg-surface-subtle p-3 text-xs sm:grid-cols-3"
          aria-label="متطلبات كلمة المرور"
        >
          {[
            ["عشرة أحرف", checks.hasMinimumLength],
            ["حرف واحد", checks.hasLetter],
            ["رقم واحد", checks.hasNumber],
          ].map(([label, passed]) => {
            const Icon = passed ? CheckCircle2 : Circle;
            return (
              <li
                key={String(label)}
                className={`flex items-center gap-2 ${
                  passed ? "text-success" : "text-muted"
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </li>
            );
          })}
        </ul>

        <PasswordField
          label="تأكيد كلمة المرور"
          name="confirmation"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={confirmation}
          onChange={(value) => {
            setConfirmation(value);
            setConfirmationError(null);
          }}
          placeholder="أعد كتابة كلمة المرور"
          error={confirmationError}
        />

        {error ? (
          <p
            role="alert"
            className="rounded-sm bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="pressable flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-5 font-bold text-primary-on hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "جاري الحفظ…" : "حفظ كلمة المرور"}
        </button>
      </form>
    </AuthLayout>
  );
}
