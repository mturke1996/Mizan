import { FolderSearch } from "lucide-react";
import { AppCard } from "@/shared/ui/AppCard";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { PageHeader } from "@/shared/ui/PageHeader";

const shellClassName = "mx-auto max-w-7xl px-4 sm:px-6";

export function ProjectDetailLoadingState() {
  return (
    <div className={shellClassName}>
      <PageHeader
        title="تفاصيل المشروع"
        subtitle="جاري تحميل السجل المالي للمشروع."
        backTo="/projects"
      />
      <div
        aria-label="جاري تحميل تفاصيل المشروع"
        className="space-y-4"
        role="status"
      >
        <AppCard className="h-72 animate-pulse bg-surface-subtle motion-reduce:animate-none" />
        <AppCard className="h-12 animate-pulse bg-surface-subtle motion-reduce:animate-none" />
        <AppCard className="h-64 animate-pulse bg-surface-subtle motion-reduce:animate-none" />
      </div>
    </div>
  );
}

export function ProjectDetailErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className={shellClassName}>
      <PageHeader
        title="تفاصيل المشروع"
        subtitle="تعذر فتح السجل المالي الكامل للمشروع."
        backTo="/projects"
      />
      <ErrorState message={message} onRetry={onRetry} />
    </div>
  );
}

export function ProjectDetailNotFoundState() {
  return (
    <div className={shellClassName}>
      <PageHeader
        title="المشروع غير موجود"
        subtitle="قد يكون المشروع حُذف أو تغيّر رابطه."
        backTo="/projects"
      />
      <EmptyState
        description="ارجع إلى قائمة المشاريع واختر مشروعًا متاحًا."
        icon={<FolderSearch aria-hidden="true" size={22} />}
        title="لم نعثر على هذا المشروع"
      />
    </div>
  );
}
