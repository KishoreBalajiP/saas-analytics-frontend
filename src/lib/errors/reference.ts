/**
 * Reference ids in error UI (roadmap 2.8, findings ops.15 / ops2.14).
 *
 * Every API call carries an `X-Request-Id`; when it fails, `ApiError`
 * keeps the id. Error states and toasts show it as a copyable "Reference
 * ID", which support matches to the backend log lines and error report.
 *
 *   - `requestIdOf(err)`          the reference id of an error, if any.
 *   - `copyText(text)`            clipboard write that never throws.
 *   - `referenceToastOptions(id)` sonner options: description + Copy action.
 *   - `toastApiError(err, msg)`   one error toast with the reference id.
 *   - `installErrorToastReferences()` app-wide: an existing
 *     `toast.error(err.message)` call gets the reference id of the API error
 *     that produced that message (matched on the message, within a few
 *     seconds), so call sites need no change.
 */

import { toast } from "sonner";

import { ApiError, onApiError } from "@/lib/api/client";

/** The reference id of an error (ApiError or anything carrying `requestId`). */
export function requestIdOf(err: unknown): string | undefined {
  if (err instanceof ApiError) return err.requestId;
  const value = (err as { requestId?: unknown } | null | undefined)?.requestId;
  return typeof value === "string" && value ? value : undefined;
}

/** Copy to the clipboard; resolves false when unavailable or refused. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied / insecure context
  }
  return false;
}

export interface ReferenceToastOptions {
  description: string;
  action: { label: string; onClick: () => void };
}

/** Toast options that show the reference id with a "Copy ID" action. */
export function referenceToastOptions(requestId: string): ReferenceToastOptions {
  return {
    description: `Reference ID: ${requestId}`,
    action: {
      label: "Copy ID",
      onClick: () => {
        void copyText(requestId);
      },
    },
  };
}

/** Toast an error with its reference id (when it came from the API). */
export function toastApiError(err: unknown, fallback: string) {
  const message = err instanceof Error && err.message ? err.message : fallback;
  const id = requestIdOf(err);
  if (id) toast.error(message, referenceToastOptions(id));
  else toast.error(message);
}

/* -------------------------- app-wide toast hook -------------------------- */

const RECENT_WINDOW_MS = 10_000;
const RECENT_MAX = 20;

type ToastError = (message: unknown, data?: Record<string, unknown>) => unknown;
interface ToastTarget {
  error: ToastError;
}

let installed: { target: ToastTarget; original: ToastError; unsubscribe: () => void } | null = null;

/**
 * Patch `toast.error` so a plain `toast.error(message)` that repeats the
 * message of an API error thrown in the last few seconds also shows that
 * error's reference id. Calls that already pass a description or action,
 * and toasts unrelated to an API error, are left untouched. Idempotent;
 * returns an uninstall function.
 *
 * @param target - the toast object (tests pass a fake).
 */
export function installErrorToastReferences(target: ToastTarget = toast as unknown as ToastTarget) {
  if (installed) return uninstallErrorToastReferences;
  const recent: Array<{ message: string; requestId: string; at: number }> = [];
  const unsubscribe = onApiError((error) => {
    if (!error.requestId || !error.message) return;
    recent.push({ message: error.message, requestId: error.requestId, at: Date.now() });
    if (recent.length > RECENT_MAX) recent.shift();
  });
  const original = target.error;
  const patched: ToastError = (message, data) => {
    const hasDetails = Boolean(data && ("description" in data || "action" in data));
    if (typeof message === "string" && message && !hasDetails) {
      const now = Date.now();
      for (let i = recent.length - 1; i >= 0; i -= 1) {
        const entry = recent[i]!;
        if (now - entry.at > RECENT_WINDOW_MS) break;
        // Exact message, or a longer sentence quoting it ("Export failed: ...").
        if (
          message === entry.message ||
          (entry.message.length >= 8 && message.includes(entry.message))
        ) {
          return original.call(target, message, {
            ...(data ?? {}),
            ...referenceToastOptions(entry.requestId),
          });
        }
      }
    }
    return original.call(target, message, data);
  };
  target.error = patched;
  installed = { target, original, unsubscribe };
  return uninstallErrorToastReferences;
}

/** Undo `installErrorToastReferences` (tests). */
export function uninstallErrorToastReferences() {
  if (!installed) return;
  installed.target.error = installed.original;
  installed.unsubscribe();
  installed = null;
}
