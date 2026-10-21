/**
 * Client state of a read-only support session (roadmap 2.3).
 *
 * A platform support admin who starts a support session from the admin
 * console gets a short-lived, read-only user token. "Open workspace" puts
 * that token in this tab's tenant slot (memory only, like every access
 * token) and records who is acting, so the tenant shell can show the
 * support banner. While it is active:
 *   - the tenant token is never refreshed or replaced by another tab
 *     (`setSupportSessionActive` in the API client);
 *   - signing out ends the support session instead of the browser's own
 *     tenant session (and never broadcasts a sign-out to other tabs).
 * Reloading the page drops the token (it is never persisted); the server
 * session still ends on its own at expiry.
 */
import { useSyncExternalStore } from "react";

import {
  isSupportSessionActive,
  request,
  setAccessToken,
  setSupportSessionActive,
} from "@/lib/api/client";

export interface SupportSessionInfo {
  sessionId: string;
  expiresAt: string;
  breakGlass: boolean;
  user: { id: string; email: string; tenantId: string };
  operator: { email: string | null };
}

export interface SupportSessionStart {
  token: string;
  sessionId: string;
  expiresAt: string;
  breakGlass: boolean;
  user: { id: string; email: string; tenantId: string };
}

let current: SupportSessionInfo | null = null;
let exitPending = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

/** Switch this tab's tenant portal to the support session. */
export function beginSupportSession(start: SupportSessionStart, operatorEmail: string | null) {
  current = {
    sessionId: start.sessionId,
    expiresAt: start.expiresAt,
    breakGlass: start.breakGlass,
    user: { id: start.user.id, email: start.user.email, tenantId: start.user.tenantId },
    operator: { email: operatorEmail },
  };
  exitPending = false;
  setSupportSessionActive(true);
  setAccessToken("tenant", start.token);
  notify();
}

/** The support session open in this tab, or null. */
export function getSupportSession() {
  return current;
}

/**
 * Forget the support session locally: drop the token and the guard. The
 * next redirect of the tenant shell goes back to the admin console.
 */
export function clearSupportSession() {
  if (!current && !isSupportSessionActive()) return;
  current = null;
  exitPending = true;
  setAccessToken("tenant", null);
  setSupportSessionActive(false);
  notify();
}

/** True once after a support session ended (where to send the operator). */
export function consumeSupportExit() {
  const pending = exitPending;
  exitPending = false;
  return pending;
}

/**
 * End the support session on the server (best effort: it may already have
 * expired or been ended by the workspace), then locally. Never throws.
 */
export async function endSupportSession(reason?: string) {
  try {
    if (isSupportSessionActive()) {
      await request("/support-session/end", {
        method: "POST",
        audience: "tenant",
        body: reason ? { reason } : {},
      });
    }
  } catch {
    /* already ended or expired - nothing left to revoke */
  } finally {
    clearSupportSession();
  }
}

export function subscribeSupportSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React binding: re-renders when a support session starts or ends. */
export function useSupportSession() {
  return useSyncExternalStore(subscribeSupportSession, getSupportSession, () => null);
}
