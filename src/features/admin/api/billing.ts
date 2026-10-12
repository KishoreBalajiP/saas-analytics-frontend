/**
 * Phase 6 - Platform Admin billing API client.
 *
 * PURPOSE
 *   Typed wrappers for the platform-admin plan / subscription /
 *   entitlement surface (`/admin/plans`, `/admin/subscriptions`,
 *   `/admin/entitlements`). All calls use the admin bearer token.
 *
 * SECURITY
 *   - All mutations are permission-gated on the backend
 *     (`billing.plans.*`, `billing.subscriptions.override`,
 *     `billing.entitlements.override`). The frontend uses the
 *     permission catalogue only as a UX gate.
 *   - Override writes are subject to a server-side safety net
 *     (`OVERRIDE_SAFETY_FACTOR`); a runaway value is clamped to
 *     `highest plan limit * 1000` and the clamp is recorded in the
 *     audit trail.
 */

import { request } from "@/lib/api/client";
import type { Query } from "@/lib/api/client";

const audience = "admin" as const;

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  data: {
    displayName?: string;
    description?: string;
    status: "active" | "disabled" | "archived" | "deprecated";
    tier: number;
    trialDays: number | null;
    graceDays: number | null;
    features: Record<string, boolean>;
    limits: Record<string, { max: number; hard: boolean }>;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminSubscription {
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
}

export interface Override {
  id: string;
  tenantId: string;
  metric: string | null;
  kind: "feature" | "limit";
  valueKind: "boolean" | "object";
  value: unknown;
  reason: string;
  expiresAt: string | null;
  grantedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export function listPlans(query: Query = {}) {
  return request<Plan[]>("/admin/plans", { audience, query });
}

export function getPlan(id: string) {
  return request<Plan>(`/admin/plans/${id}`, { audience });
}

export function createPlan(body: {
  code: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  data: Plan["data"];
}) {
  return request<Plan>("/admin/plans", {
    audience,
    method: "POST",
    body,
  });
}

export function updatePlan(
  id: string,
  body: Partial<{ name: string; description: string; data: Plan["data"]; isSystem: boolean }>,
) {
  return request<Plan>(`/admin/plans/${id}`, {
    audience,
    method: "PATCH",
    body,
  });
}

export function archivePlan(id: string) {
  return request<Plan>(`/admin/plans/${id}/archive`, {
    audience,
    method: "POST",
  });
}

export function disablePlan(id: string) {
  return request<Plan>(`/admin/plans/${id}/disable`, {
    audience,
    method: "POST",
  });
}

export function enablePlan(id: string) {
  return request<Plan>(`/admin/plans/${id}/enable`, {
    audience,
    method: "POST",
  });
}

export function ensureDefaultPlans() {
  return request<{ created: Plan[]; total: number }>("/admin/plans/ensure-defaults", {
    audience,
    method: "POST",
  });
}

export function listSubscriptions(query: Query = {}) {
  return request<AdminSubscription[]>("/admin/subscriptions", {
    audience,
    query,
  });
}

export function getSubscription(tenantId: string) {
  return request<AdminSubscription | null>(`/admin/subscriptions/${tenantId}`, { audience });
}

export function getSubscriptionTimeline(tenantId: string, query: Query = {}) {
  return request<AdminSubscription[]>(`/admin/subscriptions/${tenantId}/timeline`, {
    audience,
    query,
  });
}

export function adminChangePlan(tenantId: string, body: { planId: string; reason: string }) {
  return request<AdminSubscription>(`/admin/subscriptions/${tenantId}/change-plan`, {
    audience,
    method: "POST",
    body,
  });
}

export function adminSetState(
  tenantId: string,
  body: { state: AdminSubscription["state"]; reason: string; graceEndsAt?: string },
) {
  return request<AdminSubscription>(`/admin/subscriptions/${tenantId}/set-state`, {
    audience,
    method: "POST",
    body,
  });
}

export function adminCheckout(tenantId: string, body: { planId: string }) {
  return request<unknown>(`/admin/subscriptions/${tenantId}/checkout`, {
    audience,
    method: "POST",
    body,
  });
}

export interface PaymentTransaction {
  _id: string;
  tenantId: string;
  planId: string;
  amountMinor: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  receipt: string;
  status: "pending" | "captured" | "failed" | "refunded";
  failureReason: string | null;
  capturedAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  lastReconciledAt: string | null;
  reconcileAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEventSummary {
  id: string;
  eventId: string;
  eventType: string;
  processed: boolean;
  error: string | null;
  processedAt: string | null;
  summary: Record<string, unknown> | null;
  createdAt: string;
}

export function listTransactions(tenantId: string, query: Query = {}) {
  return request<PaymentTransaction[]>(`/admin/subscriptions/${tenantId}/transactions`, {
    audience,
    query,
  });
}

export function listWebhooks(tenantId: string, query: Query = {}) {
  return request<WebhookEventSummary[]>(`/admin/subscriptions/${tenantId}/webhooks`, {
    audience,
    query,
  });
}

export function triggerReconcile(query: Query = {}) {
  return request<{
    ok: boolean;
    checked: number;
    captured: number;
    failed: number;
    stale: number;
    skipped: number;
    errors: number;
  }>("/admin/subscriptions/reconcile", { audience, method: "POST", query });
}

export function listAllOverrides(query: Query = {}) {
  return request<Override[]>("/admin/entitlements/overrides", {
    audience,
    query,
  });
}

export function listTenantOverrides(tenantId: string, query: Query = {}) {
  return request<Override[]>(`/admin/entitlements/overrides/${tenantId}`, { audience, query });
}

export function createOverride(
  tenantId: string,
  body: {
    metric?: string | undefined;
    kind: "feature" | "limit";
    value: unknown;
    reason: string;
    expiresAt?: string | undefined;
  },
) {
  return request<Override>(`/admin/entitlements/overrides/${tenantId}`, {
    audience,
    method: "POST",
    body,
  });
}

export function revokeOverride(id: string, body: { reason: string }) {
  return request<Override>(`/admin/entitlements/overrides/${id}/revoke`, {
    audience,
    method: "POST",
    body,
  });
}
