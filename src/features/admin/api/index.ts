import { request, requestPaged, type Query } from "@/lib/api/client";
import type {
  AccessLog,
  AdminType,
  AuditLog,
  ComplianceRequest,
  ComplianceRequestType,
  Permission,
  PlatformAdmin,
  Role,
  Tenant,
  TenantInvitation,
} from "@/lib/api/types";
import type {
  ImpersonationStart,
  SupportDiagnostics,
  SupportGrant,
  SupportSessionRecord,
} from "@/features/support/types";

const audience = "admin" as const;

export interface AccessRequest {
  id: string;
  reference: string;
  name: string;
  email: string;
  workspaceName: string;
  reason: string;
  status: string;
  createdAt: string;
}

export function listAccessRequests(query: Query = {}) {
  return requestPaged<AccessRequest>("/access-requests", { audience, query });
}

/** Roles an access-request approval may invite with (backend allow-list). */
export const APPROVABLE_ROLES = ["Viewer", "Manager"] as const;
export type ApprovableRole = (typeof APPROVABLE_ROLES)[number];

export function approveAccessRequest(
  id: string,
  tenantId: string,
  roleName: ApprovableRole = "Viewer",
  note = "",
) {
  return request<Record<string, unknown>>(`/access-requests/${id}/approve`, {
    method: "POST",
    audience,
    body: { tenantId, note, roleName },
  });
}

export function rejectAccessRequest(id: string, note = "") {
  return request<AccessRequest>(`/access-requests/${id}/reject`, {
    method: "POST",
    audience,
    body: { note },
  });
}

/* ------------------------------ Tenants ------------------------------ */

export function listTenants(query: Query = {}) {
  return requestPaged<Tenant>("/tenants", { audience, query });
}

export function getTenant(id: string) {
  return request<Tenant>(`/tenants/${id}`, { audience });
}

export function createTenant(body: {
  slug?: string;
  name: string;
  owner: { email: string; name: string; password?: string };
}) {
  return request<Tenant>("/tenants", {
    method: "POST",
    audience,
    body: { ...body, initialize: true },
  });
}

export function updateTenant(id: string, body: { name?: string; description?: string }) {
  return request<Tenant>(`/tenants/${id}`, { method: "PATCH", audience, body });
}

export function suspendTenant(id: string, reason: string) {
  return request<Tenant>(`/tenants/${id}/suspend`, {
    method: "POST",
    audience,
    body: { reason },
  });
}

export function restoreTenant(id: string, reason?: string) {
  return request<Tenant>(`/tenants/${id}/restore`, {
    method: "POST",
    audience,
    body: reason ? { reason } : {},
  });
}

export function disableTenant(id: string, reason?: string) {
  return request<Tenant>(`/tenants/${id}/disable`, {
    method: "POST",
    audience,
    body: reason ? { reason } : {},
  });
}

export function archiveTenant(id: string, reason?: string) {
  return request<Tenant>(`/tenants/${id}/archive`, {
    method: "POST",
    audience,
    body: reason ? { reason } : {},
  });
}

export function initTenant(id: string) {
  return request<Record<string, unknown>>(`/tenants/${id}/init`, {
    method: "POST",
    audience,
    body: {},
  });
}

export function tenantMembers(id: string) {
  return request<Record<string, unknown>>(`/tenants/${id}/members`, { audience });
}

export function tenantStats(id: string) {
  return request<Record<string, unknown>>(`/tenants/${id}/stats`, { audience });
}

export function tenantBilling(id: string) {
  return request<Record<string, unknown>>(`/tenants/${id}/billing`, { audience });
}

export function listTenantInvitations(id: string, query: Query = {}) {
  return requestPaged<TenantInvitation>(`/tenants/${id}/invitations`, { audience, query });
}

export function createTenantInvitation(
  id: string,
  body: { email: string; name?: string; roleName?: string },
) {
  return request<TenantInvitation>(`/tenants/${id}/invitations`, {
    method: "POST",
    audience,
    body,
  });
}

export function resendTenantInvitation(id: string, invitationId: string) {
  return request<TenantInvitation>(`/tenants/${id}/invitations/resend`, {
    method: "POST",
    audience,
    body: { invitationId },
  });
}

export function revokeTenantInvitation(id: string, invitationId: string) {
  return request<TenantInvitation>(`/tenants/${id}/invitations/${invitationId}/revoke`, {
    method: "POST",
    audience,
    body: {},
  });
}

export function tenantSettings(id: string, group?: string) {
  const query: Query = {};
  if (group) query["group"] = group;
  return request<Record<string, unknown>>(`/tenants/${id}/settings`, { audience, query });
}

export function updateTenantSettings(id: string, body: Record<string, unknown>) {
  return request<Record<string, unknown>>(`/tenants/${id}/settings`, {
    method: "PATCH",
    audience,
    body,
  });
}

export function assignTenantOwner(id: string, userId: string) {
  return request<unknown>(`/tenants/${id}/owner`, {
    method: "POST",
    audience,
    body: { userId },
  });
}

/* --------------------------- Platform admins --------------------------- */

export function listAdmins(query: Query = {}) {
  return requestPaged<PlatformAdmin>("/admin/admins", { audience, query });
}

export function getAdmin(id: string) {
  return request<PlatformAdmin>(`/admin/admins/${id}`, { audience });
}

/** @deprecated adminauth: admins are invited; use `inviteAdmin` (./adminAccess). */
export function createAdmin(body: {
  email: string;
  name: string;
  adminType: AdminType;
  /** Confine the admin to one tenant (super admins only). */
  tenantScope?: string;
}) {
  return request<PlatformAdmin>("/admin/admins", { method: "POST", audience, body });
}

export function updateAdmin(
  id: string,
  /** `tenantScope: null` clears the scope (platform-wide again). */
  body: { name?: string; adminType?: AdminType; tenantScope?: string | null },
) {
  return request<PlatformAdmin>(`/admin/admins/${id}`, { method: "PATCH", audience, body });
}

export function suspendAdmin(id: string, reason: string) {
  return request<PlatformAdmin>(`/admin/admins/${id}/suspend`, {
    method: "POST",
    audience,
    body: { reason },
  });
}

export function restoreAdmin(id: string) {
  return request<PlatformAdmin>(`/admin/admins/${id}/restore`, {
    method: "POST",
    audience,
    body: {},
  });
}

export function assignAdminRole(
  id: string,
  roleId: string,
  options: { expiresAt?: string; tenantId?: string } = {},
) {
  return request<unknown>(`/admin/admins/${id}/roles`, {
    method: "POST",
    audience,
    body: {
      roleId,
      ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
      ...(options.tenantId ? { tenantId: options.tenantId } : {}),
    },
  });
}

/** Revoke a role grant; pass `tenantId` to revoke a tenant-scoped grant. */
export function removeAdminRole(id: string, roleId: string, tenantId?: string) {
  return request<{ removed: number }>(`/admin/admins/${id}/roles/${roleId}`, {
    method: "DELETE",
    audience,
    ...(tenantId ? { query: { tenantId } } : {}),
  });
}

export function adminAudit(id: string, query: Query = {}) {
  return requestPaged<AuditLog>(`/admin/admins/${id}/audit`, { audience, query });
}

/* ------------------------- Roles & permissions ------------------------- */

export function listRoles(query: Query = {}) {
  return requestPaged<Role>("/roles", { audience, query });
}

export function getRole(id: string) {
  return request<Role>(`/roles/${id}`, { audience });
}

export function createRole(body: {
  name: string;
  description?: string;
  scope: "platform" | "tenant";
  permissions: string[];
}) {
  return request<Role>("/roles", { method: "POST", audience, body });
}

export function updateRole(id: string, body: { name?: string; description?: string }) {
  return request<Role>(`/roles/${id}`, { method: "PATCH", audience, body });
}

export function deleteRole(id: string) {
  return request<unknown>(`/roles/${id}`, { method: "DELETE", audience });
}

export function grantRolePermission(id: string, permissionKey: string) {
  return request<Role>(`/roles/${id}/permissions`, {
    method: "POST",
    audience,
    body: { permissionKey },
  });
}

export function revokeRolePermission(id: string, permissionKey: string) {
  return request<Role>(`/roles/${id}/permissions`, {
    method: "DELETE",
    audience,
    body: { permissionKey },
  });
}

export function listPermissions(query: Query = {}) {
  return requestPaged<Permission>("/permissions", { audience, query });
}

export function createPermission(body: { module: string; action: string; description?: string }) {
  return request<Permission>("/permissions", { method: "POST", audience, body });
}

export function deletePermission(permissionKey: string) {
  return request<unknown>("/permissions", {
    method: "DELETE",
    audience,
    body: { permissionKey },
  });
}

export function listModules() {
  return request<Array<Record<string, unknown>>>("/permissions/modules", { audience });
}

export function createModule(body: { key: string; name: string; parentKey?: string }) {
  return request<Record<string, unknown>>("/permissions/modules", {
    method: "POST",
    audience,
    body,
  });
}

export function listModuleActions(key: string) {
  return request<string[]>(`/permissions/modules/${key}/actions`, { audience });
}

export function bulkCreatePermissions(items: Array<{ module: string; action: string }>) {
  return request<unknown>("/permissions/bulk", { method: "POST", audience, body: { items } });
}

/* ----------------------------- Audit logs ----------------------------- */

export function listAuditLogs(query: Query = {}) {
  return requestPaged<AuditLog>("/audit-logs", { audience, query });
}

export function getAuditLog(id: string) {
  return request<AuditLog>(`/audit-logs/${id}`, { audience });
}

export function exportAuditLogs(filters: Record<string, unknown>, format: "json" | "csv") {
  return request<{ exportId: string }>("/audit-logs/export", {
    method: "POST",
    audience,
    body: { filters, format },
  });
}

/**
 * Status of an audit / access-log export (`downloadUrl` once completed).
 * Once `expiresAt` has passed the API answers 410 `EXPORT_EXPIRED` (the file
 * is deleted): request a new one.
 */
export interface ExportStatus {
  exportId?: string;
  kind?: "audit" | "access-log";
  status: "queued" | "processing" | "completed" | "failed" | "expired" | (string & {});
  format?: "json" | "csv" | (string & {});
  recordCount?: number;
  completedAt?: string | null;
  expiresAt?: string | null;
  downloadUrl?: string;
  fileName?: string | null;
  error?: string | null;
}

export function auditExportStatus(exportId: string) {
  return request<ExportStatus>(`/audit-logs/export/${exportId}`, { audience });
}

/* ----------------------------- Access logs ----------------------------- */

export function listAccessLogs(query: Query = {}) {
  return requestPaged<AccessLog>("/access-logs", { audience, query });
}

export function topPaths(query: Query = {}) {
  return request<Array<Record<string, unknown>>>("/access-logs/top-paths", { audience, query });
}

export function topErrors(query: Query = {}) {
  return request<Array<Record<string, unknown>>>("/access-logs/top-errors", { audience, query });
}

export function exportAccessLogs(filters: Record<string, unknown>, format: "json" | "csv") {
  return request<{ exportId: string }>("/access-logs/export", {
    method: "POST",
    audience,
    body: { filters, format },
  });
}

export function accessExportStatus(exportId: string) {
  return request<ExportStatus>(`/access-logs/export/${exportId}`, { audience });
}

/** One sign-in attempt (`GET /access-logs/login-attempts`). */
export interface LoginAttempt {
  _id: string;
  actorId?: string | null;
  actorType: "user" | "admin";
  email: string;
  tenantId?: string | null;
  ip?: string;
  userAgent?: string;
  success: boolean;
  reason: string;
  occurredAt: string;
}

/** Every sign-in attempt, newest first (needs `access_logs.view`). */
export function listLoginAttempts(query: Query = {}) {
  return requestPaged<LoginAttempt>("/access-logs/login-attempts", { audience, query });
}

/* ------------------------------ Compliance ------------------------------ */

export function listComplianceRequests(query: Query = {}) {
  return requestPaged<ComplianceRequest>("/compliance/requests", { audience, query });
}

export function getComplianceRequest(id: string) {
  return request<ComplianceRequest>(`/compliance/requests/${id}`, { audience });
}

/** Body of `POST /compliance/requests` (backend `createSchema`). */
export interface ComplianceRequestInput {
  subjectId: string;
  subjectType?: "user" | "tenant";
  type: ComplianceRequestType;
  reason: string;
  subjectEmail?: string;
  tenantScope?: string[];
}

export function createComplianceRequest(body: ComplianceRequestInput) {
  return request<{ requestId: string; status: string; type: string; subjectId: string }>(
    "/compliance/requests",
    { method: "POST", audience, body },
  );
}

export function cancelComplianceRequest(id: string, reason?: string) {
  return request<{ requestId: string; status: string }>(`/compliance/requests/${id}/cancel`, {
    method: "POST",
    audience,
    body: reason ? { reason } : {},
  });
}

/* -------------------------------- Support -------------------------------- */
// Bodies match backend/src/validators/support.validator.js exactly. Every
// privileged support action carries a reason (3..500 chars).

/** Start a read-only support session (needs workspace consent or approved break-glass). */
export function impersonate(targetUserId: string, reason: string, ticket?: string) {
  return request<ImpersonationStart>("/support/impersonate", {
    method: "POST",
    audience,
    body: ticket ? { targetUserId, reason, ticket } : { targetUserId, reason },
  });
}

export function stopImpersonation(sessionId: string, reason: string) {
  return request<{ sessionId: string; status: string; stoppedAt: string }>(
    "/support/impersonate/stop",
    { method: "POST", audience, body: { sessionId, reason } },
  );
}

/** Unlock and email a password reset to an active user. */
export function recoverAccount(userId: string, reason: string) {
  return request<Record<string, unknown>>("/support/account/recover", {
    method: "POST",
    audience,
    body: { userId, reason },
  });
}

export function revokeUserSessions(userId: string, reason: string) {
  return request<Record<string, unknown>>("/support/account/revoke-sessions", {
    method: "POST",
    audience,
    body: { userId, reason },
  });
}

export function tenantLookups(id: string) {
  return request<Record<string, unknown>>(`/support/tenants/${id}/lookups`, { audience });
}

/** Tenant-scoped in-app broadcast. */
export function broadcast(input: {
  tenantId: string;
  title: string;
  body?: string;
  reason: string;
}) {
  const body: { tenantId: string; title: string; reason: string; body?: string } = {
    tenantId: input.tenantId,
    title: input.title,
    reason: input.reason,
  };
  if (input.body) body.body = input.body;
  return request<Record<string, unknown>>("/support/notifications/broadcast", {
    method: "POST",
    audience,
    body,
  });
}

/** Sanitised operational diagnostics for one workspace (`support.view`). */
export function tenantDiagnostics(tenantId: string) {
  return request<SupportDiagnostics>(
    `/support/tenants/${encodeURIComponent(tenantId)}/diagnostics`,
    { audience },
  );
}

/** Consent and break-glass grants (`support.view`; scoped admins see their tenant). */
export function listSupportGrants(query: Query = {}) {
  return requestPaged<SupportGrant>("/support/access-grants", { audience, query });
}

/** Ask for break-glass access to a workspace (`support.configure`). */
export function requestBreakGlass(tenantId: string, reason: string, ticket?: string) {
  return request<SupportGrant>("/support/access-grants/break-glass", {
    method: "POST",
    audience,
    body: ticket ? { tenantId, reason, ticket } : { tenantId, reason },
  });
}

/** Approve a pending break-glass request (`support.approve`, a different super admin). */
export function approveBreakGlass(grantId: string, reason: string) {
  return request<SupportGrant>(`/support/access-grants/${encodeURIComponent(grantId)}/approve`, {
    method: "POST",
    audience,
    body: { reason },
  });
}

/** Deny a pending break-glass request (`support.approve`). */
export function denyBreakGlass(grantId: string, reason: string) {
  return request<SupportGrant>(`/support/access-grants/${encodeURIComponent(grantId)}/deny`, {
    method: "POST",
    audience,
    body: { reason },
  });
}

/** Give up a grant early; ends its sessions (`support.configure`). */
export function revokeSupportGrant(grantId: string, reason: string) {
  return request<SupportGrant>(`/support/access-grants/${encodeURIComponent(grantId)}/revoke`, {
    method: "POST",
    audience,
    body: { reason },
  });
}

/** Support sessions (`support.view`). */
export function listSupportSessions(query: Query = {}) {
  return requestPaged<SupportSessionRecord>("/support/impersonations", { audience, query });
}

/* ------------------------------ Monitoring ------------------------------ */

export type ProbeName =
  "system" | "db" | "websocket" | "queue" | "scheduler" | "storage" | "connectors";

export function healthProbe(probe: ProbeName) {
  return request<Record<string, unknown>>(`/monitoring/health/${probe}`, { audience });
}

export function healthAggregate() {
  return request<Record<string, unknown>>("/monitoring/health/aggregate", { audience });
}

export function metrics() {
  return request<Record<string, unknown>>("/monitoring/metrics", { audience });
}

export type JobRunStatus = "running" | "succeeded" | "failed" | "abandoned";

/** One scheduled-job execution (GET /monitoring/jobs/runs). */
export interface JobRun {
  id: string;
  job: string;
  instanceId: string | null;
  trigger: "schedule" | "manual";
  status: JobRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  counts: Record<string, number> | null;
  error: { code?: string | null; message?: string | null } | null;
}

export interface SchedulerJobHealth {
  name: string;
  cronExpression: string;
  enabled: boolean;
  intervalMs: number | null;
  overdue: boolean;
  lastRun: JobRun | null;
  lastSuccessAt: string | null;
  lastFailure: JobRun | null;
}

export interface SchedulerHealth {
  status: "ok" | "degraded" | "disabled";
  enabled: boolean;
  lastTickAt: string | null;
  process?: { role?: string; instanceId?: string; running?: boolean };
  jobs: SchedulerJobHealth[];
}

export interface QueueStats {
  name: string;
  status: "ok" | "down" | "idle";
  transport?: string;
  initialised?: boolean;
  waiting?: number;
  active?: number;
  delayed?: number;
  failed?: number;
  completed?: number;
  consuming?: boolean;
  error?: string;
}

export interface QueueHealth {
  status: "ok" | "degraded" | "down";
  transport: "bullmq" | "memory";
  role: string;
  consumersInProcess: boolean;
  queues: QueueStats[];
}

export function schedulerHealth() {
  return request<SchedulerHealth>("/monitoring/health/scheduler", { audience });
}

export function queueHealth() {
  return request<QueueHealth>("/monitoring/health/queue", { audience });
}

/** Scheduled-job run history, newest first (monitoring.view). */
export function listJobRuns(query: Query = {}) {
  return requestPaged<JobRun>("/monitoring/jobs/runs", { audience, query });
}

/* -------------------- retention: mail, outbox, retention -------------------- */

export type OutboxStatus = "pending" | "sending" | "retrying" | "sent" | "dead";

/** GET /monitoring/health/mail - mail transport + email outbox. */
export interface MailHealth {
  status: "ok" | "degraded" | "down" | "disabled";
  transport: "smtp" | "noop" | "capture" | string;
  checkedAt: string;
  verify: {
    ok: boolean;
    checkedAt: string;
    error: { code?: string; message?: string } | null;
  } | null;
  sends: {
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastError: { code?: string; message?: string } | null;
    consecutiveFailures: number;
  };
  outbox: Record<OutboxStatus, number> & {
    backlog: number;
    oldestDueAt: string | null;
    backlogAgeMs: number;
    lastSentAt: string | null;
  };
  settings?: { maxAttempts: number; backoffBaseMs: number; backoffMaxMs: number };
}

/** One outbox message (recipients masked; variables are never returned). */
export interface OutboxMessage {
  id: string;
  tenantId: string | null;
  to: string[];
  template: string;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number | null;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
  deadAt: string | null;
  lastError: { code?: string | null; message?: string | null } | null;
  transport: string | null;
  createdAt: string | null;
}

export interface RetentionPolicy {
  key: string;
  collection: string | null;
  envKey: string | null;
  days: number | null;
  enabled: boolean;
  cutoff: string | null;
  field: string | null;
  enforcedBy: "cleanup-job" | "ttl-index" | "cache-ttl" | string;
  description: string | null;
  invalid?: string;
}

/** GET /monitoring/retention - policies, legal holds, last cleanup run. */
export interface RetentionStatus {
  checkedAt: string;
  job: {
    name: string;
    enabled: boolean;
    cronExpression: string | null;
    dryRun: boolean;
    batchSize: number;
    maxBatchesPerRun: number;
  };
  legalHoldTenantIds: string[];
  policies: RetentionPolicy[];
  lastRun: JobRun | null;
  lastSuccessAt: string | null;
}

export function mailHealth() {
  return request<MailHealth>("/monitoring/health/mail", { audience });
}

/** Outbox messages, newest first (monitoring.view). */
export function listOutbox(query: Query = {}) {
  return requestPaged<OutboxMessage>("/monitoring/outbox", { audience, query });
}

/** Retry a dead-lettered message (monitoring.update). */
export function requeueOutboxMessage(id: string) {
  return request<OutboxMessage>(`/monitoring/outbox/${encodeURIComponent(id)}/requeue`, {
    method: "POST",
    audience,
  });
}

export function retentionStatus() {
  return request<RetentionStatus>("/monitoring/retention", { audience });
}

/* ----------------------------- Dashboard (Phase 5) ----------------------------- */

export interface DashboardTenantCounts {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  disabled: number;
  archived: number;
}

export interface DashboardRecentTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardRecentAction {
  id: string;
  module: string;
  action: string;
  resourceId: string | null;
  actor: { id: string | null; type: string } | null;
  occurredAt: string;
}

export interface DashboardSummary {
  counts: DashboardTenantCounts;
  recentTenants: DashboardRecentTenant[];
  recentActions: DashboardRecentAction[];
  health: Record<string, unknown>;
  generatedAt: string;
}

export function dashboardSummary(query: Query = {}) {
  return request<DashboardSummary>("/admin/dashboard/summary", { audience, query });
}
