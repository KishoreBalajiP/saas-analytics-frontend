import type { AuditSeverity } from "@/lib/api/types";

/**
 * Filter state and query mapping for the admin audit and access-log viewers
 * (`components/AuditViews.tsx`).
 */

/**
 * Security event actions, mirroring `src/constants/securityEvents.js` in the
 * backend (the catalogue is the source of truth). Offered as quick filters.
 */
export const SECURITY_ACTIONS = [
  "auth.login.succeeded",
  "auth.login.failed",
  "auth.lockout",
  "auth.password_reset.requested",
  "auth.password_reset.completed",
  "auth.mfa.enrollment_started",
  "auth.mfa.enrolled",
  "auth.mfa.disabled",
  "auth.mfa.disable_failed",
  "auth.mfa.recovery_code_used",
  "auth.session.revoked",
  "auth.session.replay_detected",
  "rbac.permission.granted",
  "rbac.permission.revoked",
  "rbac.role.granted",
  "rbac.role.revoked",
  "admin.privilege.changed",
  "admin.privilege.change_denied",
  "impersonate",
  "impersonate.stop",
  "api_key.created",
  "api_key.rotated",
  "api_key.revoked",
  "embed_token.created",
  "embed_token.revoked",
  "request.denied",
  // adminauth (roadmap 2.2)
  "auth.mfa.enrollment_enforced",
  "auth.mfa.recovery_codes_regenerated",
  "auth.mfa.reset_by_admin",
  "auth.password.reset_by_admin",
  "auth.credentials.reset_denied",
  "auth.step_up.succeeded",
  "auth.step_up.failed",
  "iam.admin_invitation.created",
  "iam.admin_invitation.resent",
  "iam.admin_invitation.revoked",
  "iam.admin_invitation.accepted",
  // onboarding:
  "auth.password.changed",
  // mfa-tenant:
  "auth.mfa.user_enrollment_enforced",
  "auth.mfa.user_recovery_codes_regenerated",
  "auth.mfa.reset_by_owner",
  "auth.mfa.reset_denied",
  "auth.step_up.user_succeeded",
  "auth.step_up.user_failed",
  "workspace.mfa_policy.changed",
  // members (roadmap 2.10)
  "member.deactivated",
  "member.reactivated",
  "member.removed",
  "rbac.tenant_role.changed",
  "tenant.ownership.transferred",
  "tenant.deletion.requested",
  "tenant.deletion.cancelled",
  "tenant.purged",
  "tenant.purge.failed",
  // backups: (roadmap 2.9)
  "tenant_export.requested",
  "tenant_export.download_issued",
  "tenant_export.downloaded",
  // support
  "support.access.granted",
  "support.access.revoked",
  "support.break_glass.requested",
  "support.break_glass.approved",
  "support.break_glass.denied",
  "support.impersonation.refused",
  // detection
  "security.alert.raised",
  "security.alert.acknowledged",
  "security.alert.false_positive",
  "security.alert.resolved",
  "security.alert.notification_failed",
] as const;

export const SEVERITIES: AuditSeverity[] = ["info", "notice", "warning", "critical"];

export type CategoryFilter = "all" | "security" | "change";

export interface AuditFilters {
  category: CategoryFilter;
  severity: string;
  module: string;
  action: string;
  actorType: string;
  actorId: string;
  result: string;
  tenantId: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  category: "all",
  severity: "",
  module: "",
  action: "",
  actorType: "",
  actorId: "",
  result: "",
  tenantId: "",
  dateFrom: "",
  dateTo: "",
  search: "",
};

/** Convert the filter form into API query params (empty values dropped). */
export function toAuditQuery(filters: AuditFilters, fixedTenantId?: string) {
  const query: Record<string, string> = {};
  if (filters.category !== "all") query["category"] = filters.category;
  for (const key of [
    "severity",
    "module",
    "action",
    "actorType",
    "actorId",
    "result",
    "tenantId",
    "search",
  ] as const) {
    const value = filters[key].trim();
    if (value) query[key] = value;
  }
  // Date inputs are calendar days: include the whole "to" day.
  if (filters.dateFrom) query["dateFrom"] = new Date(`${filters.dateFrom}T00:00:00`).toISOString();
  if (filters.dateTo) query["dateTo"] = new Date(`${filters.dateTo}T23:59:59.999`).toISOString();
  if (fixedTenantId) query["tenantId"] = fixedTenantId;
  return query;
}

export interface AccessFilters {
  method: string;
  path: string;
  statusCode: string;
  event: string;
  actorType: string;
  actorId: string;
}

export const EMPTY_ACCESS_FILTERS: AccessFilters = {
  method: "",
  path: "",
  statusCode: "",
  event: "",
  actorType: "",
  actorId: "",
};

export interface LoginAttemptFilters {
  email: string;
  ip: string;
  outcome: "" | "success" | "failure";
  actorType: "" | "user" | "admin";
}

export const EMPTY_LOGIN_ATTEMPT_FILTERS: LoginAttemptFilters = {
  email: "",
  ip: "",
  outcome: "",
  actorType: "",
};

/** Convert the sign-in attempt filter form into API query params. */
export function toLoginAttemptQuery(filters: LoginAttemptFilters) {
  const query: Record<string, string> = {};
  if (filters.email.trim()) query["email"] = filters.email.trim();
  if (filters.ip.trim()) query["ip"] = filters.ip.trim();
  if (filters.outcome) query["success"] = filters.outcome === "success" ? "true" : "false";
  if (filters.actorType) query["actorType"] = filters.actorType;
  return query;
}

export function toAccessQuery(filters: AccessFilters) {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) query[key] = value.trim();
  }
  return query;
}
