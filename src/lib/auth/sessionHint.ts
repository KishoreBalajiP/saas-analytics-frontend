/**
 * Session hint: a non-secret note that this browser holds a signed-in
 * session for a portal, and until when the server said it lasts.
 *
 * The refresh token itself is an HttpOnly cookie that scripts cannot see. If
 * the browser refuses that cookie (third-party-cookie blocking in Safari,
 * Brave or private windows when the API is on another site), the next page
 * load cannot restore the session and the server reports
 * `SESSION_COOKIE_MISSING`. The hint lets session diagnostics distinguish
 * that case from a session that simply ended. It stores only a timestamp.
 */

import type { PortalAudience } from "./refreshCoordinator";

const KEY_PREFIX = "analivo.sessionHint.";

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Record that a session exists until `sessionExpiresAt` (ISO string). */
export function rememberSession(audience: PortalAudience, sessionExpiresAt?: string | null) {
  const until = sessionExpiresAt ? Date.parse(sessionExpiresAt) : NaN;
  try {
    storage()?.setItem(KEY_PREFIX + audience, String(Number.isFinite(until) ? until : 0));
  } catch {
    /* storage may be unavailable; the hint is best effort */
  }
}

/** Forget the hint (sign-out, or the server ended the session). */
export function forgetSession(audience: PortalAudience) {
  try {
    storage()?.removeItem(KEY_PREFIX + audience);
  } catch {
    /* ignore */
  }
}

/**
 * True when this browser signed in and the session should still be alive,
 * so a missing refresh cookie means the browser did not keep or send it.
 */
export function expectsLiveSession(audience: PortalAudience, now = Date.now()): boolean {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(KEY_PREFIX + audience) ?? null;
  } catch {
    return false;
  }
  if (raw === null) return false;
  const until = Number(raw);
  return Number.isFinite(until) && until > now;
}
