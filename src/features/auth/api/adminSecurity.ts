/**
 * Admin-portal account security calls (roadmap 2.2, adminauth):
 * step-up re-authentication, recovery codes, disabling MFA, password
 * recovery and invitation acceptance. Login/enrolment live in `./index.ts`.
 */
import { ApiError, request, setAccessToken } from "@/lib/api/client";
import type {
  AdminInvitationPreview,
  RecoveryCodesResult,
  SessionPayload,
  StepUpResult,
} from "@/lib/api/types";
import { rememberSession } from "@/lib/auth/sessionHint";

/** A second factor: a current authenticator code or a one-time recovery code. */
export type SecondFactor = { code: string } | { recoveryCode: string };

/** True for the 403 that asks the client to re-authenticate and retry. */
export function isStepUpRequired(error: unknown) {
  return error instanceof ApiError && error.statusCode === 403 && error.code === "STEP_UP_REQUIRED";
}

/** True for the 403 that sends a restricted session to MFA enrolment. */
export function isMfaEnrollmentRequired(error: unknown) {
  return (
    error instanceof ApiError &&
    error.statusCode === 403 &&
    error.code === "MFA_ENROLLMENT_REQUIRED"
  );
}

/**
 * POST /admin-auth/step-up - opens a short step-up window on this session.
 * `factor` is required when the admin has MFA enabled.
 */
export function stepUpAdmin(password: string, factor?: SecondFactor) {
  return request<StepUpResult>("/admin-auth/step-up", {
    method: "POST",
    audience: "admin",
    body: { password, ...(factor ?? {}) },
  });
}

/** POST /admin-auth/mfa/recovery-codes - new batch (needs a fresh step-up). */
export function regenerateRecoveryCodes() {
  return request<RecoveryCodesResult>("/admin-auth/mfa/recovery-codes", {
    method: "POST",
    audience: "admin",
  });
}

/** POST /admin-auth/mfa/disable - password plus a code or recovery code. */
export function disableAdminMfa(password: string, factor: SecondFactor) {
  return request<{ enabled: false; enrollmentRequired: boolean }>("/admin-auth/mfa/disable", {
    method: "POST",
    audience: "admin",
    body: { password, ...factor },
  });
}

/** POST /admin-auth/password/forgot - always `{ ok: true }` (no enumeration). */
export function forgotAdminPassword(email: string) {
  return request<{ ok: boolean }>("/admin-auth/password/forgot", {
    method: "POST",
    audience: "public",
    body: { email },
  });
}

/** POST /admin-auth/password/reset - complete a reset with the emailed token. */
export function resetAdminPassword(token: string, newPassword: string) {
  return request<{ ok: boolean }>("/admin-auth/password/reset", {
    method: "POST",
    audience: "public",
    body: { token, newPassword },
  });
}

/** POST /admin-auth/invitations/preview - what the invitee is accepting. */
export function previewAdminInvitation(token: string) {
  return request<AdminInvitationPreview>("/admin-auth/invitations/preview", {
    method: "POST",
    audience: "public",
    body: { token },
  });
}

/**
 * POST /admin-auth/invitations/accept - set the password and sign in. The
 * admin refresh cookie is set by the server; the access token is kept in
 * memory like a normal admin login.
 */
export async function acceptAdminInvitation(input: {
  token: string;
  password: string;
  name?: string;
}) {
  const data = await request<SessionPayload>("/admin-auth/invitations/accept", {
    method: "POST",
    audience: "public",
    body: input,
  });
  if (data?.accessToken) {
    setAccessToken("admin", data.accessToken);
    rememberSession("admin", data.sessionExpiresAt ?? null);
  }
  return data;
}
