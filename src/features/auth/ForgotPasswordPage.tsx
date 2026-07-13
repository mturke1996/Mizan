import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "./AuthLayout";
import { getAuthErrorMessage } from "./auth-messages";
import { useAuth } from "./use-auth";

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("أدخل بريدًا إلكترونيًا صحيحًا");
      return;
    }

    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
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

  if (submitted) {
    return (
      <AuthLayout
        title="راجع بريدك"
        description="إذا كان البريد مرتبطًا بحساب، ستصلك رسالة آمنة لتعيين كلمة مرور جديدة."
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
          <MailCheck className="mb-4 size-8" aria-hidden="true" />
          <p className="font-bold">تم إرسال الطلب</p>
          <p className="mt-2 text-sm leading-6">
            قد تستغرق الرسالة دقيقة. راجع مجلد الرسائل غير المرغوب فيها أيضًا.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 min-h-11 w-full rounded-sm font-bold text-primary hover:bg-primary-soft"
        >
          استخدام بريد آخر
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="استعادة كلمة المرور"
      description="أدخل بريد حسابك وسنرسل لك رابطًا مخصصًا لتعيين كلمة مرور جديدة."
      footer={
        <Link
          to="/auth/login"
          className="font-bold text-primary hover:underline"
        >
          تذكرت كلمة المرور
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="grid gap-5" noValidate>
        <div>
          <label
            htmlFor="recovery-email"
            className="mb-2 block text-sm font-bold text-ink"
          >
            البريد الإلكتروني
          </label>
          <input
            id="recovery-email"
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
              setEmailError(null);
            }}
            className="min-h-12 w-full rounded-sm border border-line bg-canvas px-4 text-left text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="you@example.com"
            dir="ltr"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "recovery-email-error" : undefined}
          />
          {emailError ? (
            <p
              id="recovery-email-error"
              className="mt-2 text-xs font-medium text-danger"
            >
              {emailError}
            </p>
          ) : null}
        </div>

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
          {submitting ? "جاري الإرسال…" : "إرسال رابط الاستعادة"}
        </button>
      </form>
    </AuthLayout>
  );
}
