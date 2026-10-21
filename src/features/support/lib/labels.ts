import { ApiError } from "@/lib/api/client";

import { SUPPORT_ERROR_CODES, type SupportGrant, type SupportSessionRecord } from "../types";

/** Human labels for the support audit actions the workspace sees. */
const ACTION_LABELS: Record<string, string> = {
  "grant.created": "Support access granted",
  "grant.revoked": "Support access revoked",
  "break_glass.requested": "Break-glass access requested",
  "break_glass.approved": "Break-glass access approved",
  "break_glass.denied": "Break-glass access denied",
  impersonate: "Support session started",
  "impersonate.stop": "Support session stopped by the operator",
  "impersonate.end": "Support session ended by the operator",
  "impersonate.ended_by_workspace": "Support session ended by the workspace",
  "impersonate.refused": "Support session refused (no access granted)",
  "diagnostics.viewed": "Support viewed diagnostics",
};

export function supportActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function grantStatusLabel(grant: Pick<SupportGrant, "status">) {
  switch (grant.status) {
    case "active":
      return "Active";
    case "pending":
      return "Awaiting approval";
    case "denied":
      return "Denied";
    case "revoked":
      return "Revoked";
    case "expired":
      return "Expired";
    default:
      return grant.status;
  }
}

export function sessionStatusLabel(session: Pick<SupportSessionRecord, "status">) {
  if (session.status === "active") return "Active";
  if (session.status === "expired") return "Expired";
  return "Ended";
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/** A clear message for the support-specific error codes. */
export function supportErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
  switch (error.code) {
    case SUPPORT_ERROR_CODES.CONSENT_REQUIRED:
      return "This workspace has not granted support access. Ask an Owner or Admin to grant it in Settings, or request break-glass access.";
    case SUPPORT_ERROR_CODES.TARGET_PROTECTED:
      return "Support sessions cannot target accounts or workspaces owned by platform staff.";
    case SUPPORT_ERROR_CODES.CAP_EXCEEDED:
      return "You have reached your daily limit of support sessions.";
    case SUPPORT_ERROR_CODES.APPROVAL_DENIED:
      return "Only a different, active platform super admin can decide break-glass requests.";
    case SUPPORT_ERROR_CODES.GRANT_NOT_ACTIVE:
      return "This grant or session is no longer active.";
    case SUPPORT_ERROR_CODES.READ_ONLY:
      return "Support sessions are read-only.";
    case "TENANT_NOT_ACTIVE":
      return "The workspace is not active, so support sessions are blocked.";
    default:
      return error.message;
  }
}
