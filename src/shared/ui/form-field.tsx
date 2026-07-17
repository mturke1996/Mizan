import { clsx } from "clsx";
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export const controlClassName =
  "min-h-11 w-full rounded-md border border-control-border bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:focus:ring-danger/20";

export const controlNumericClassName = clsx(
  controlClassName,
  "numeric text-left",
);

export const controlTextareaClassName = clsx(
  controlClassName,
  "min-h-24 resize-y py-2.5 leading-6",
);

interface FieldShellProps {
  label?: string;
  htmlFor?: string;
  helperText?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FieldShell({
  label,
  htmlFor,
  helperText,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const helperId = helperText ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={clsx("space-y-1.5", className)}>
      {label ? (
        <label
          className="block text-xs font-bold text-muted"
          htmlFor={fieldId}
        >
          {label}
          {required ? (
            <span aria-hidden="true" className="ms-1 text-danger">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {helperText && !error ? (
        <p className="text-xs leading-5 text-muted" id={helperId}>
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs leading-5 text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
  inputClassName?: string;
};

export function TextField({
  label,
  helperText,
  error,
  className,
  inputClassName,
  id,
  required,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helperText ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldShell
      className={className}
      error={error}
      helperText={helperText}
      htmlFor={fieldId}
      label={label}
      required={required}
    >
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error) || undefined}
        className={clsx(controlClassName, inputClassName)}
        id={fieldId}
        required={required}
        {...props}
      />
    </FieldShell>
  );
}

type MoneyFieldProps = Omit<TextFieldProps, "type" | "inputMode" | "dir"> & {
  currency?: string;
};

export function MoneyField({
  currency,
  label,
  helperText,
  inputClassName,
  ...props
}: MoneyFieldProps) {
  return (
    <TextField
      dir="ltr"
      helperText={helperText}
      inputClassName={clsx("numeric text-left", inputClassName)}
      inputMode="decimal"
      label={label && currency ? `${label} (${currency})` : label}
      type="text"
      {...props}
    />
  );
}

type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className"
> & {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
  selectClassName?: string;
  children: ReactNode;
};

export function SelectField({
  label,
  helperText,
  error,
  className,
  selectClassName,
  id,
  required,
  children,
  ...props
}: SelectFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helperText ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldShell
      className={className}
      error={error}
      helperText={helperText}
      htmlFor={fieldId}
      label={label}
      required={required}
    >
      <select
        aria-describedby={describedBy}
        aria-invalid={Boolean(error) || undefined}
        className={clsx(controlClassName, selectClassName)}
        id={fieldId}
        required={required}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

type TextareaFieldProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className"
> & {
  label?: string;
  helperText?: string;
  error?: string | null;
  className?: string;
  textareaClassName?: string;
};

export function TextareaField({
  label,
  helperText,
  error,
  className,
  textareaClassName,
  id,
  required,
  ...props
}: TextareaFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const helperId = helperText ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy =
    [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldShell
      className={className}
      error={error}
      helperText={helperText}
      htmlFor={fieldId}
      label={label}
      required={required}
    >
      <textarea
        aria-describedby={describedBy}
        aria-invalid={Boolean(error) || undefined}
        className={clsx(controlTextareaClassName, textareaClassName)}
        id={fieldId}
        required={required}
        {...props}
      />
    </FieldShell>
  );
}
