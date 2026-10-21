/**
 * mfa-tenant: tenant-user MFA self-service and the workspace security policy.
 */
import { request } from "@/lib/api/client";
import type {
  MfaEnrollmentResult,
  MfaEnrollmentStart,
  WorkspaceSecurityPolicy,
} from "@/lib/api/types";

export type SecondFactor = { code: string } | { recoveryCode: string };

export function enrollTenantMfa() {
  return request<MfaEnrollmentStart>("/auth/mfa/enroll", { method: "POST", audience: "tenant" });
}

export function verifyTenantMfa(code: string) {
  return request<MfaEnrollmentResult>("/auth/mfa/verify", {
    method: "POST",
    audience: "tenant",
    body: { code },
  });
}

export function disableTenantMfa(password: string, factor: SecondFactor) {
  return request<{ enabled: false; enrollmentRequired: boolean }>("/auth/mfa/disable", {
    method: "POST",
    audience: "tenant",
    body: { password, ...factor },
  });
}

export const workspaceSecurityKey = ["workspace", "security"] as const;

export function getWorkspaceSecurity() {
  return request<WorkspaceSecurityPolicy>("/workspace/security");
}

export function updateWorkspaceSecurity(mfaRequired: boolean) {
  return request<WorkspaceSecurityPolicy>("/workspace/security", {
    method: "PATCH",
    body: { mfaRequired },
  });
}

/** Enrolment calls for the shared `MfaEnrollment` component. */
export const tenantEnrollmentApi = { start: enrollTenantMfa, verify: verifyTenantMfa };
