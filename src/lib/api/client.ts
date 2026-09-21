import type { ApiResponse, FieldError, PaginationMeta, Paged } from "./types";

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

export class ApiError extends Error {
  statusCode: number;
  code: string | undefined;
  errors: FieldError[] | undefined;

  constructor(message: string, statusCode: number, code?: string, errors?: FieldError[]) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
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
 * HttpOnly cookie owned by the backend and is never read from JS.
 */
const tokens: Record<Exclude<Audience, "public">, string | null> = {
  tenant: null,
  admin: null,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function setAccessToken(audience: Exclude<Audience, "public">, token: string | null) {
  tokens[audience] = token;
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
  } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (audience !== "public") {
    const token = tokens[audience];
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  if (tenantSlug) headers["X-Tenant-Id"] = tenantSlug;
  if (method !== "GET") headers["X-Idempotency-Key"] = uuid();
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  return fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    ...(formData ? { body: formData } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  });
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(audience: Exclude<Audience, "public">): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const path = audience === "admin" ? "/admin-auth/refresh" : "/auth/refresh";
        const response = await rawRequest(path, { method: "POST", audience, noRefresh: true });
        if (!response.ok) return false;
        const payload = (await response.json()) as ApiResponse<{ accessToken?: string }>;
        const token = payload?.data?.accessToken;
        if (!token) return false;
        setAccessToken(audience, token);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
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
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  let response = await rawRequest(path, options);

  const audience = options.audience ?? "tenant";
  if (
    response.status === 401 &&
    audience !== "public" &&
    !options.noRefresh &&
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
    throw new ApiError(
      err?.message || response.statusText || "Request failed",
      response.status,
      err?.code,
      err?.errors,
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
