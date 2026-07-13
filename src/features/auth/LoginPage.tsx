import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { getAuthErrorMessage } from "./auth-messages";
import { PasswordField } from "./PasswordField";
import { useAuth } from "./use-auth";

export function LoginPage() {
  const { session, isLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    from?: string;
    notice?: string;
  } | null;
  const from =
    locationState?.from && locationState.from !== "/auth/login"
      ? locationState.from
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isLoading && session) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextErrors: typeof fieldErrors = {};
    if (!email.trim()) {
      nextErrors.email = "أدخل بريدك الإلكتروني";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "أدخل بريدًا إلكترونيًا صحيحًا";
    }
    if (!password) nextErrors.password = "أدخل كلمة المرور";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      await signIn({ email: email.trim(), password });
      navigate(from, { replace: true });
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

  return (
    <AuthLayout
      title="مرحباً بعودتك"
      description="سجّل الدخول للوصول إلى محافظك ومشاريعك وتحليلاتك المالية."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link
            to="/auth/signup"
            className="font-bold text-primary hover:underline"
          >
            إنشاء حساب
          </Link>
        </>
      }
    >
      {locationState?.notice ? (
        <p
          className="mb-5 rounded-sm bg-success-soft px-4 py-3 text-sm font-medium text-success"
          role="status"
        >
          {locationState.notice}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <div>
          <label htmlFor="login-email" className="mb-2 block text-sm font-bold text-ink">
            البريد الإلكتروني
          </label>
          <input
            id="login-email"
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
              setError(null);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            className="min-h-12 w-full rounded-sm border border-line bg-canvas px-4 text-left text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
            dir="ltr"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          />
          {fieldErrors.email ? (
            <p
              id="login-email-error"
              className="mt-2 text-xs font-medium text-danger"
            >
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <PasswordField
          label="كلمة المرور"
          labelAction={
            <Link
              to="/auth/forgot-password"
              className="text-xs font-bold text-primary hover:underline"
            >
              نسيت كلمة المرور؟
            </Link>
          }
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setError(null);
            setFieldErrors((current) => ({
              ...current,
              password: undefined,
            }));
          }}
          placeholder="أدخل كلمة المرور"
          error={fieldErrors.password}
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
          {submitting ? "جاري التحقق…" : "تسجيل الدخول"}
        </button>
      </form>
    </AuthLayout>
  );
}
