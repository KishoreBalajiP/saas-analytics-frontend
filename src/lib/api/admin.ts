import { request, requestPaged, type Query } from "./client";
import type {
  AccessLog,
  AdminType,
  AuditLog,
  ComplianceRequest,
  Permission,
  PlatformAdmin,
  Role,
  Tenant,
} from "./types";

const audience = "admin" as const;

/* ------------------------------ Tenants ------------------------------ */

export function listTenants(query: Query = {}) {
  return requestPaged<Tenant>("/tenants", { audience, query });
}

export function getTenant(id: string) {
  return request<Tenant>(`/tenants/${id}`, { audience });
}

export function createTenant(body: {
  slug: string;
  name: string;
  owner: { email: string; name: string; password?: string };
}) {
  return request<Tenant>("/tenants", { method: "POST", audience, body });
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

export function restoreTenant(id: string) {
  return request<Tenant>(`/tenants/${id}/restore`, { method: "POST", audience, body: {} });
}

export function disableTenant(id: string) {
  return request<Tenant>(`/tenants/${id}/disable`, { method: "POST", audience, body: {} });
}

export function archiveTenant(id: string) {
  return request<Tenant>(`/tenants/${id}/archive`, { method: "POST", audience, body: {} });
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

export function createAdmin(body: {
  email: string;
  password: string;
  name: string;
  adminType: AdminType;
  scope?: Record<string, unknown>;
}) {
  return request<PlatformAdmin>("/admin/admins", { method: "POST", audience, body });
}

export function updateAdmin(
  id: string,
  body: { name?: string; adminType?: AdminType; scope?: Record<string, unknown> },
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

export function assignAdminRole(id: string, roleId: string, expiresAt?: string) {
  return request<unknown>(`/admin/admins/${id}/roles`, {
    method: "POST",
    audience,
    body: expiresAt ? { roleId, expiresAt } : { roleId },
  });
}

export function removeAdminRole(id: string, roleId: string) {
  return request<unknown>(`/admin/admins/${id}/roles/${roleId}`, { method: "DELETE", audience });
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

export function auditExportStatus(exportId: string) {
  return request<{ status: string; url?: string; expiresAt?: string }>(
    `/audit-logs/export/${exportId}`,
    { audience },
  );
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
  return request<{ status: string; url?: string; expiresAt?: string }>(
    `/access-logs/export/${exportId}`,
    { audience },
  );
}

/* ------------------------------ Compliance ------------------------------ */

export function listComplianceRequests(query: Query = {}) {
  return requestPaged<ComplianceRequest>("/compliance/requests", { audience, query });
}

export function getComplianceRequest(id: string) {
  return request<ComplianceRequest>(`/compliance/requests/${id}`, { audience });
}

export function createComplianceRequest(body: {
  subjectEmail: string;
  subjectUserId?: string;
  type: "export" | "delete" | "restrict";
  notes?: string;
}) {
  return request<ComplianceRequest>("/compliance/requests", {
    method: "POST",
    audience,
    body,
  });
}

export function cancelComplianceRequest(id: string) {
  return request<ComplianceRequest>(`/compliance/requests/${id}/cancel`, {
    method: "POST",
    audience,
    body: {},
  });
}

/* -------------------------------- Support -------------------------------- */

export function impersonate(userId: string, reason: string) {
  return request<Record<string, unknown>>("/support/impersonate", {
    method: "POST",
    audience,
    body: { userId, reason },
  });
}

export function stopImpersonation(sessionId: string) {
  return request<unknown>("/support/impersonate/stop", {
    method: "POST",
    audience,
    body: { sessionId },
  });
}

export function recoverAccount(email: string, type: "reset" | "unlock") {
  return request<Record<string, unknown>>("/support/account/recover", {
    method: "POST",
    audience,
    body: { email, type },
  });
}

export function revokeUserSessions(userId: string) {
  return request<Record<string, unknown>>("/support/account/revoke-sessions", {
    method: "POST",
    audience,
    body: { userId },
  });
}

export function tenantLookups(id: string) {
  return request<Record<string, unknown>>(`/support/tenants/${id}/lookups`, { audience });
}

export function broadcast(body: {
  title: string;
  body: string;
  audience: { tenantId?: string; roles?: string[] };
}) {
  return request<Record<string, unknown>>("/support/notifications/broadcast", {
    method: "POST",
    audience,
    body,
  });
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
