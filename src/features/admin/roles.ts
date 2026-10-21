/**
 * Platform role model (roadmap 2.1) - display helpers for the admin portal.
 *
 * The backend is authoritative (`src/constants/platformRoles.js`); these
 * labels only describe the four built-in platform roles and admin types.
 */

import type { AdminScope, AdminType, Me } from "@/lib/api/types";

export interface BuiltInPlatformRole {
  name: "super_admin" | "platform_admin" | "support_operator" | "auditor";
  label: string;
  adminType: AdminType;
  summary: string;
}

/** The four built-in platform roles, most privileged first. */
export const BUILT_IN_PLATFORM_ROLES: readonly BuiltInPlatformRole[] = [
  {
    name: "super_admin",
    label: "Super Admin",
    adminType: "super",
    summary: "Full platform control: administrators, roles, archive, ownership and overrides.",
  },
  {
    name: "platform_admin",
    label: "Platform Admin",
    adminType: "platform",
    summary:
      "Tenant lifecycle, onboarding and the plan catalogue; read access to administrators, audit and billing.",
  },
  {
    name: "support_operator",
    label: "Support Operator",
    adminType: "support",
    summary: "Support tooling and read access to the tenants within the operator's scope.",
  },
  {
    name: "auditor",
    label: "Auditor",
    adminType: "auditor",
    summary: "Read-only access to platform data, including audit and access-log exports.",
  },
];

const ADMIN_TYPE_LABELS: Record<AdminType, string> = {
  super: "Super Admin",
  platform: "Platform Admin",
  support: "Support Operator",
  auditor: "Auditor",
};

/** Human label for an admin type (falls back to the raw value). */
export function adminTypeLabel(type?: string | null): string {
  if (!type) return "Admin";
  return ADMIN_TYPE_LABELS[type as AdminType] ?? type;
}

/** The built-in role definition for `name`, if any. */
export function builtInPlatformRole(name: string): BuiltInPlatformRole | undefined {
  return BUILT_IN_PLATFORM_ROLES.find((role) => role.name === name);
}

/** `tenantScope: "*"` means cross-tenant (every tenant), not a tenant id. */
const CROSS_TENANT_SCOPE = "*";

const PLATFORM_SCOPE: AdminScope = { type: "platform", tenantId: null };

/**
 * The admin's effective scope. `/admin-auth/me` returns it as `scope` and is
 * authoritative; admin rows from listings only carry `tenantScope`.
 * Platform-wide by default.
 */
export function adminScopeOf(me: Pick<Me, "scope" | "tenantScope"> | null | undefined): AdminScope {
  if (me?.scope) {
    return me.scope.type === "tenant" && me.scope.tenantId
      ? { type: "tenant", tenantId: me.scope.tenantId }
      : PLATFORM_SCOPE;
  }
  if (me?.tenantScope && me.tenantScope !== CROSS_TENANT_SCOPE) {
    return { type: "tenant", tenantId: me.tenantScope };
  }
  return PLATFORM_SCOPE;
}

/** Short description of a scope for headers and badges. */
export function describeScope(scope: AdminScope): string {
  return scope.type === "tenant" && scope.tenantId ? `Tenant ${scope.tenantId}` : "All tenants";
}
