import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAcceptWorkspaceInviteMutation } from "@/features/workspace/use-finance-data";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

export function InviteAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { refresh } = useWorkspace();
  const acceptInvite = useAcceptWorkspaceInviteMutation();
  const started = useRef(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        await acceptInvite.mutateAsync({
          token,
          clientId: crypto.randomUUID(),
        });
        await refresh();
        toast.success("تم قبول الدعوة والانضمام للمساحة");
        navigate("/", { replace: true });
      } catch (error) {
        setFailedMessage(getUserErrorMessage(error, "تعذر قبول الدعوة"));
        toast.error(getUserErrorMessage(error, "تعذر قبول الدعوة"));
      }
    })();
  }, [token, acceptInvite, navigate, refresh]);

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        backTo="/"
        subtitle="قبول دعوة الانضمام إلى مساحة عمل."
        title="قبول الدعوة"
      />
      <AppCard className="space-y-3 p-4 sm:p-5">
        {!token ? (
          <p className="text-sm text-muted">رابط الدعوة غير صالح.</p>
        ) : failedMessage ? (
          <div className="space-y-3">
            <p className="text-sm text-danger">{failedMessage}</p>
            <Link className="text-sm font-bold text-primary" to="/">
              العودة للرئيسية
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">جارٍ قبول الدعوة…</p>
        )}
      </AppCard>
    </div>
  );
}
