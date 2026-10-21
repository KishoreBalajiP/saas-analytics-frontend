import type { ApiResponse, FieldError, PaginationMeta, Paged } from "./types";
import {
  browserTransports,
  createRefreshCoordinator,
  type RefreshCoordinator,
  type RefreshResult,
} from "@/lib/auth/refreshCoordinator";
import { forgetSession, rememberSession } from "@/lib/auth/sessionHint";

const configuredBaseUrl = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
// Localhost is useful for development, but must never become a production
// dependency when a deployment is missing its API configuration.
const BASE_URL =
  configuredBaseUrl ||
  (import.meta.env.PROD && typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:8080");
const PREFIX = (import.meta.env["VITE_API_PREFIX"] as string) ?? "/api/v1";

export type Audience = "tenant" | "admin" | "public";
type PortalAudience = Exclude<Audience, "public">;

export class ApiError extends Error {
  statusCode: number;
  code: string | undefined;
  errors: FieldError[] | undefined;
  /**
   * The request's `X-Request-Id` (echoed by the API, or the id this client
   * sent). Shown to users as a copyable "Reference ID" so support can find
   * the backend log lines of the failed call.
   */
  requestId: string | undefined;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    errors?: FieldError[],
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    this.requestId = requestId;
  }

  get isUnauthorized() {
    return this.statusCode === 401;
  }
  get isForbidden() {
    return this.statusCode === 403;
  }
  get isNotFound() {
    return this.statusCode === 404;
  }
  get isValidation() {
    return this.statusCode === 422;
  }
  get isRateLimited() {
    return this.statusCode === 429;
  }
  get isNotImplemented() {
    return this.statusCode === 501;
  }
}

/**
 * Access tokens live in memory only (never localStorage). The refresh token is an
 * HttpOnly cookie owned by the backend and is never read from JS (responses no
 * longer carry it at all).
 */
const tokens: Record<Exclude<Audience, "public">, string | null> = {
  tenant: null,
  admin: null,
};

/** True when a 401 refresh attempt has already fired and failed for the
 * given audience. The requestFull hook skips the auto-refresh-and-retry
 * to prevent a refresh storm on every TenantSessionProvider mount. */
const sessionAbsent: Record<Exclude<Audience, "public">, boolean> = {
  tenant: false,
  admin: false,
};

/**
 * support (roadmap 2.3): while a read-only support session is open in this
 * tab, the tenant token IS the support token. It is never refreshed (support
 * sessions end with their token) and never replaced by another tab's tenant
 * session, so the operator can never silently become a different identity.
 */
let supportSessionActive = false;

export function setSupportSessionActive(active: boolean) {
  supportSessionActive = active;
}

export function isSupportSessionActive() {
  return supportSessionActive;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function setAccessToken(audience: Exclude<Audience, "public">, token: string | null) {
  tokens[audience] = token;
  // When a token is cleared the absent flag must also be cleared, because
  // a later login could re-establish a session.
  if (token) {
    sessionAbsent[audience] = false;
    // A tab with a session listens to the other tabs from now on (shared
    // refresh results, sign-out).
    getCoordinator();
  }
  listeners.forEach((l) => l());
}

export function getAccessToken(audience: Exclude<Audience, "public">) {
  return tokens[audience];
}

export function subscribeTokens(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  audience?: Audience;
  /** Only sent on tenant login / password endpoints, per the contract. */
  tenantSlug?: string;
  formData?: FormData;
  signal?: AbortSignal;
  /** Skip the automatic single refresh-and-retry (used by the refresh call itself). */
  noRefresh?: boolean;
  /**
   * Idempotency key for a mutation. Defaults to a fresh key per logical
   * request; the automatic retry after a token refresh reuses it, so the
   * server can replay instead of repeating the side effect.
   */
  idempotencyKey?: string;
  /**
   * Give up after this long with `ApiError` code `REQUEST_TIMEOUT`.
   * Defaults to 60 s for JSON requests; uploads (`formData`) have no
   * default limit. `0` disables the timeout.
   */
  timeoutMs?: number;
}

/** Correlation header sent on every request and echoed by the API. */
export const REQUEST_ID_HEADER = "X-Request-Id";
export const REQUEST_TIMEOUT = "REQUEST_TIMEOUT";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Ids this client sent, per response (fallback when the header is not exposed). */
const sentRequestIds = new WeakMap<Response, string>();

/** The response's request id: echoed header, error body, or the id sent. */
function requestIdOf(response: Response, payload?: unknown): string | undefined {
  const header = response.headers?.get?.(REQUEST_ID_HEADER);
  if (header) return header;
  const body = (payload as { requestId?: unknown } | undefined)?.requestId;
  if (typeof body === "string" && body) return body;
  return sentRequestIds.get(response);
}

type ErrorListener = (error: ApiError) => void;
const errorListeners = new Set<ErrorListener>();

/**
 * Observe every `ApiError` the client throws for a failed HTTP response
 * (used to attach the reference id to error toasts). Returns an unsubscribe.
 */
export function onApiError(listener: ErrorListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

function emitApiError(error: ApiError): ApiError {
  errorListeners.forEach((listener) => {
    try {
      listener(error);
    } catch {
      // a broken listener must never change the request outcome
    }
  });
  return error;
}

/** Caller abort and/or timeout as one signal. */
function combineSignals(
  signal: AbortSignal | undefined,
  timeout: AbortSignal | undefined,
): AbortSignal | undefined {
  if (!signal) return timeout;
  if (!timeout) return signal;
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  // Without AbortSignal.any the caller's signal wins (no timeout).
  return typeof any === "function" ? any([signal, timeout]) : signal;
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(`${PREFIX}${path}`, BASE_URL);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Request ids match the API's accepted format (8-128 of `[A-Za-z0-9._:-]`). */
function newRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Never log Authorization / X-Api-Key values. */
export function redactHeaders(headers: Record<string, string>) {
  const clone = { ...headers };
  for (const key of Object.keys(clone)) {
    if (/^(authorization|x-api-key)$/i.test(key)) clone[key] = "[redacted]";
  }
  return clone;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const {
    method = "GET",
    body,
    query,
    audience = "tenant",
    tenantSlug,
    formData,
    signal,
    idempotencyKey,
    timeoutMs,
  } = options;

  // One correlation id per HTTP attempt (validated and echoed by the API).
  const requestId = newRequestId();
  const headers: Record<string, string> = {
    Accept: "application/json",
    [REQUEST_ID_HEADER]: requestId,
  };
  if (audience !== "public") {
    const token = tokens[audience];
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  if (tenantSlug) headers["X-Tenant-Id"] = tenantSlug;
  // Signed-in mutations are replay-safe on the server when they carry a key
  // (scoped there to the actor, tenant and route).
  if (method !== "GET" && audience !== "public") {
    headers["X-Idempotency-Key"] = idempotencyKey ?? uuid();
  }
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  const limit = timeoutMs ?? (formData ? 0 : DEFAULT_TIMEOUT_MS);
  const timeout = limit > 0 ? timeoutSignal(limit) : undefined;
  const combined = combineSignals(signal, timeout);
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: "include",
      ...(formData ? { body: formData } : body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(combined ? { signal: combined } : {}),
    });
  } catch (err) {
    // Our own time limit (not a caller abort): a typed, retryable error.
    if (timeout?.aborted && !signal?.aborted) {
      throw emitApiError(
        new ApiError(
          "The server took too long to respond. Please try again.",
          408,
          REQUEST_TIMEOUT,
          undefined,
          requestId,
        ),
      );
    }
    throw err;
  }
  if (response && typeof response === "object") sentRequestIds.set(response, requestId);
  return response;
}

const REFRESH_PATHS: Record<PortalAudience, string> = {
  tenant: "/auth/refresh",
  admin: "/admin-auth/refresh",
};
const REFRESH_TIMEOUT_MS = 15_000;

type SignOutListener = (audience: PortalAudience) => void;
const signOutListeners = new Set<SignOutListener>();

/** Notified when ANOTHER tab signs out of a portal. */
export function onRemoteSignOut(listener: SignOutListener): () => void {
  signOutListeners.add(listener);
  return () => {
    signOutListeners.delete(listener);
  };
}

let coordinator: RefreshCoordinator | null = null;

/**
 * Lazily created so SSR and tests without browser transports still work.
 * Refreshes are single-flight per portal within the tab and, through Web
 * Locks + BroadcastChannel, across every tab of the browser.
 */
function getCoordinator(): RefreshCoordinator {
  if (!coordinator) {
    coordinator = createRefreshCoordinator({
      ...browserTransports(),
      onPeerRefresh: (audience, result) => {
        // support: another tab's tenant session never replaces a support token.
        if (audience === "tenant" && supportSessionActive) return;
        setAccessToken(audience, result.accessToken);
      },
      onPeerSignOut: (audience) => {
        if (audience === "tenant" && supportSessionActive) return;
        tokens[audience] = null;
        sessionAbsent[audience] = true;
        listeners.forEach((l) => l());
        signOutListeners.forEach((l) => l(audience));
      },
    });
  }
  return coordinator;
}

/** Test hook: drop the coordinator so the next refresh builds a new one. */
export function resetRefreshCoordination() {
  coordinator?.dispose();
  coordinator = null;
}

function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(ms)
    : undefined;
}

/**
 * Exchange the HttpOnly refresh cookie for a new access token. Coordinated
 * across tabs so two tabs never present the same (rotating) cookie at once.
 * Throws an `ApiError` (with the server's `code`, e.g.
 * `SESSION_COOKIE_MISSING`) when the session cannot be restored.
 */
export async function refreshAccessToken(audience: PortalAudience): Promise<RefreshResult> {
  if (audience === "tenant" && supportSessionActive) {
    throw new ApiError("The support session has ended", 401, "SUPPORT_SESSION_ENDED");
  }
  const result = await getCoordinator().run(audience, async () => {
    const signal = timeoutSignal(REFRESH_TIMEOUT_MS);
    const response = await rawRequest(REFRESH_PATHS[audience], {
      method: "POST",
      audience,
      noRefresh: true,
      ...(signal ? { signal } : {}),
    });
    const payload = await parse<Partial<RefreshResult>>(response);
    if (!response.ok) {
      const err = payload as unknown as { message?: string; code?: string; errors?: FieldError[] };
      // Anything but a missing cookie means the server ended the session.
      if (err?.code !== "SESSION_COOKIE_MISSING") forgetSession(audience);
      throw new ApiError(
        err?.message || response.statusText || "Session refresh failed",
        response.status,
        err?.code,
        err?.errors,
        requestIdOf(response, payload),
      );
    }
    const data = payload?.data;
    if (!data?.accessToken) {
      throw new ApiError(
        "Session refresh returned no access token",
        response.status,
        undefined,
        undefined,
        requestIdOf(response, payload),
      );
    }
    rememberSession(audience, data.sessionExpiresAt ?? null);
    return {
      accessToken: data.accessToken,
      ...(data.expiresIn !== undefined ? { expiresIn: data.expiresIn } : {}),
      sessionExpiresAt: data.sessionExpiresAt ?? null,
    };
  });
  setAccessToken(audience, result.accessToken);
  return result;
}

/** Tell the other tabs this portal was signed out (after a local sign-out). */
export function announceSignOut(audience: PortalAudience) {
  forgetSession(audience);
  getCoordinator().announceSignOut(audience);
}

async function refreshSession(audience: PortalAudience): Promise<boolean> {
  // Do not re-trigger a refresh if one already failed and marked the
  // session as absent — this prevents a refresh storm on every
  // TenantSessionProvider mount.
  if (sessionAbsent[audience]) return false;
  // support: a support session is never refreshed into a cookie session.
  if (audience === "tenant" && supportSessionActive) return false;
  try {
    await refreshAccessToken(audience);
    return true;
  } catch {
    sessionAbsent[audience] = true;
    return false;
  }
}

async function parse<T>(response: Response): Promise<ApiResponse<T>> {
  const text = await response.text();
  if (!text) {
    return {
      success: response.ok,
      statusCode: response.status,
      message: response.statusText,
      data: undefined as T,
      timestamp: new Date().toISOString(),
    };
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return {
      success: response.ok,
      statusCode: response.status,
      message: text.slice(0, 300),
      data: undefined as T,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function requestFull<T>(
  path: string,
  requestOptions: RequestOptions = {},
): Promise<ApiResponse<T>> {
  // One idempotency key per logical request, reused by the retry below.
  const options: RequestOptions =
    requestOptions.method && requestOptions.method !== "GET" && !requestOptions.idempotencyKey
      ? { ...requestOptions, idempotencyKey: uuid() }
      : requestOptions;
  let response = await rawRequest(path, options);

  const audience = options.audience ?? "tenant";
  if (
    response.status === 401 &&
    audience !== "public" &&
    !options.noRefresh &&
    !sessionAbsent[audience] &&
    !path.includes("/login") &&
    !path.includes("/refresh")
  ) {
    const refreshed = await refreshSession(audience);
    if (refreshed) {
      // Retry exactly once.
      response = await rawRequest(path, { ...options, noRefresh: true });
    }
  }

  const payload = await parse<T>(response);

  if (!response.ok) {
    const err = payload as unknown as {
      message?: string;
      code?: string;
      errors?: FieldError[];
    };
    if (response.status === 401 && audience !== "public") setAccessToken(audience, null);
    throw emitApiError(
      new ApiError(
        err?.message || response.statusText || "Request failed",
        response.status,
        err?.code,
        err?.errors,
        requestIdOf(response, payload),
      ),
    );
  }

  return payload;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await requestFull<T>(path, options);
  return payload.data;
}

export async function requestPaged<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Paged<T>> {
  const payload = await requestFull<T[]>(path, options);
  const meta = (payload.meta ?? {}) as PaginationMeta & Record<string, unknown>;
  const data = Array.isArray(payload.data) ? payload.data : [];
  return {
    data,
    meta: {
      ...meta,
      page: Number(meta.page ?? 1),
      limit: Number(meta.limit ?? data.length),
      total: Number(meta.total ?? data.length),
      pages: Number(meta.pages ?? 1),
    },
  };
}

/** Absolute URL helper for public links (embed previews, curl snippets). */
export function apiUrl(path: string, query?: Query) {
  return buildUrl(path, query);
}

// reports: roadmap 1.5 - signed download links.
/**
 * Resolve a link returned by the API: absolute URLs (e.g. presigned S3
 * downloads) are kept, paths such as `/api/v1/files/<token>` are resolved
 * against the API origin.
 */
export function resolveApiHref(href: string) {
  return new URL(href, BASE_URL).toString();
}
