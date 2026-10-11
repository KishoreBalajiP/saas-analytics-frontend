import { request, setAccessToken } from "@/lib/api/client";
import type { Me, SessionPayload } from "@/lib/api/types";

export interface LoginInput {
  email: string;
  password: string;
  mfaToken?: string;
}

export async function loginTenant(tenantSlug: string, input: LoginInput) {
  const data = await request<SessionPayload>("/auth/login", {
    method: "POST",
    audience: "tenant",
    tenantSlug,
    body: input,
  });
  if (data?.accessToken) setAccessToken("tenant", data.accessToken);
  return data;
}

export async function loginAdmin(input: LoginInput) {
  const data = await request<SessionPayload>("/admin-auth/login", {
    method: "POST",
    audience: "admin",
    body: input,
  });
  if (data?.accessToken) setAccessToken("admin", data.accessToken);
  return data;
}

export async function refreshTenant() {
  const data = await request<SessionPayload>("/auth/refresh", {
    method: "POST",
    audience: "tenant",
    noRefresh: true,
  });
  if (data?.accessToken) setAccessToken("tenant", data.accessToken);
  return data;
}

export async function refreshAdmin() {
  const data = await request<SessionPayload>("/admin-auth/refresh", {
    method: "POST",
    audience: "admin",
    noRefresh: true,
  });
  if (data?.accessToken) setAccessToken("admin", data.accessToken);
  return data;
}

export async function logoutTenant() {
  try {
    await request<unknown>("/auth/logout", { method: "POST", audience: "tenant" });
  } finally {
    setAccessToken("tenant", null);
  }
}

export async function logoutAdmin() {
  try {
    await request<unknown>("/admin-auth/logout", { method: "POST", audience: "admin" });
  } finally {
    setAccessToken("admin", null);
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

export function enrollMfa() {
  return request<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }>(
    "/admin-auth/mfa/enroll",
    { method: "POST", audience: "admin" },
  );
}

export function verifyMfa(code: string) {
  return request<{ verified: boolean }>("/admin-auth/mfa/verify", {
    method: "POST",
    audience: "admin",
    body: { code },
  });
}
