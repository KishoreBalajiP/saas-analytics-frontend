/**
 * Effective permission sets of the four built-in platform roles, mirroring
 * the backend catalogue (`src/constants/platformRoles.js`, roadmap 2.1).
 * Test fixture only.
 */

export const SUPER_ADMIN_PERMISSIONS = [
  "iam.admins.view",
  "iam.admins.create",
  "iam.admins.update",
  "iam.admins.suspend",
  "iam.admins.restore",
  "iam.admins.assign",
  "iam.roles.view",
  "iam.permissions.view",
  "iam.tenants.view",
  "iam.tenants.create",
  "iam.tenants.update",
  "iam.tenants.suspend",
  "iam.tenants.restore",
  "iam.tenants.delete",
  "iam.tenants.configure",
  "iam.tenants.assign",
  "iam.access_requests.view",
  "iam.access_requests.approve",
  "audit_logs.view",
  "audit_logs.export",
  "access_logs.view",
  "access_logs.export",
  "compliance.view",
  "compliance.create",
  "compliance.update",
  "monitoring.view",
  "support.view",
  "support.update",
  "support.configure",
  "billing.plans.view",
  "billing.subscriptions.view",
  "billing.entitlements.view",
  "billing.entitlements.override",
];

export const PLATFORM_ADMIN_PERMISSIONS = [
  "iam.tenants.view",
  "iam.tenants.create",
  "iam.tenants.update",
  "iam.tenants.suspend",
  "iam.tenants.restore",
  "iam.access_requests.view",
  "iam.access_requests.approve",
  "iam.admins.view",
  "iam.roles.view",
  "iam.permissions.view",
  "audit_logs.view",
  "access_logs.view",
  "compliance.view",
  "monitoring.view",
  "support.view",
  "master_data.view",
  "master_data.create",
  "master_data.update",
  "billing.plans.view",
  "billing.plans.update",
  "billing.subscriptions.view",
  "billing.entitlements.view",
];

export const SUPPORT_OPERATOR_PERMISSIONS = [
  "iam.tenants.view",
  "audit_logs.view",
  "access_logs.view",
  "compliance.view",
  "support.view",
  "support.update",
  "support.configure",
];

export const AUDITOR_PERMISSIONS = [
  "iam.admins.view",
  "iam.roles.view",
  "iam.permissions.view",
  "iam.tenants.view",
  "iam.access_requests.view",
  "audit_logs.view",
  "audit_logs.export",
  "access_logs.view",
  "access_logs.export",
  "compliance.view",
  "monitoring.view",
  "support.view",
  "master_data.view",
  "billing.plans.view",
  "billing.subscriptions.view",
  "billing.entitlements.view",
];

/** Build a `useAdminSession()` value for a role. */
export function adminSessionFor(
  permissions: string[],
  me: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: "authenticated",
    me: { id: "adm_1", email: "admin@platform.test", adminType: "platform", ...me },
    permissions,
    signOut: async () => undefined,
    hasPermission: (key: string) => permissions.includes(key),
  };
}
