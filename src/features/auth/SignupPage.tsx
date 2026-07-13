import { CheckCircle2, Circle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { getAuthErrorMessage } from "./auth-messages";
import { PasswordField } from "./PasswordField";
import { useAuth } from "./use-auth";
import {
  getPasswordChecks,
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
} from "./password-policy";

export function SignupPage() {
  const { session, isLoading, signUp } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const passwordChecks = getPasswordChecks(password);

  if (!isLoading && session) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextErrors: typeof fieldErrors = {};
    if (displayName.trim().length < 2) {
      nextErrors.displayName = "أدخل اسمًا من حرفين على الأقل";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "أدخل بريدًا إلكترونيًا صحيحًا";
    }
    if (!isStrongPassword(password)) {
      nextErrors.password = "استوفِ متطلبات كلمة المرور أدناه";
    }
    if (passwordConfirmation !== password) {
      nextErrors.passwordConfirmation = "كلمتا المرور غير متطابقتين";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      const result = await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      if (result.requiresEmailConfirmation) {
        setRequiresConfirmation(true);
      } else {
        navigate("/", { replace: true });
      }
    } catch (caught) {
      setError(
        getAuthErrorMessage(
          caught instanceof Error
            ? { message: caught.message }
            : { message: String(caught) },
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (requiresConfirmation) {
    return (
      <AuthLayout
        title="تحقق من بريدك"
        description="أرسلنا رابط التأكيد إلى بريدك. افتحه لتفعيل الحساب ثم سجّل الدخول."
        footer={
          <Link
            to="/auth/login"
            className="font-bold text-primary hover:underline"
          >
            العودة إلى تسجيل الدخول
          </Link>
        }
      >
        <div className="rounded-md bg-success-soft p-5 text-success">
          <CheckCircle2 className="mb-4 size-8" aria-hidden="true" />
          <p className="font-bold">طلب إنشاء الحساب تم بنجاح</p>
          <p className="mt-2 text-sm leading-6">
            إذا لم تجد الرسالة خلال دقائق، راجع مجلد الرسائل غير المرغوب فيها.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="أنشئ حسابك"
      description="ابدأ بمساحة عمل خاصة، ثم أضف محافظك ومشاريعك بالبيانات الحقيقية."
      footer={
        <>
          لديك حساب؟{" "}
          <Link
            to="/auth/login"
            className="font-bold text-primary hover:underline"
          >
            تسجيل الدخول
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <div>
          <label
            htmlFor="signup-name"
            className="mb-2 block text-sm font-bold text-ink"
          >
            الاسم
          </label>
          <input
            id="signup-name"
            type="text"
            name="displayName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                displayName: undefined,
              }));
            }}
            className="min-h-12 w-full rounded-sm border border-line bg-canvas px-4 text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="اسمك كما تفضّل ظهوره"
            aria-invalid={Boolean(fieldErrors.displayName)}
            aria-describedby={
              fieldErrors.displayName ? "signup-name-error" : undefined
            }
          />
          {fieldErrors.displayName ? (
            <p
              id="signup-name-error"
              className="mt-2 text-xs font-medium text-danger"
            >
              {fieldErrors.displayName}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="mb-2 block text-sm font-bold text-ink"
          >
            البريد الإلكتروني
          </label>
          <input
            id="signup-email"
            type="email"
            name="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({
                ...current,
                email: undefined,
              }));
            }}
            className="min-h-12 w-full rounded-sm border border-line bg-canvas px-4 text-left text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
            dir="ltr"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={
              fieldErrors.email ? "signup-email-error" : undefined
            }
          />
          {fieldErrors.email ? (
            <p
              id="signup-email-error"
              className="mt-2 text-xs font-medium text-danger"
            >
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <PasswordField
          label="كلمة المرور"
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(value) => {
            setPassword(value);
            setFieldErrors((current) => ({
              ...current,
              password: undefined,
            }));
          }}
          placeholder={`${PASSWORD_MIN_LENGTH} أحرف على الأقل`}
          error={fieldErrors.password}
        />

        <ul
          className="grid grid-cols-1 gap-2 rounded-sm bg-surface-subtle p-3 text-xs sm:grid-cols-3"
          aria-label="متطلبات كلمة المرور"
        >
          {[
            ["عشرة أحرف", passwordChecks.hasMinimumLength],
            ["حرف واحد", passwordChecks.hasLetter],
            ["رقم واحد", passwordChecks.hasNumber],
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
          name="passwordConfirmation"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={passwordConfirmation}
          onChange={(value) => {
            setPasswordConfirmation(value);
            setFieldErrors((current) => ({
              ...current,
              passwordConfirmation: undefined,
            }));
          }}
          placeholder="أعد كتابة كلمة المرور"
          error={fieldErrors.passwordConfirmation}
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
          className="pressable flex min-h-12 w-full items-center justify-center rounded-sm bg-primary px-5 font-bold text-primary-on transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
        >
          {submitting ? "جاري إنشاء الحساب…" : "إنشاء الحساب"}
        </button>
      </form>
    </AuthLayout>
  );
}
