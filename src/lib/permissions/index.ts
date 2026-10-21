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
  // members: workspace member and role management (roadmap 2.10).
  USERS_CREATE: perm("users", "create"),
  USERS_UPDATE: perm("users", "update"),
  USERS_DELETE: perm("users", "delete"),
  ROLES_VIEW: perm("roles", "view"),
  ROLES_CREATE: perm("roles", "create"),
  ROLES_UPDATE: perm("roles", "update"),
  ROLES_DELETE: perm("roles", "delete"),
  ROLES_ASSIGN: perm("roles", "assign"),
  WORKSPACE_TRANSFER: perm("workspace", "transfer"),
  WORKSPACE_DELETE: perm("workspace", "delete"),

  // IAM (admin)
  IAM_TENANTS_VIEW: perm("iam.tenants", "view"),
  IAM_TENANTS_CREATE: perm("iam.tenants", "create"),
  IAM_TENANTS_UPDATE: perm("iam.tenants", "update"),
  IAM_TENANTS_SUSPEND: perm("iam.tenants", "suspend"),
  IAM_TENANTS_RESTORE: perm("iam.tenants", "restore"),
  IAM_TENANTS_DELETE: perm("iam.tenants", "delete"),
  IAM_TENANTS_CONFIGURE: perm("iam.tenants", "configure"),
  IAM_TENANTS_ASSIGN: perm("iam.tenants", "assign"),
  // backups: tenant data export (roadmap 2.9).
  IAM_TENANTS_EXPORT: perm("iam.tenants", "export"),
  DATA_EXPORTS_VIEW: perm("data_exports", "view"),
  DATA_EXPORTS_EXPORT: perm("data_exports", "export"),

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
  // support: keys the backend actually provisions (canonical actions).
  // `support.lookup`/`impersonate`/`recover`/`broadcast` above are not
  // creatable on the backend; gate on these instead.
  SUPPORT_APPROVE: perm("support", "approve"),

  // Monitoring
  MONITORING_VIEW: perm("monitoring", "view"),
  // retention: requeue dead-lettered outbox email.
  MONITORING_UPDATE: perm("monitoring", "update"),

  // Phase 6 - Plans, Billing, Subscriptions and Entitlements
  IAM_SUBSCRIPTIONS_VIEW: perm("iam.subscriptions", "view"),
  IAM_SUBSCRIPTIONS_UPDATE: perm("iam.subscriptions", "update"),
  IAM_ENTITLEMENTS_VIEW: perm("iam.entitlements", "view"),
  BILLING_PLANS_VIEW: perm("billing.plans", "view"),
  BILLING_PLANS_CREATE: perm("billing.plans", "create"),
  BILLING_PLANS_UPDATE: perm("billing.plans", "update"),
  BILLING_PLANS_ARCHIVE: perm("billing.plans", "archive"),
  BILLING_SUBSCRIPTIONS_VIEW: perm("billing.subscriptions", "view"),
  BILLING_SUBSCRIPTIONS_OVERRIDE: perm("billing.subscriptions", "override"),
  BILLING_ENTITLEMENTS_OVERRIDE: perm("billing.entitlements", "override"),

  // detection: platform security alerts (roadmap 2.6)
  SECURITY_ALERTS_VIEW: perm("security.alerts", "view"),
  SECURITY_ALERTS_UPDATE: perm("security.alerts", "update"),

  // adminauth: admin invitations (revoke) and admin-assisted credential resets.
  IAM_ADMINS_DELETE: perm("iam.admins", "delete"),
  IAM_ADMINS_CONFIGURE: perm("iam.admins", "configure"),

  // config: platform configuration (roadmap 2.4). `settings.*` and
  // `feature_flags.view` are also tenant keys (workspace settings / flags).
  SETTINGS_VIEW: perm("settings", "view"),
  SETTINGS_UPDATE: perm("settings", "update"),
  SETTINGS_SECRETS_VIEW: perm("settings.secrets", "view"),
  SETTINGS_SECRETS_UPDATE: perm("settings.secrets", "update"),
  FEATURE_FLAGS_VIEW: perm("feature_flags", "view"),
  FEATURE_FLAGS_CREATE: perm("feature_flags", "create"),
  FEATURE_FLAGS_UPDATE: perm("feature_flags", "update"),
  FEATURE_FLAGS_DELETE: perm("feature_flags", "delete"),
  EMAIL_TEMPLATES_VIEW: perm("email_templates", "view"),
  EMAIL_TEMPLATES_UPDATE: perm("email_templates", "update"),

  // roles: platform role model (roadmap 2.1). Keys mirror the backend route
  // gates. Support: lookups = view; account recovery, session revocation and
  // broadcasts = update; impersonation = configure (SUPPORT_CONFIGURE). The
  // older SUPPORT_LOOKUP / IMPERSONATE / RECOVER / BROADCAST keys name
  // actions the backend never grants: do not gate on them.
  SUPPORT_VIEW: perm("support", "view"),
  SUPPORT_UPDATE: perm("support", "update"),
  IAM_ACCESS_REQUESTS_VIEW: perm("iam.access_requests", "view"),
  IAM_ACCESS_REQUESTS_APPROVE: perm("iam.access_requests", "approve"),
  // fe-gap: master-data catalogue screen gates on view (reads are public on the API).
  MASTER_DATA_VIEW: perm("master_data", "view"),
  MASTER_DATA_CREATE: perm("master_data", "create"),
  MASTER_DATA_UPDATE: perm("master_data", "update"),
  MASTER_DATA_DELETE: perm("master_data", "delete"),
  BILLING_ENTITLEMENTS_VIEW: perm("billing.entitlements", "view"),

  // ai-catalogue: metric definitions.
  METRICS_VIEW: perm("metrics", "view"),
  METRICS_MANAGE: perm("metrics", "manage"),
  METRICS_APPROVE: perm("metrics", "approve"),
  // rls: dataset grants and row-level security (Owner: configure).
  DATA_ACCESS_VIEW: perm("data_access", "view"),
  DATA_ACCESS_CONFIGURE: perm("data_access", "configure"),
  // mfa-tenant: workspace security policy (Owner: configure).
  SECURITY_VIEW: perm("security", "view"),
  SECURITY_CONFIGURE: perm("security", "configure"),
} as const;

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];
