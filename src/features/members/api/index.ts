import { request, requestPaged } from "@/lib/api/client";
import type {
  DeletionContext,
  InvitationStatus,
  Member,
  MemberStatus,
  PermissionCatalogueEntry,
  TenantDeletion,
  WorkspaceInvitation,
  WorkspaceRole,
} from "@/features/members/types";

/** TanStack Query keys for the members feature. */
export const membersKeys = {
  all: ["workspace", "members"] as const,
  members: (params: Record<string, unknown>) => ["workspace", "members", "list", params] as const,
  invitations: (params: Record<string, unknown>) =>
    ["workspace", "members", "invitations", params] as const,
  roles: ["workspace", "members", "roles"] as const,
  catalogue: ["workspace", "members", "permissions"] as const,
  deletion: ["workspace", "members", "deletion"] as const,
};

/* -------------------------------- members -------------------------------- */

/** GET /workspace/members (users.view). Emails are null for name-only viewers. */
export function listMembers(
  params: { search?: string; status?: MemberStatus; page?: number; limit?: number } = {},
) {
  return requestPaged<Member>("/workspace/members", { query: params });
}

/** PUT /workspace/members/:id/roles (roles.assign; ceiling + last-owner enforced). */
export function setMemberRoles(userId: string, roleIds: string[]) {
  return request<Member>(`/workspace/members/${encodeURIComponent(userId)}/roles`, {
    method: "PUT",
    body: { roleIds },
  });
}

/** POST /workspace/members/:id/deactivate (users.update). Revokes their sessions. */
export function deactivateMember(userId: string, reason?: string) {
  return request<{ member: Member; changed: boolean; sessionsRevoked: number }>(
    `/workspace/members/${encodeURIComponent(userId)}/deactivate`,
    { method: "POST", body: reason ? { reason } : {} },
  );
}

/** POST /workspace/members/:id/reactivate (users.update). */
export function reactivateMember(userId: string) {
  return request<{ member: Member; changed: boolean }>(
    `/workspace/members/${encodeURIComponent(userId)}/reactivate`,
    { method: "POST", body: {} },
  );
}

/** DELETE /workspace/members/:id (users.delete). Frees the seat. */
export function removeMember(userId: string) {
  return request<{ removed: boolean; sessionsRevoked: number }>(
    `/workspace/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

/* ------------------------------ invitations ------------------------------ */

/** GET /workspace/invitations (users.create): history in every status. */
export function listInvitations(
  params: { status?: InvitationStatus; page?: number; limit?: number } = {},
) {
  return requestPaged<WorkspaceInvitation>("/workspace/invitations", { query: params });
}

/** POST /workspace/invitations (users.create; role ceiling enforced). */
export function invite(body: { email: string; name?: string; roleName: string }) {
  return request<{ invitation: WorkspaceInvitation; delivered: boolean; alreadyPending: boolean }>(
    "/workspace/invitations",
    { method: "POST", body },
  );
}

/** POST /workspace/invitations/:id/resend (users.create). */
export function resendInvitation(invitationId: string) {
  return request<{ invitation: WorkspaceInvitation; delivered: boolean }>(
    `/workspace/invitations/${encodeURIComponent(invitationId)}/resend`,
    { method: "POST", body: {} },
  );
}

/** POST /workspace/invitations/:id/revoke (users.update). */
export function revokeInvitation(invitationId: string) {
  return request<WorkspaceInvitation>(
    `/workspace/invitations/${encodeURIComponent(invitationId)}/revoke`,
    { method: "POST", body: {} },
  );
}

/* --------------------------------- roles --------------------------------- */

/** GET /workspace/roles (roles.view). */
export function listRoles() {
  return request<WorkspaceRole[]>("/workspace/roles");
}

/** GET /workspace/roles/permissions (roles.view). */
export function listPermissionCatalogue() {
  return request<PermissionCatalogueEntry[]>("/workspace/roles/permissions");
}

/** POST /workspace/roles (roles.create; permissions within your own). */
export function createRole(body: { name: string; description?: string; permissions: string[] }) {
  return request<WorkspaceRole>("/workspace/roles", { method: "POST", body });
}

/** PATCH /workspace/roles/:id (roles.update; custom roles only). */
export function updateRole(
  roleId: string,
  body: { name?: string; description?: string; permissions?: string[] },
) {
  return request<WorkspaceRole>(`/workspace/roles/${encodeURIComponent(roleId)}`, {
    method: "PATCH",
    body,
  });
}

/** DELETE /workspace/roles/:id (roles.delete; unassigned custom roles only). */
export function deleteRole(roleId: string) {
  return request<{ deleted: boolean }>(`/workspace/roles/${encodeURIComponent(roleId)}`, {
    method: "DELETE",
  });
}

/* ---------------------------- ownership / deletion ---------------------------- */

/** POST /workspace/ownership/transfer (Owner; password re-entry). */
export function transferOwnership(userId: string, password: string) {
  return request<{ ownerId: string; previousOwnerId: string | null }>(
    "/workspace/ownership/transfer",
    { method: "POST", body: { userId, password } },
  );
}

/** GET /workspace/deletion (Owner): the slug to type and the grace period. */
export function getDeletionContext() {
  return request<DeletionContext>("/workspace/deletion");
}

/** POST /workspace/deletion (Owner; typed slug + password). Signs everyone out. */
export function requestDeletion(body: { confirm: string; password: string; reason?: string }) {
  return request<TenantDeletion>("/workspace/deletion", { method: "POST", body });
}

/* ------------------------------ platform admin ----------------------------- */

/** GET /tenants/:id/deletion (platform admin, iam.tenants.view). */
export function getTenantDeletion(tenantId: string) {
  return request<TenantDeletion | null>(`/tenants/${encodeURIComponent(tenantId)}/deletion`, {
    audience: "admin",
  });
}

/** POST /tenants/:id/deletion/cancel (platform admin, iam.tenants.restore). */
export function cancelTenantDeletion(tenantId: string, reason: string) {
  return request<TenantDeletion>(`/tenants/${encodeURIComponent(tenantId)}/deletion/cancel`, {
    method: "POST",
    audience: "admin",
    body: { reason },
  });
}
