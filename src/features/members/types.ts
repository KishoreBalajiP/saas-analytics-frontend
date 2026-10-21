/**
 * Workspace member, role, invitation and deletion shapes (roadmap 2.10).
 * Mirrors the backend `/api/v1/workspace/*` contract
 * (tenantMember / tenantRole / tenantInvitation / tenantDeletion services).
 */

export type MemberStatus = "invited" | "unverified" | "active" | "suspended" | "locked";

export interface RoleRef {
  id: string;
  name: string;
}

export interface Member {
  id: string;
  /** Null when the viewer may only see names (no users.create / users.update). */
  email: string | null;
  name: string;
  status: MemberStatus;
  roles: RoleRef[];
  /** Holds the Owner role. */
  isOwner: boolean;
  /** The workspace's primary owner (`Tenant.ownerId`). */
  isPrimaryOwner: boolean;
  lastLoginAt: string | null;
  joinedAt: string | null;
  createdAt: string | null;
}

export interface WorkspaceRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  /** One of the built-in templates (Owner, Admin, Manager, Viewer). */
  isDefault: boolean;
  /** Custom roles only. */
  editable: boolean;
  permissions: string[];
  memberCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PermissionCatalogueEntry {
  key: string;
  module: string;
  action: string;
  description: string;
  /** The current user holds this permission. */
  held: boolean;
  /** Can be put in a custom role by the current user. */
  assignable: boolean;
}

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface WorkspaceInvitation {
  _id: string;
  tenantId: string;
  invitedEmail: string;
  roleId: string;
  roleName: string;
  invitedBy: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  expiredAt?: string | null;
  revokedBy?: string | null;
  resendCount?: number;
  lastSentAt?: string | null;
  createdAt?: string;
  deliveryError?: string;
}

export type DeletionStatus = "scheduled" | "purging" | "purged" | "failed" | "cancelled";

export interface TenantDeletion {
  id: string;
  tenantId: string;
  tenantSlug: string | null;
  tenantName: string | null;
  status: DeletionStatus;
  source: "owner_request" | "archive_retention" | "admin";
  requestedBy: { type: string; id: string | null } | null;
  requestedAt: string | null;
  purgeAfter: string | null;
  reason: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  attempts: number;
  purgedAt: string | null;
  lastError: { code: string; message: string } | null;
  verification: {
    ok: boolean;
    checkedAt: string;
    collections: Array<{ name: string; deleted: number; remaining: number }>;
    retained: Array<{ name: string; count: number; policy: string | null }>;
    storage: { deleted: number; remaining: number };
  } | null;
  reopened?: boolean;
}

export interface DeletionContext {
  workspace: { id: string; name: string; slug: string; status: string };
  graceDays: number;
  pending: TenantDeletion | null;
}

/** UI label for built-in role names (doc 05 M2: Manager reads as Analyst). */
export function roleLabel(name: string): string {
  return name === "Manager" ? "Analyst (Manager)" : name;
}
