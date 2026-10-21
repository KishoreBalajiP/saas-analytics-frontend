import { announceSignOut, refreshAccessToken, request, setAccessToken } from "@/lib/api/client";
import type { Me, MfaEnrollmentResult, MfaEnrollmentStart, SessionPayload } from "@/lib/api/types";
import { rememberSession } from "@/lib/auth/sessionHint";

export interface LoginInput {
  email: string;
  password: string;
  mfaToken?: string;
  /** Admin portal only: a one-time recovery code instead of `mfaToken`. */
  recoveryCode?: string;
}

export async function loginTenant(tenantSlug: string, input: LoginInput) {
  const data = await request<SessionPayload>("/auth/login", {
    method: "POST",
    audience: "tenant",
    tenantSlug,
    body: input,
  });
  if (data?.accessToken) {
    setAccessToken("tenant", data.accessToken);
    rememberSession("tenant", data.sessionExpiresAt ?? null);
  }
  return data;
}

export async function loginAdmin(input: LoginInput) {
  const data = await request<SessionPayload>("/admin-auth/login", {
    method: "POST",
    audience: "admin",
    body: input,
  });
  if (data?.accessToken) {
    setAccessToken("admin", data.accessToken);
    rememberSession("admin", data.sessionExpiresAt ?? null);
  }
  return data;
}

/**
 * Restore / extend the tenant session from the HttpOnly refresh cookie.
 * Single-flight across tabs (see `lib/auth/refreshCoordinator.ts`).
 */
export function refreshTenant() {
  return refreshAccessToken("tenant");
}

/** Admin-portal counterpart of `refreshTenant`. */
export function refreshAdmin() {
  return refreshAccessToken("admin");
}

export async function logoutTenant() {
  try {
    await request<unknown>("/auth/logout", { method: "POST", audience: "tenant" });
  } finally {
    setAccessToken("tenant", null);
    announceSignOut("tenant");
  }
}

export async function logoutAdmin() {
  try {
    await request<unknown>("/admin-auth/logout", { method: "POST", audience: "admin" });
  } finally {
    setAccessToken("admin", null);
    announceSignOut("admin");
  }
}

export function tenantMe() {
  return request<Me>("/users/me", { audience: "tenant" });
}

export function adminMe() {
  return request<Me>("/admin-auth/me", { audience: "admin" });
}

export function updateTenantProfile(body: {
  name?: string;
  timezone?: string;
  locale?: string;
  avatarUrl?: string;
}) {
  return request<Me>("/users/me", { method: "PATCH", audience: "tenant", body });
}

export function forgotPassword(tenantSlug: string, email: string) {
  return request<{ ok: boolean }>("/auth/password/forgot", {
    method: "POST",
    audience: "public",
    tenantSlug,
    body: { email },
  });
}

export function resendVerification(email: string, tenantSlug: string) {
  return request<{ ok: boolean }>("/auth/resend-verification", {
    method: "POST",
    audience: "public",
    tenantSlug,
    body: { email },
  });
}

export function resetPassword(tenantSlug: string, token: string, newPassword: string) {
  return request<{ ok: boolean }>("/auth/password/reset", {
    method: "POST",
    audience: "public",
    tenantSlug,
    body: { token, newPassword },
  });
}

export function registerWorkspace(input: {
  fullName: string;
  email: string;
  password: string;
  workspaceName: string;
  workspaceSlug?: string;
  // onboarding: Terms/Privacy consent and the version shown.
  acceptTerms: boolean;
  termsVersion: string;
}) {
  return request<{
    ok: boolean;
    email: string;
    verificationSent: boolean;
    tenant: { id: string; name: string; slug: string; status: string; onboardingStatus: string };
    owner: { id: string; name: string };
  }>("/auth/register", { method: "POST", audience: "public", body: input });
}

export function verifyEmail(token: string) {
  return request<{
    ok: boolean;
    verified: boolean;
    email: string;
    tenant: { id: string; name: string; slug: string; status: string; onboardingStatus: string };
  }>("/auth/verify-email", {
    method: "POST",
    audience: "public",
    body: { token },
  });
}

export function submitAccessRequest(input: {
  name: string;
  email: string;
  workspaceName: string;
  reason?: string;
}) {
  return request<{ accepted: boolean; reference: string }>("/access-requests", {
    method: "POST",
    audience: "public",
    body: input,
  });
}

export function previewInvitation(token: string) {
  return request<{
    tenant: { id: string; name: string; slug: string };
    invitedEmail: string;
    role: string;
    expiresAt: string;
  }>("/invitations/preview", { audience: "public", query: { token } });
}

export function acceptInvitation(token: string, name: string, password: string) {
  return request<{ ok: boolean; tenantId: string; email: string }>("/invitations/accept", {
    method: "POST",
    audience: "public",
    body: { token, name, password },
  });
}

export function inviteTenantMember(input: { email: string; name?: string; roleName?: string }) {
  return request<{
    invitation: { _id: string; invitedEmail: string; roleName: string; status: string };
    delivered: boolean;
    alreadyPending: boolean;
  }>("/invitations", { method: "POST", audience: "tenant", body: input });
}

/** Start admin TOTP enrolment: the secret is returned exactly once. */
export function enrollMfa() {
  return request<MfaEnrollmentStart>("/admin-auth/mfa/enroll", {
    method: "POST",
    audience: "admin",
  });
}

/**
 * Confirm admin TOTP enrolment. The response carries the one-time recovery
 * codes (shown once, never retrievable again).
 */
export function verifyMfa(code: string) {
  return request<MfaEnrollmentResult>("/admin-auth/mfa/verify", {
    method: "POST",
    audience: "admin",
    body: { code },
  });
}

// onboarding: self-service password change and own sessions.
export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return request<{ ok: boolean; sessionsRevoked: number }>("/users/me/password", {
    method: "POST",
    audience: "tenant",
    body,
  });
}

export interface OwnSession {
  sessionId: string;
  current: boolean;
  device: string | null;
  ip: string | null;
  userAgent: string | null;
  signedInAt: string | null;
  lastUsedAt: string | null;
  impersonated: boolean;
}

export function listMySessions() {
  return request<OwnSession[]>("/users/me/sessions", { audience: "tenant" });
}

export function revokeMySession(sessionId: string) {
  return request<unknown>(`/users/me/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
    audience: "tenant",
  });
}
