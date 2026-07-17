import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { SignupPage } from "@/features/auth/SignupPage";
import { UpdatePasswordPage } from "@/features/auth/UpdatePasswordPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { DebtDetailPage } from "@/features/debts/DebtDetailPage";
import { DebtFormPage } from "@/features/debts/DebtFormPage";
import { DebtsPage } from "@/features/debts/DebtsPage";
import { ProjectDetailPage } from "@/features/projects/ProjectDetailPage";
import { ProjectFormPage } from "@/features/projects/ProjectFormPage";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { SupervisorShell } from "@/features/supervisor/SupervisorShell";
import { TransactionDetailPage } from "@/features/transactions/TransactionDetailPage";
import { TransactionFormPage } from "@/features/transactions/TransactionFormPage";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import { TransferPage } from "@/features/transfer/TransferPage";
import { WalletDetailPage } from "@/features/wallets/WalletDetailPage";
import { WalletFormPage } from "@/features/wallets/WalletFormPage";
import { WalletsPage } from "@/features/wallets/WalletsPage";
import { AppShell } from "./AppShell";

const AnalyticsPage = lazy(() =>
  import("@/features/analytics/AnalyticsPage").then((module) => ({
    default: module.AnalyticsPage,
  })),
);
const NotificationsPage = lazy(() =>
  import("@/features/notifications/NotificationsPage").then((module) => ({
    default: module.NotificationsPage,
  })),
);
const ProfileSettingsPage = lazy(() =>
  import("@/features/settings/ProfileSettingsPage").then((module) => ({
    default: module.ProfileSettingsPage,
  })),
);
const SubscriptionSettingsPage = lazy(() =>
  import("@/features/settings/SubscriptionSettingsPage").then((module) => ({
    default: module.SubscriptionSettingsPage,
  })),
);
const NotificationSettingsPage = lazy(() =>
  import("@/features/settings/SettingsInfoPages").then((module) => ({
    default: module.NotificationSettingsPage,
  })),
);
const SyncSettingsPage = lazy(() =>
  import("@/features/settings/SettingsInfoPages").then((module) => ({
    default: module.SyncSettingsPage,
  })),
);
const SecuritySettingsPage = lazy(() =>
  import("@/features/settings/SettingsInfoPages").then((module) => ({
    default: module.SecuritySettingsPage,
  })),
);
const CurrencySettingsPage = lazy(() =>
  import("@/features/settings/SettingsInfoPages").then((module) => ({
    default: module.CurrencySettingsPage,
  })),
);
const HelpSettingsPage = lazy(() =>
  import("@/features/settings/SettingsInfoPages").then((module) => ({
    default: module.HelpSettingsPage,
  })),
);
const InviteAcceptPage = lazy(() =>
  import("@/features/settings/InviteAcceptPage").then((module) => ({
    default: module.InviteAcceptPage,
  })),
);
const WorkspaceTeamExportPage = lazy(() =>
  import("@/features/settings/WorkspaceTeamExportPage").then((module) => ({
    default: module.WorkspaceTeamExportPage,
  })),
);
const IncomePage = lazy(() =>
  import("@/features/income/IncomePage").then((module) => ({
    default: module.IncomePage,
  })),
);
const IncomeSourceFormPage = lazy(() =>
  import("@/features/income/IncomeSourceFormPage").then((module) => ({
    default: module.IncomeSourceFormPage,
  })),
);
const IncomeSourceDetailPage = lazy(() =>
  import("@/features/income/IncomeSourceDetailPage").then((module) => ({
    default: module.IncomeSourceDetailPage,
  })),
);
const ClientsPage = lazy(() =>
  import("@/features/clients/ClientsPage").then((module) => ({
    default: module.ClientsPage,
  })),
);
const ClientDetailPage = lazy(() =>
  import("@/features/clients/ClientDetailPage").then((module) => ({
    default: module.ClientDetailPage,
  })),
);
const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((module) => ({
    default: module.ReportsPage,
  })),
);
const BudgetsPage = lazy(() =>
  import("@/features/analytics/BudgetsPage").then((module) => ({
    default: module.BudgetsPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("@/features/invoices/InvoicesPage").then((module) => ({
    default: module.InvoicesPage,
  })),
);
const InvoiceFormPage = lazy(() =>
  import("@/features/invoices/InvoiceFormPage").then((module) => ({
    default: module.InvoiceFormPage,
  })),
);
const InvoiceDetailPage = lazy(() =>
  import("@/features/invoices/InvoiceDetailPage").then((module) => ({
    default: module.InvoiceDetailPage,
  })),
);
const BusinessBrandingPage = lazy(() =>
  import("@/features/settings/BusinessBrandingPage").then((module) => ({
    default: module.BusinessBrandingPage,
  })),
);
const CategoriesSettingsPage = lazy(() =>
  import("@/features/settings/CategoriesSettingsPage").then((module) => ({
    default: module.CategoriesSettingsPage,
  })),
);
const RecurringSettingsPage = lazy(() =>
  import("@/features/settings/RecurringSettingsPage").then((module) => ({
    default: module.RecurringSettingsPage,
  })),
);
const SupervisorAuditPage = lazy(() =>
  import("@/features/supervisor/SupervisorAuditPage").then((module) => ({
    default: module.SupervisorAuditPage,
  })),
);
const SupervisorCustomersPage = lazy(() =>
  import("@/features/supervisor/SupervisorCustomersPage").then((module) => ({
    default: module.SupervisorCustomersPage,
  })),
);
const SupervisorMessagesPage = lazy(() =>
  import("@/features/supervisor/SupervisorMessagesPage").then((module) => ({
    default: module.SupervisorMessagesPage,
  })),
);
const SupervisorOperationsPage = lazy(() =>
  import("@/features/supervisor/SupervisorOperationsPage").then((module) => ({
    default: module.SupervisorOperationsPage,
  })),
);
const SupervisorPaymentsPage = lazy(() =>
  import("@/features/supervisor/SupervisorPaymentsPage").then((module) => ({
    default: module.SupervisorPaymentsPage,
  })),
);
const SupervisorPlansPage = lazy(() =>
  import("@/features/supervisor/SupervisorPlansPage").then((module) => ({
    default: module.SupervisorPlansPage,
  })),
);
const SupervisorRevenuePage = lazy(() =>
  import("@/features/supervisor/SupervisorRevenuePage").then((module) => ({
    default: module.SupervisorRevenuePage,
  })),
);
const SupervisorSubscriptionsPage = lazy(() =>
  import("@/features/supervisor/SupervisorSubscriptionsPage").then((module) => ({
    default: module.SupervisorSubscriptionsPage,
  })),
);
const SupervisorWorkspacesPage = lazy(() =>
  import("@/features/supervisor/SupervisorWorkspacesPage").then((module) => ({
    default: module.SupervisorWorkspacesPage,
  })),
);

function DeferredPage({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-64 place-items-center" role="status">
          <div className="text-center">
            <div className="mx-auto mb-3 h-2 w-28 animate-pulse rounded-full bg-primary-soft" />
            <p className="text-sm text-muted">جاري تحميل الصفحة…</p>
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="auth/login" element={<LoginPage />} />
      <Route path="auth/signup" element={<SignupPage />} />
      <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="auth/update-password" element={<UpdatePasswordPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<SupervisorShell />}>
          <Route
            path="supervisor"
            element={
              <DeferredPage>
                <SupervisorOperationsPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/payments"
            element={
              <DeferredPage>
                <SupervisorPaymentsPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/plans"
            element={
              <DeferredPage>
                <SupervisorPlansPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/revenue"
            element={
              <DeferredPage>
                <SupervisorRevenuePage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/messages"
            element={
              <DeferredPage>
                <SupervisorMessagesPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/customers"
            element={
              <DeferredPage>
                <SupervisorCustomersPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/subscriptions"
            element={
              <DeferredPage>
                <SupervisorSubscriptionsPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/workspaces"
            element={
              <DeferredPage>
                <SupervisorWorkspacesPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/users"
            element={<Navigate to="/supervisor/customers" replace />}
          />
          <Route
            path="supervisor/audit"
            element={
              <DeferredPage>
                <SupervisorAuditPage />
              </DeferredPage>
            }
          />
          <Route
            path="supervisor/activity"
            element={<Navigate to="/supervisor/audit" replace />}
          />
          <Route
            path="supervisor/*"
            element={<Navigate to="/supervisor" replace />}
          />
        </Route>

        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/new" element={<TransactionFormPage />} />
          <Route
            path="transactions/:transactionId/edit"
            element={<TransactionFormPage />}
          />
          <Route
            path="transactions/:transactionId"
            element={<TransactionDetailPage />}
          />
          <Route path="debts" element={<DebtsPage />} />
          <Route path="debts/new" element={<DebtFormPage />} />
          <Route path="debts/:debtId" element={<DebtDetailPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<ProjectFormPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="wallets" element={<WalletsPage />} />
          <Route path="wallets/new" element={<WalletFormPage />} />
          <Route path="wallets/:walletId" element={<WalletDetailPage />} />
          <Route
            path="income"
            element={
              <DeferredPage>
                <IncomePage />
              </DeferredPage>
            }
          />
          <Route
            path="income/new"
            element={
              <DeferredPage>
                <IncomeSourceFormPage />
              </DeferredPage>
            }
          />
          <Route
            path="income/:sourceId"
            element={
              <DeferredPage>
                <IncomeSourceDetailPage />
              </DeferredPage>
            }
          />
          <Route
            path="clients"
            element={
              <DeferredPage>
                <ClientsPage />
              </DeferredPage>
            }
          />
          <Route
            path="clients/:clientId"
            element={
              <DeferredPage>
                <ClientDetailPage />
              </DeferredPage>
            }
          />
          <Route
            path="invoices"
            element={
              <DeferredPage>
                <InvoicesPage />
              </DeferredPage>
            }
          />
          <Route
            path="invoices/new"
            element={
              <DeferredPage>
                <InvoiceFormPage />
              </DeferredPage>
            }
          />
          <Route
            path="invoices/:invoiceId/edit"
            element={
              <DeferredPage>
                <InvoiceFormPage />
              </DeferredPage>
            }
          />
          <Route
            path="invoices/:invoiceId"
            element={
              <DeferredPage>
                <InvoiceDetailPage />
              </DeferredPage>
            }
          />
          <Route
            path="analytics"
            element={
              <DeferredPage>
                <AnalyticsPage />
              </DeferredPage>
            }
          />
          <Route
            path="reports"
            element={
              <DeferredPage>
                <ReportsPage />
              </DeferredPage>
            }
          />
          <Route
            path="budgets"
            element={
              <DeferredPage>
                <BudgetsPage />
              </DeferredPage>
            }
          />
          <Route path="transfer" element={<TransferPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="settings/profile"
            element={
              <DeferredPage>
                <ProfileSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/business"
            element={
              <DeferredPage>
                <BusinessBrandingPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/categories"
            element={
              <DeferredPage>
                <CategoriesSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/recurring"
            element={
              <DeferredPage>
                <RecurringSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/subscription"
            element={
              <DeferredPage>
                <SubscriptionSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/notifications"
            element={
              <DeferredPage>
                <NotificationSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/team-export"
            element={
              <DeferredPage>
                <WorkspaceTeamExportPage />
              </DeferredPage>
            }
          />
          <Route
            path="invites/:token"
            element={
              <DeferredPage>
                <InviteAcceptPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/sync"
            element={
              <DeferredPage>
                <SyncSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/security"
            element={
              <DeferredPage>
                <SecuritySettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/currency"
            element={
              <DeferredPage>
                <CurrencySettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="settings/help"
            element={
              <DeferredPage>
                <HelpSettingsPage />
              </DeferredPage>
            }
          />
          <Route
            path="notifications"
            element={
              <DeferredPage>
                <NotificationsPage />
              </DeferredPage>
            }
          />
          <Route path="settings/*" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
