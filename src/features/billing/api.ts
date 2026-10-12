/**
 * Phase 6 - Workspace billing API client.
 *
 * PURPOSE
 *   Typed wrappers for the workspace subscription / entitlement
 *   surface (`/tenants/:id/subscription`, `/tenants/:id/entitlements`,
 *   `/tenants/:id/usage`). The backend is the source of truth; this
 *   module only shapes requests and responses.
 *
 * SECURITY
 *   - All calls go through the existing `request()` helper which
 *     attaches the tenant bearer token. The tenant isolation
 *     middleware on the server enforces the `:id` URL parameter
 *     matches the authenticated user.
 *   - No payment-provider calls are made from the workspace; the
 *     "Upgrade" CTA returns an honest 501-equivalent from the
 *     `noop` provider via the admin checkout endpoint.
 */

import { request } from "@/lib/api/client";
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

export interface UsageSummary {
  tenantId: string;
  plan: EntitlementResolved["plan"];
  state: string;
  writeBlocked: boolean;
  usage: Record<string, { current: number; limit: number | null; hard: boolean }>;
  resolvedAt: string;
}

export function getSubscription(tenantId: string) {
  return request<SubscriptionSummary>(`/tenants/${tenantId}/subscription`, { audience });
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
