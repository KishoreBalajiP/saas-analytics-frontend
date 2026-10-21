/**
 * Platform-admin access management (roadmap 2.2, adminauth): invitations
 * and admin-assisted credential resets. Sensitive calls may answer 403
 * `STEP_UP_REQUIRED`; callers wrap them with `useStepUp().run(...)`.
 */
import { request, requestPaged, type Query } from "@/lib/api/client";
import type {
  AdminCredentialResetResult,
  AdminInvitationRecord,
  AdminInviteResult,
  BackendAdminType,
} from "@/lib/api/types";

const audience = "admin" as const;

/** POST /admin/admins - invite an admin (no password: they choose it). */
export function inviteAdmin(body: { email: string; name?: string; adminType: BackendAdminType }) {
  return request<AdminInviteResult>("/admin/admins", { method: "POST", audience, body });
}

/** GET /admin/admins/invitations - invitation history. */
export function listAdminInvitations(query: Query = {}) {
  return requestPaged<AdminInvitationRecord>("/admin/admins/invitations", { audience, query });
}

/** POST /admin/admins/:id/invitation/resend - new link (cooldown applies). */
export function resendAdminInvitation(adminId: string) {
  return request<{ invitation: AdminInvitationRecord; delivered: boolean }>(
    `/admin/admins/${adminId}/invitation/resend`,
    { method: "POST", audience, body: {} },
  );
}

/** POST /admin/admins/:id/invitation/revoke - revoke and remove the pending admin. */
export function revokeAdminInvitation(adminId: string, reason?: string) {
  return request<{ invitation: AdminInvitationRecord; adminRemoved: boolean }>(
    `/admin/admins/${adminId}/invitation/revoke`,
    { method: "POST", audience, body: reason ? { reason } : {} },
  );
}

/** POST /admin/admins/:id/mfa/reset - super only, never oneself, step-up. */
export function resetAdminMfaFor(adminId: string, reason: string) {
  return request<AdminCredentialResetResult>(`/admin/admins/${adminId}/mfa/reset`, {
    method: "POST",
    audience,
    body: { reason },
  });
}

/** POST /admin/admins/:id/password/reset - super only, never oneself, step-up. */
export function resetAdminPasswordFor(adminId: string, reason: string) {
  return request<AdminCredentialResetResult>(`/admin/admins/${adminId}/password/reset`, {
    method: "POST",
    audience,
    body: { reason },
  });
}
