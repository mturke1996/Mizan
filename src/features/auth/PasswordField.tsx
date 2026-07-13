import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

interface PasswordFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  helperText?: string;
  error?: string | null;
  labelAction?: ReactNode;
  minLength?: number;
  required?: boolean;
}

export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  placeholder,
  helperText,
  error,
  labelAction,
  minLength,
  required = true,
}: PasswordFieldProps) {
  const id = useId();
  const [isVisible, setIsVisible] = useState(false);
  const helperId = helperText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <label htmlFor={id} className="block text-sm font-bold text-ink">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          maxLength={128}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full rounded-sm border border-line bg-canvas px-4 pl-12 text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className="pressable absolute inset-y-0 left-0 grid w-12 place-items-center rounded-xs text-muted hover:bg-surface-strong hover:text-ink"
          aria-label={isVisible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          aria-pressed={isVisible}
        >
          {isVisible ? (
            <EyeOff className="size-4.5" aria-hidden="true" />
          ) : (
            <Eye className="size-4.5" aria-hidden="true" />
          )}
        </button>
      </div>
      {helperText ? (
        <p id={helperId} className="mt-2 text-xs leading-5 text-muted">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
