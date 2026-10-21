/**
 * Production error reporting for the SPA (roadmap 2.8, findings ops.07,
 * ops2.05, ops.15).
 *
 * Crashes caught by the router error boundary, uncaught errors and
 * unhandled promise rejections are POSTed to the API
 * (`POST /api/v1/client-errors`), which scrubs them again and hands them to
 * the platform error reporter. The Lovable editor hook keeps working next
 * to it.
 *
 * Guarantees:
 *   - never throws and never blocks rendering (fire-and-forget fetch with
 *     `keepalive`, no credentials);
 *   - scrubbed before sending: bearer tokens, JWTs, `?token=`-style query
 *     values, embed/invitation path tokens and email addresses;
 *   - bounded: the same error is sent at most once a minute and at most
 *     MAX_REPORTS_PER_MINUTE reports leave a tab per minute (the API also
 *     rate-limits per IP);
 *   - expected API errors (4xx) are not reported; 5xx are, with their
 *     reference id.
 *
 * Enabled in production builds; `VITE_ERROR_REPORTING=true|false`
 * overrides.
 */

import { ApiError, apiUrl } from "@/lib/api/client";

export type ClientErrorKind = "boundary" | "error" | "unhandledrejection" | "manual";

export interface ClientErrorReport {
  kind: ClientErrorKind;
  name?: string;
  message: string;
  stack?: string;
  url?: string;
  route?: string;
  component?: string;
  requestId?: string;
  statusCode?: number;
  code?: string;
  release?: string;
  portal?: "tenant" | "admin" | "public" | "embed";
}

export const MAX_REPORTS_PER_MINUTE = 5;
const DEDUPE_WINDOW_MS = 60_000;
const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;
const MAX_URL = 2000;

/* ------------------------------- scrubbing ------------------------------- */

const REDACTED = "[REDACTED]";
const QUERY_SECRET =
  /([?&#;](?:token|access_token|refresh_token|id_token|code|key|api_key|apikey|secret|password|signature|sig|jwt|otp|pollToken|resetToken|inviteToken)=)[^&#\s"']+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const BEARER = /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const PATH_TOKEN =
  /(\/(?:embed|webhooks|invite|invitations|reset-password|verify-email)\/)(?!tokens\b)(?!:)[^/?#\s"']{12,}/gi;
// Bounded quantifiers keep scrubbing linear on long strings.
const EMAIL = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}/g;

/** Mask credentials and email addresses in text (messages, stacks, URLs). */
export function scrubText(text: string): string {
  return text
    .replace(BEARER, `$1 ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(QUERY_SECRET, `$1${REDACTED}`)
    .replace(PATH_TOKEN, `$1${REDACTED}`)
    .replace(EMAIL, "[email]");
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

/* ------------------------------ configuration ----------------------------- */

type Sender = (url: string, report: ClientErrorReport) => Promise<void> | void;

const defaultSender: Sender = async (url, report) => {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(report),
    credentials: "omit",
    keepalive: true,
  });
};

function envFlag(): boolean {
  const flag = import.meta.env["VITE_ERROR_REPORTING"] as string | undefined;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return Boolean(import.meta.env.PROD);
}

const state: {
  enabled: boolean;
  send: Sender;
  release: string | undefined;
  sentAt: number[];
  seen: Map<string, number>;
  sending: boolean;
} = {
  enabled: envFlag(),
  send: defaultSender,
  release: import.meta.env["VITE_APP_VERSION"] as string | undefined,
  sentAt: [],
  seen: new Map<string, number>(),
  sending: false,
};

/** Override behaviour (tests, embedding hosts). */
export function configureErrorReporter(options: {
  enabled?: boolean;
  send?: Sender;
  release?: string;
}) {
  if (options.enabled !== undefined) state.enabled = options.enabled;
  if (options.send) state.send = options.send;
  if (options.release !== undefined) state.release = options.release;
}

/** Test hook: forget rate-limit and dedupe state and restore defaults. */
export function resetErrorReporter() {
  state.enabled = envFlag();
  state.send = defaultSender;
  state.sentAt = [];
  state.seen.clear();
}

/* --------------------------------- report -------------------------------- */

const PUBLIC_SECTIONS = new Set([
  "",
  "login",
  "register",
  "invite",
  "request-access",
  "privacy",
  "terms",
  "cookies",
  "acceptable-use",
]);

function portalOf(pathname: string): ClientErrorReport["portal"] {
  const section = pathname.split("/")[1] ?? "";
  if (section === "admin") return "admin";
  if (section === "embed") return "embed";
  return PUBLIC_SECTIONS.has(section) ? "public" : "tenant";
}

function describe(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  if (typeof Response !== "undefined" && error instanceof Response) {
    return { name: "Response", message: `Response ${error.status}` };
  }
  if (typeof error === "string") return { name: "Error", message: error };
  try {
    return { name: "Error", message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { name: "Error", message: String(error) };
  }
}

/** Build the (scrubbed, bounded) report for an error. */
export function buildClientErrorReport(
  error: unknown,
  { kind, component }: { kind: ClientErrorKind; component?: string },
): ClientErrorReport {
  const { name, message, stack } = describe(error);
  const location = typeof window !== "undefined" ? window.location : undefined;
  const report: ClientErrorReport = {
    kind,
    name: clip(name, 120),
    // Clip before scrubbing too, so a huge message never costs the tab.
    message: clip(scrubText(clip(message, MAX_MESSAGE * 2)), MAX_MESSAGE) || "Unknown error",
  };
  if (stack) report.stack = clip(scrubText(clip(stack, MAX_STACK * 2)), MAX_STACK);
  if (location) {
    report.url = clip(scrubText(clip(location.href, MAX_URL * 2)), MAX_URL);
    report.route = clip(scrubText(location.pathname), 200);
    const portal = portalOf(location.pathname);
    if (portal) report.portal = portal;
  }
  if (component) report.component = clip(component, 200);
  if (error instanceof ApiError) {
    if (error.requestId) report.requestId = error.requestId;
    report.statusCode = error.statusCode;
    if (error.code && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)) report.code = error.code;
  }
  if (state.release) report.release = clip(state.release, 64);
  return report;
}

/** Expected failures (sign-in needed, validation, not found) are not crashes. */
function isExpected(error: unknown): boolean {
  if (error instanceof ApiError) return error.statusCode > 0 && error.statusCode < 500;
  // Aborted fetches (navigation, React Query cancellation).
  return error instanceof DOMException && error.name === "AbortError";
}

function admit(report: ClientErrorReport, now: number): boolean {
  const fingerprint = `${report.kind}|${report.name}|${report.message}|${(report.stack ?? "").split("\n")[1] ?? ""}`;
  const last = state.seen.get(fingerprint);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false;
  state.sentAt = state.sentAt.filter((at) => now - at < 60_000);
  if (state.sentAt.length >= MAX_REPORTS_PER_MINUTE) return false;
  state.sentAt.push(now);
  state.seen.set(fingerprint, now);
  if (state.seen.size > 100) state.seen.delete(state.seen.keys().next().value as string);
  return true;
}

/**
 * Report an error to the API. Never throws. Returns whether a report was
 * handed to the transport.
 */
export function reportClientError(
  error: unknown,
  context: { kind: ClientErrorKind; component?: string },
): boolean {
  try {
    if (!state.enabled || state.sending || isExpected(error)) return false;
    const report = buildClientErrorReport(error, context);
    if (!admit(report, Date.now())) return false;
    state.sending = true;
    try {
      const sent = state.send(apiUrl("/client-errors"), report);
      if (sent && typeof (sent as Promise<void>).catch === "function") {
        (sent as Promise<void>).catch(() => undefined);
      }
    } finally {
      state.sending = false;
    }
    return true;
  } catch {
    return false;
  }
}

let globalInstalled = false;

/**
 * Report uncaught errors and unhandled rejections from the whole tab.
 * Idempotent; returns an uninstall function.
 */
export function installGlobalErrorReporting(
  target: Window | undefined = typeof window !== "undefined" ? window : undefined,
) {
  if (!target || globalInstalled) return () => undefined;
  globalInstalled = true;
  const onError = (event: ErrorEvent) => {
    reportClientError(event.error ?? event.message, { kind: "error" });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, { kind: "unhandledrejection" });
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    globalInstalled = false;
  };
}
