/**
 * Phase 6 - Workspace billing API client.
 *
 * PURPOSE
 *   Typed wrappers for the workspace subscription / entitlement
 *   surface (`/tenants/:id/subscription`, `/tenants/:id/entitlements`,
 *   `/tenants/:id/usage`). The backend is the source of truth; this
 *   module only shapes requests and responses.
 *
 * BILLING MODEL (roadmap 3.1)
 *   Prepaid terms: each checkout buys one monthly or annual term of a
 *   plan through a one-time Razorpay order. Nothing renews automatically.
 *   Paid access starts only after the provider-confirmed capture (verified
 *   webhook + server-side payment fetch); the browser callback only reports
 *   status, so the UI polls `getCheckoutStatus` until `phase: confirmed`.
 *
 * SECURITY
 *   - All calls go through the existing `request()` helper which
 *     attaches the tenant bearer token. The tenant isolation
 *     middleware on the server enforces the `:id` URL parameter
 *     matches the authenticated user.
 *   - Prices, terms and the provider mode come from the backend
 *     (`GET /tenants/:id/plans`); the client never sends an amount.
 */

import { request, requestPaged } from "@/lib/api/client";
import type { Query } from "@/lib/api/client";

const audience = "tenant" as const;

export interface SubscriptionSummary {
  id: string;
  tenantId: string;
  planId: string;
  state: "trialing" | "active" | "past_due" | "canceled" | "expired" | "restricted";
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  graceEndsAt: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentProvider: string | null;
  paymentReference: string | null;
  previousPlanId: string | null;
  previousState: string | null;
  stateChangedAt: string | null;
  lastReconciledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  billingInterval?: BillingInterval | null;
  adminHold?: boolean;
  scheduledChange?: ScheduledChange | null;
  /** Access computed by the server right now (state + period). */
  access?: SubscriptionAccess;
}

export type BillingInterval = "month" | "year";

export interface ScheduledChange {
  planId: string;
  effectiveAt: string | null;
  termEnd: string | null;
  interval: BillingInterval | null;
  source: "workspace" | "payment" | "admin" | null;
}

/** The effective state the backend enforces (computed on every check). */
export interface SubscriptionAccess {
  state: SubscriptionSummary["state"];
  planId: string;
  writeBlocked: boolean;
  inGrace: boolean;
  graceEndsAt: string | null;
  periodEnded: boolean;
  reason: string | null;
}

export interface SubscriptionTimelineEntry {
  _id: string;
  tenantId: string;
  type: string;
  fromState: string | null;
  toState: string | null;
  fromPlanId: string | null;
  toPlanId: string | null;
  reason: string | null;
  actor: { type: "admin" | "user" | "system"; id: string | null } | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

export interface EntitlementResolved {
  tenantId: string;
  plan: {
    id: string;
    code: string;
    name: string;
    displayName: string;
    tier: number;
    status: string;
  };
  subscription: {
    id: string;
    state: string;
    planId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    graceEndsAt: string | null;
  } | null;
  state: string;
  storedState?: string | null;
  access?: {
    inGrace: boolean;
    graceEndsAt: string | null;
    periodEnded: boolean;
    reason: string | null;
  };
  features: Record<string, boolean>;
  limits: Record<string, { max: number; hard: boolean }>;
  overrides: Array<{
    id: string;
    metric: string | null;
    kind: "feature" | "limit";
    value: unknown;
    reason: string;
    expiresAt: string | null;
    grantedBy: string;
  }>;
  writeBlocked: boolean;
  source: "catalog" | "fallback";
  resolvedAt: string;
}

/** Where a metric stands against its limit (computed by the backend). */
export type UsageStatus =
  "ok" | "warning" | "at_limit" | "over_limit" | "not_included" | "unlimited";

/** One metric of `GET /tenants/:id/usage`. */
export interface UsageMetric {
  current: number;
  /** null = unlimited (not governed by the plan). */
  limit: number | null;
  hard: boolean;
  /** "current" = resource count; "day" = metered per UTC day. */
  period: "current" | "day";
  periodKey: string;
  resetsAt: string | null;
  remaining: number | null;
  percent: number | null;
  included: boolean;
  warning: boolean;
  atLimit: boolean;
  overLimit: boolean;
  /** A hard limit is reached: further creates are refused. */
  blocked: boolean;
  status: UsageStatus;
}

export interface UsageSummary {
  tenantId: string;
  plan: EntitlementResolved["plan"];
  state: string;
  writeBlocked: boolean;
  /** Share of a limit (0-1) from which a metric is flagged as a warning. */
  warningThreshold: number;
  /** Metrics at or past the warning threshold. */
  warnings: string[];
  usage: Record<string, UsageMetric>;
  resolvedAt: string;
}

/** One prepaid term a plan sells. */
export interface PlanTermPrice {
  interval: BillingInterval;
  amountMinor: number;
  currency: string;
}

/** A plan of the catalogue as the pricing page shows it. */
export interface CatalogPlan {
  code: string;
  name: string;
  displayName: string;
  description: string;
  tier: number;
  trialDays: number;
  features: Record<string, boolean>;
  limits: Record<string, { max: number; hard: boolean }>;
  prices: PlanTermPrice[];
  purchasable: boolean;
}

/** What the checkout may say about the payment provider (from the backend). */
export interface CheckoutConfig {
  enabled: boolean;
  provider: string | null;
  /** "test" | "live" | null (null when payments are off). */
  environment: string | null;
  model: "prepaid_terms";
  intervals: BillingInterval[];
}

export interface PlansResponse {
  plans: CatalogPlan[];
  checkout: CheckoutConfig;
}

export interface CheckoutSession {
  transactionId: string;
  orderId: string;
  keyId: string;
  amountMinor: number;
  currency: string;
  planId: string;
  interval: BillingInterval;
  termMonths: number;
  environment: string | null;
  reused: boolean;
}

export type TransactionStatus =
  "pending" | "authorized" | "captured" | "failed" | "refunded" | "expired";

export interface BillingTransaction {
  id: string;
  planId: string;
  interval: BillingInterval;
  termMonths: number;
  amountMinor: number;
  currency: string;
  provider: string;
  orderId: string;
  paymentId: string | null;
  status: TransactionStatus;
  applied: boolean;
  failureReason: string | null;
  createdAt: string | null;
  capturedAt: string | null;
  appliedAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  expiredAt: string | null;
}

/** Where a checkout stands; `confirmed` once the paid term is applied. */
export type CheckoutPhase =
  "pending_confirmation" | "applying" | "confirmed" | "failed" | "expired" | "refunded";

export interface CheckoutStatus {
  phase: CheckoutPhase;
  transaction: BillingTransaction;
  subscription: SubscriptionSummary | null;
}

export interface VerifyResult extends CheckoutStatus {
  verified: boolean;
}

export function listPlans(tenantId: string) {
  return request<PlansResponse>(`/tenants/${tenantId}/plans`, { audience });
}

export function getSubscription(tenantId: string) {
  return request<SubscriptionSummary>(`/tenants/${tenantId}/subscription`, { audience });
}

export function createCheckout(
  tenantId: string,
  body: { planId: string; interval?: BillingInterval },
) {
  return request<CheckoutSession>(`/tenants/${tenantId}/subscription/checkout`, {
    audience,
    method: "POST",
    body,
  });
}

export function verifyPayment(
  tenantId: string,
  body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
) {
  return request<VerifyResult>(`/tenants/${tenantId}/subscription/verify`, {
    audience,
    method: "POST",
    body,
  });
}

export function getCheckoutStatus(tenantId: string, orderId: string) {
  return request<CheckoutStatus>(
    `/tenants/${tenantId}/subscription/checkout/${encodeURIComponent(orderId)}`,
    { audience },
  );
}

export function listTransactions(tenantId: string, query: Query = {}) {
  return requestPaged<BillingTransaction>(`/tenants/${tenantId}/subscription/transactions`, {
    audience,
    query,
  });
}

export function getSubscriptionTimeline(tenantId: string, query: Query = {}) {
  return request<SubscriptionTimelineEntry[]>(`/tenants/${tenantId}/subscription/timeline`, {
    audience,
    query,
  });
}

export function cancelSubscription(
  tenantId: string,
  body: { immediate?: boolean; reason?: string } = {},
) {
  return request<SubscriptionSummary>(`/tenants/${tenantId}/subscription/cancel`, {
    audience,
    method: "POST",
    body,
  });
}

export function changePlan(tenantId: string, body: { planId: string; reason?: string }) {
  return request<SubscriptionSummary>(`/tenants/${tenantId}/subscription/change-plan`, {
    audience,
    method: "POST",
    body,
  });
}

export function reactivateSubscription(tenantId: string) {
  return request<SubscriptionSummary>(`/tenants/${tenantId}/subscription/reactivate`, {
    audience,
    method: "POST",
  });
}

export function getEntitlements(tenantId: string) {
  return request<EntitlementResolved>(`/tenants/${tenantId}/entitlements`, { audience });
}

export function getUsage(tenantId: string) {
  return request<UsageSummary>(`/tenants/${tenantId}/usage`, {
    audience,
  });
}
