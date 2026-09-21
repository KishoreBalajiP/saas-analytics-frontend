/**
 * RBAC / Permission helpers.
 *
 * Permission keys follow the backend convention: `<module>.<action>`.
 * The backend is always authoritative — these helpers are UX-only gates.
 *
 * Canonical modules (from the backend contract):
 *   analytics, connectors, dashboards, reports, alerts, notifications,
 *   api_keys, embed, users, iam, audit_logs, access_logs, compliance,
 *   support, monitoring, master_data
 *
 * Canonical actions:
 *   view, create, update, delete, export, approve, suspend, restore,
 *   assign, configure, evaluate, impersonate, recover, broadcast,
 *   lookup, file, cancel, preview, sync
 */

// ---------------------------------------------------------------------------
// Permission key helpers
// ---------------------------------------------------------------------------

/** Build a canonical permission key: `module.action`. */
export function perm(module: string, action: string): string {
  return `${module}.${action}`;
}

/** Check whether `permissions[]` contains *any* of the given keys. */
export function hasAnyPermission(
  userPermissions: string[] | undefined,
  ...keys: string[]
): boolean {
  if (!userPermissions?.length) return false;
  return keys.some((k) => userPermissions.includes(k));
}

/** Check whether `permissions[]` contains *all* of the given keys. */
export function hasAllPermissions(
  userPermissions: string[] | undefined,
  ...keys: string[]
): boolean {
  if (!userPermissions?.length) return false;
  return keys.every((k) => userPermissions.includes(k));
}

/** Check whether `permissions[]` contains the exact key. */
export function hasPermission(userPermissions: string[] | undefined, key: string): boolean {
  if (!userPermissions?.length) return false;
  return userPermissions.includes(key);
}

// ---------------------------------------------------------------------------
// Well-known permission keys (derived from the backend contract)
// ---------------------------------------------------------------------------

export const Permissions = {
  // Analytics
  ANALYTICS_VIEW: perm("analytics", "view"),
  ANALYTICS_EXPORT: perm("analytics", "export"),

  // Connectors / Datasets
  CONNECTORS_VIEW: perm("connectors", "view"),
  CONNECTORS_CREATE: perm("connectors", "create"),
  CONNECTORS_UPDATE: perm("connectors", "update"),
  CONNECTORS_DELETE: perm("connectors", "delete"),
  CONNECTORS_PREVIEW: perm("connectors", "preview"),
  CONNECTORS_SYNC: perm("connectors", "sync"),

  // Dashboards
  DASHBOARDS_VIEW: perm("dashboards", "view"),
  DASHBOARDS_CREATE: perm("dashboards", "create"),
  DASHBOARDS_UPDATE: perm("dashboards", "update"),
  DASHBOARDS_DELETE: perm("dashboards", "delete"),

  // Reports
  REPORTS_VIEW: perm("reports", "view"),
  REPORTS_CREATE: perm("reports", "create"),
  REPORTS_UPDATE: perm("reports", "update"),
  REPORTS_DELETE: perm("reports", "delete"),
  REPORTS_EXPORT: perm("reports", "export"),

  // Alerts
  ALERTS_VIEW: perm("alerts", "view"),
  ALERTS_CREATE: perm("alerts", "create"),
  ALERTS_UPDATE: perm("alerts", "update"),
  ALERTS_DELETE: perm("alerts", "delete"),
  ALERTS_EVALUATE: perm("alerts", "evaluate"),

  // Notifications
  NOTIFICATIONS_VIEW: perm("notifications", "view"),
  NOTIFICATIONS_UPDATE: perm("notifications", "update"),
  NOTIFICATIONS_DELETE: perm("notifications", "delete"),

  // API Keys
  API_KEYS_VIEW: perm("api_keys", "view"),
  API_KEYS_CREATE: perm("api_keys", "create"),
  API_KEYS_UPDATE: perm("api_keys", "update"),
  API_KEYS_DELETE: perm("api_keys", "delete"),

  // Embed
  EMBED_VIEW: perm("embed", "view"),
  EMBED_CREATE: perm("embed", "create"),
  EMBED_DELETE: perm("embed", "delete"),

  // Users
  USERS_VIEW: perm("users", "view"),

  // IAM (admin)
  IAM_TENANTS_VIEW: perm("iam.tenants", "view"),
  IAM_TENANTS_CREATE: perm("iam.tenants", "create"),
  IAM_TENANTS_UPDATE: perm("iam.tenants", "update"),
  IAM_TENANTS_SUSPEND: perm("iam.tenants", "suspend"),
  IAM_TENANTS_RESTORE: perm("iam.tenants", "restore"),
  IAM_TENANTS_DELETE: perm("iam.tenants", "delete"),
  IAM_TENANTS_CONFIGURE: perm("iam.tenants", "configure"),
  IAM_TENANTS_ASSIGN: perm("iam.tenants", "assign"),

  IAM_ADMINS_VIEW: perm("iam.admins", "view"),
  IAM_ADMINS_CREATE: perm("iam.admins", "create"),
  IAM_ADMINS_UPDATE: perm("iam.admins", "update"),
  IAM_ADMINS_SUSPEND: perm("iam.admins", "suspend"),
  IAM_ADMINS_RESTORE: perm("iam.admins", "restore"),
  IAM_ADMINS_ASSIGN: perm("iam.admins", "assign"),

  IAM_ROLES_VIEW: perm("iam.roles", "view"),
  IAM_ROLES_CREATE: perm("iam.roles", "create"),
  IAM_ROLES_UPDATE: perm("iam.roles", "update"),
  IAM_ROLES_DELETE: perm("iam.roles", "delete"),
  IAM_ROLES_ASSIGN: perm("iam.roles", "assign"),

  IAM_PERMISSIONS_VIEW: perm("iam.permissions", "view"),
  IAM_PERMISSIONS_CREATE: perm("iam.permissions", "create"),
  IAM_PERMISSIONS_DELETE: perm("iam.permissions", "delete"),

  // Audit logs
  AUDIT_LOGS_VIEW: perm("audit_logs", "view"),
  AUDIT_LOGS_EXPORT: perm("audit_logs", "export"),

  // Access logs
  ACCESS_LOGS_VIEW: perm("access_logs", "view"),
  ACCESS_LOGS_EXPORT: perm("access_logs", "export"),

  // Compliance
  COMPLIANCE_VIEW: perm("compliance", "view"),
  COMPLIANCE_CREATE: perm("compliance", "create"),
  COMPLIANCE_UPDATE: perm("compliance", "update"),

  // Support
  SUPPORT_CONFIGURE: perm("support", "configure"),
  SUPPORT_IMPERSONATE: perm("support", "impersonate"),
  SUPPORT_RECOVER: perm("support", "recover"),
  SUPPORT_BROADCAST: perm("support", "broadcast"),
  SUPPORT_LOOKUP: perm("support", "lookup"),

  // Monitoring
  MONITORING_VIEW: perm("monitoring", "view"),
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];
