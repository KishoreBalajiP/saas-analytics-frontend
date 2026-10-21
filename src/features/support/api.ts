import { request, requestPaged, type Query } from "@/lib/api/client";

import type {
  CurrentSupportSession,
  SupportActivityRow,
  SupportGrant,
  SupportSessionRecord,
  WorkspaceSupportAccess,
} from "./types";

/** TanStack Query keys for the workspace side of support access. */
export const supportAccessKeys = {
  all: ["workspace", "support-access"] as const,
  activity: (query: Query = {}) => ["workspace", "support-access", "activity", query] as const,
  current: ["support-session", "current"] as const,
};

/** GET /workspace/support-access (requires `settings.view`). */
export function getWorkspaceSupportAccess() {
  return request<WorkspaceSupportAccess>("/workspace/support-access");
}

/** GET /workspace/support-access/activity (requires `settings.view`). */
export function listSupportActivity(query: Query = {}) {
  return requestPaged<SupportActivityRow>("/workspace/support-access/activity", { query });
}

/**
 * POST /workspace/support-access/grants (requires `settings.configure`).
 * A new grant supersedes the active one.
 */
export function grantSupportAccess(body: { durationHours: number; note?: string }) {
  return request<SupportGrant>("/workspace/support-access/grants", { method: "POST", body });
}

/** POST /workspace/support-access/grants/:id/revoke (requires `settings.configure`). */
export function revokeSupportAccess(grantId: string, reason?: string) {
  return request<SupportGrant>(
    `/workspace/support-access/grants/${encodeURIComponent(grantId)}/revoke`,
    { method: "POST", body: reason ? { reason } : {} },
  );
}

/** POST /workspace/support-access/sessions/:id/end (requires `settings.configure`). */
export function endSupportSessionAsWorkspace(sessionId: string, reason?: string) {
  return request<SupportSessionRecord>(
    `/workspace/support-access/sessions/${encodeURIComponent(sessionId)}/end`,
    { method: "POST", body: reason ? { reason } : {} },
  );
}

/** GET /support-session - the current tenant session, if it is a support session. */
export function getCurrentSupportSession() {
  return request<CurrentSupportSession>("/support-session");
}

/** POST /support-session/end - a support session ends itself. */
export function endCurrentSupportSession(reason?: string) {
  return request<{ sessionId: string; status: "ended"; endedAt: string }>("/support-session/end", {
    method: "POST",
    body: reason ? { reason } : {},
  });
}
