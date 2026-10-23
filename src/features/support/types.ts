/**
 * Support access contract (roadmap 2.3). Mirrors the backend views in
 * `supportAccess.service.js` and `supportDiagnostics.service.js`.
 */

export type SupportGrantKind = "consent" | "break_glass";
export type SupportGrantStatus = "pending" | "active" | "denied" | "revoked" | "expired";
export type SupportSessionStatus = "active" | "ended" | "expired";

export interface SupportPartyRef {
  id: string | null;
  display: string | null;
}

/** A consent or break-glass grant. */
export interface SupportGrant {
  id: string;
  tenantId: string;
  kind: SupportGrantKind;
  breakGlass: boolean;
  status: SupportGrantStatus;
  reason: string | null;
  ticket: string | null;
  grantedBy: SupportPartyRef | null;
  requestedBy: SupportPartyRef | null;
  decidedBy: SupportPartyRef | null;
  decidedAt: string | null;
  decisionReason: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByType: "user" | "admin" | "system" | null;
  revokedReason: string | null;
  createdAt: string | null;
  endedSessions?: string[];
}

/** The durable record of one read-only support session. */
export interface SupportSessionRecord {
  id: string;
  tenantId: string;
  status: SupportSessionStatus;
  user: SupportPartyRef;
  operator: SupportPartyRef;
  grantId: string;
  kind: SupportGrantKind;
  breakGlass: boolean;
  readOnly: boolean;
  reason: string;
  ticket: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedReason: string | null;
}

/** GET /workspace/support-access */
export interface WorkspaceSupportAccess {
  active: SupportGrant | null;
  grants: SupportGrant[];
  grantsMeta?: { page: number; limit: number; total: number; pages: number };
  sessions: SupportSessionRecord[];
  maxHours: number;
}

/** One row of the workspace's support activity (audit history). */
export interface SupportActivityRow {
  id: string;
  occurredAt: string;
  module: string;
  action: string;
  result: "success" | "failure";
  actor: { type: string; id: string | null; display: string | null };
  impersonatedBy: string | null;
  resource: { type: string; id: string | null } | null;
  reason: string | null;
}

/** GET /support-session */
export interface CurrentSupportSession {
  active: boolean;
  sessionId?: string;
  readOnly?: boolean;
  breakGlass?: boolean;
  operator?: SupportPartyRef;
  user?: SupportPartyRef;
  startedAt?: string | null;
  expiresAt?: string | null;
  reason?: string | null;
  ticket?: string | null;
}

/** POST /support/impersonate response. */
export interface ImpersonationStart {
  token: string;
  expiresAt: string;
  expiresIn: number;
  sessionId: string;
  impersonation: true;
  readOnly: true;
  breakGlass: boolean;
  grantId: string;
  user: { id: string; email: string; name: string | null; tenantId: string };
  startedAt: string;
}

export interface UsageMetric {
  current?: number;
  limit?: number | null;
  percent?: number | null;
  status?: string;
  warning?: boolean;
  overLimit?: boolean;
  [key: string]: unknown;
}

/** GET /support/tenants/:id/diagnostics */
export interface SupportDiagnostics {
  generatedAt: string;
  window: { hours: number; since: string };
  tenant: {
    id: string;
    name: string | null;
    slug: string | null;
    status: string | null;
    planId: string | null;
    onboardingStatus: string | null;
    defaultTimezone: string | null;
    createdAt: string | null;
    trialEndsAt: string | null;
    suspendedAt: string | null;
    disabledAt: string | null;
    archivedAt: string | null;
  };
  subscription: {
    plan: { code?: string; name?: string; displayName?: string } | null;
    state: string | null;
    writeBlocked: boolean;
    warnings: string[];
    error: string | null;
  };
  usage: Record<string, UsageMetric>;
  users: { total: number; byStatus: Record<string, number>; activeSessions: number };
  connectors: {
    total: number;
    byStatus: Record<string, number>;
    withErrors: number;
    items: Array<{
      id: string;
      type: string | null;
      name: string | null;
      status: string | null;
      syncStatus: string | null;
      lastSyncedAt: string | null;
      errorCount: number;
      lastError: string | null;
    }>;
  };
  syncRuns: {
    failedInWindow: number;
    recent: Array<{
      id: string;
      connectorId: string | null;
      trigger: string | null;
      status: string | null;
      finishedAt: string | null;
      durationMs: number | null;
      error: { code: string | null; message: string | null } | null;
    }>;
  };
  requests: {
    total: number;
    clientErrors: number;
    serverErrors: number;
    errorRate: number;
    byStatus: Array<{ statusCode: number; count: number }>;
    topErrors: Array<{ path: string; statusCode: number; count: number }>;
  };
  broken: { widgets: number; reports: number; alerts: number };
  supportAccess: {
    active: {
      id: string;
      kind: SupportGrantKind;
      breakGlass: boolean;
      status: SupportGrantStatus;
      expiresAt: string | null;
    } | null;
    pendingBreakGlass: number;
    openSessions: number;
  };
}

/** Error codes the support UI branches on. */
export const SUPPORT_ERROR_CODES = {
  READ_ONLY: "IMPERSONATION_READ_ONLY",
  SESSION_REQUIRED: "IMPERSONATION_SESSION_REQUIRED",
  CONSENT_REQUIRED: "SUPPORT_CONSENT_REQUIRED",
  TARGET_PROTECTED: "SUPPORT_TARGET_PROTECTED",
  CAP_EXCEEDED: "SUPPORT_IMPERSONATION_CAP_EXCEEDED",
  APPROVAL_DENIED: "BREAK_GLASS_APPROVAL_DENIED",
  GRANT_NOT_ACTIVE: "SUPPORT_GRANT_NOT_ACTIVE",
} as const;
