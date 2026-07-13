export type CustomerDeliveryMode =
  | "invite"
  | "temporary_password"
  | "password_setup_email";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "grace"
  | "frozen"
  | "expired"
  | "cancelled";

export type AccountStatus = "active" | "suspended" | "disabled";

export type WorkspaceStatus = "active" | "suspended" | "archived";

export type BillingInterval = "none" | "monthly" | "yearly";

export interface SupervisorCustomerRow {
  userId: string;
  email: string;
  displayName: string | null;
  accountStatus: AccountStatus;
  lastSignInAt: string | null;
  workspaceId: string;
  workspaceName: string;
  currencyCode: string;
  workspaceStatus: WorkspaceStatus;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  planId: string;
  planName: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  scheduledStatus: "cancelled" | "expired" | null;
  scheduledStatusAt: string | null;
  effectiveSubscriptionStatus: SubscriptionStatus;
  pendingPayments: number;
  createdAt: string;
}

export interface CreateCustomerInput {
  email: string;
  displayName: string;
  workspaceName: string;
  currencyCode: string;
  planId: string;
  subscriptionStatus: SubscriptionStatus;
  startsAt: string;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  deliveryMode: CustomerDeliveryMode;
  note: string;
  clientId: string;
}

export interface PlanSubscriptionCounts {
  trialing: number;
  active: number;
  grace: number;
  frozen: number;
  expired: number;
  cancelled: number;
}

export interface AdminPlan {
  planId: string;
  code: string;
  name: string;
  priceMinor: number;
  currencyCode: string;
  billingInterval: BillingInterval;
  intervalCount: number | null;
  trialDays: number;
  isPublic: boolean;
  isActive: boolean;
  features: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  subscriptionCounts: PlanSubscriptionCounts;
}

export interface CreatePlanInput {
  code: string;
  name: string;
  priceMinor: number;
  currencyCode: string;
  billingInterval: BillingInterval;
  intervalCount: number | null;
  trialDays: number;
  isPublic: boolean;
  features: Record<string, unknown>;
  note: string;
  clientId: string;
}

export interface UpdatePlanInput {
  planId: string;
  name: string;
  priceMinor: number;
  currencyCode: string;
  billingInterval: BillingInterval;
  intervalCount: number | null;
  trialDays: number;
  isPublic: boolean;
  features: Record<string, unknown>;
  note: string;
  clientId: string;
}

export interface ActionInput {
  planId: string;
  note: string;
  clientId: string;
}

export interface RenewInput {
  workspaceId: string;
  periodCount: number;
  note: string;
  clientId: string;
}

export interface ChangePlanInput {
  workspaceId: string;
  planId: string;
  note: string;
  clientId: string;
}

export interface StateInput {
  workspaceId: string;
  targetStatus: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  graceEndsAt: string | null;
  note: string;
  clientId: string;
}

export interface ScheduledStateInput {
  workspaceId: string;
  targetStatus: "cancelled" | "expired";
  scheduledAt: string;
  note: string;
  clientId: string;
}
