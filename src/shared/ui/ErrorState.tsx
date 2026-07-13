import { AlertCircle, RefreshCw } from "lucide-react";

import { AppCard } from "./AppCard";

export function ErrorState({
  message,
  onRetry,
  title = "تعذر تحميل البيانات",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
    <AppCard role="alert" className="border-danger/20 bg-danger-soft p-5 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-sm bg-surface text-danger">
        <AlertCircle aria-hidden="true" size={22} />
      </span>
      <h2 className="mt-3 font-bold text-danger">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-danger">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="pressable mx-auto mt-4 flex min-h-11 items-center justify-center gap-2 rounded-sm bg-danger px-4 text-sm font-bold text-danger-on"
      >
        <RefreshCw aria-hidden="true" size={16} />
        إعادة المحاولة
      </button>
    </AppCard>
  );
}
