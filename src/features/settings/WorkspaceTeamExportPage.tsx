import { Download, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDebtsView } from "@/features/debts/use-debts-view";
import {
  useFinanceView,
  useProjectsView,
} from "@/features/workspace/use-finance-view";
import { useWorkspace } from "@/features/workspace/use-workspace";
import { createWorkspaceInviteRpc } from "@/features/workspace/workspace-api";
import {
  downloadCsv,
  exportDebtsCsv,
  exportProjectSummaryCsv,
  exportTransactionsCsv,
  exportWalletsCsv,
} from "@/lib/csv-export";
import { getUserErrorMessage } from "@/lib/user-error";
import { AppCard } from "@/shared/ui/AppCard";
import { PageHeader } from "@/shared/ui/PageHeader";

export function WorkspaceTeamExportPage() {
  const { workspaceId, membership } = useWorkspace();
  const { wallets, transactions } = useFinanceView();
  const { projects } = useProjectsView();
  const { debts } = useDebtsView();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canInvite =
    membership?.role === "owner" || membership?.role === "admin";

  const exportAll = () => {
    downloadCsv(
      "mizan-transactions.csv",
      exportTransactionsCsv(transactions),
    );
    downloadCsv("mizan-wallets.csv", exportWalletsCsv(wallets));
    downloadCsv(
      "mizan-debts.csv",
      exportDebtsCsv(
        debts.map((debt) => ({
          partyName: debt.partyName,
          direction: debt.direction,
          status: debt.status,
          balanceMinor: debt.balanceMinor,
          currencyCode: debt.currencyCode,
          dueOn: debt.dueOn,
        })),
      ),
    );
    downloadCsv(
      "mizan-projects.csv",
      exportProjectSummaryCsv(
        projects.map((project) => ({
          name: project.name,
          incomeMinor: project.incomeMinor,
          expenseMinor: project.expenseMinor,
          profitMinor: project.profitMinor,
          capitalMinor: project.capitalMinor,
          outstandingLaborMinor: project.outstandingLaborMinor,
        })),
      ),
    );
    toast.success("تم تنزيل ملفات CSV");
  };

  const invite = async () => {
    if (!workspaceId || !canInvite) return;
    if (!email.trim()) {
      toast.error("أدخل البريد الإلكتروني");
      return;
    }
    setBusy(true);
    try {
      const inviteRow = await createWorkspaceInviteRpc({
        workspaceId,
        email: email.trim(),
        role,
      });
      setInviteToken(inviteRow.token);
      toast.success("تم إنشاء الدعوة");
    } catch (error) {
      toast.error(getUserErrorMessage(error, "تعذر إنشاء الدعوة"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 sm:px-6">
      <PageHeader
        backTo="/settings"
        subtitle="تصدير هادئ ودعوة أعضاء بمساحتك."
        title="الفريق والتصدير"
      />

      <AppCard className="mb-4 space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <Download aria-hidden="true" size={18} />
          تصدير CSV
        </h2>
        <p className="text-xs leading-5 text-muted">
          معاملات، محافظ، ديون، وملخص المشاريع — تنزيل محلي من جهازك.
        </p>
        <button
          className="pressable min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on"
          onClick={exportAll}
          type="button"
        >
          تنزيل التصدير
        </button>
      </AppCard>

      <AppCard className="space-y-3 p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink">
          <UserPlus aria-hidden="true" size={18} />
          دعوة عضو
        </h2>
        {!canInvite ? (
          <p className="text-xs text-muted">
            الدعوة متاحة لمالك المساحة أو المدير فقط.
          </p>
        ) : (
          <>
            <input
              aria-label="بريد المدعو"
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email@example.com"
              type="email"
              value={email}
            />
            <select
              aria-label="دور المدعو"
              className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-sm"
              onChange={(event) =>
                setRole(event.target.value as typeof role)
              }
              value={role}
            >
              <option value="member">عضو</option>
              <option value="admin">مدير</option>
              <option value="viewer">مشاهد</option>
            </select>
            <button
              className="pressable min-h-11 rounded-sm bg-primary px-4 text-sm font-bold text-primary-on disabled:opacity-60"
              disabled={busy || !workspaceId}
              onClick={() => void invite()}
              type="button"
            >
              إنشاء رابط دعوة
            </button>
            {inviteToken ? (
              <p className="rounded-sm bg-surface-subtle p-3 text-xs leading-5 text-muted">
                رابط الدعوة:{" "}
                <code className="numeric break-all text-ink" dir="ltr">
                  {`${window.location.origin}/invites/${inviteToken}`}
                </code>
              </p>
            ) : null}
          </>
        )}
      </AppCard>
    </div>
  );
}
