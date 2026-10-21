import { ApiError, apiUrl, request, requestPaged, type Query } from "@/lib/api/client";
import type { DashboardExecutionEntry, EmbedToken } from "@/lib/api/types";

export type EmbedTheme = "light" | "dark" | "auto";

export interface EmbedFilterEnvelope {
  dateRange?: unknown;
  filters?: Array<{ field: string; op: string; value?: unknown }>;
  filtersOp?: "and" | "or";
}

export function list(query: Query = {}) {
  return requestPaged<EmbedToken>("/embed/tokens", { query });
}

export function get(id: string) {
  return request<EmbedToken>(`/embed/tokens/${id}`);
}

/**
 * Mint a signed embed token. The `secret` (a signed JWT) is returned ONCE.
 * Production hosts mint from their backend with an API key
 * (`POST /embed/api/tokens`, scope `embed:create`); this call is for tests
 * and previews from the console.
 */
export function create(body: {
  dashboardId: string;
  widgetId?: string;
  name?: string;
  ttlSec?: number;
  allowedOrigins?: string[];
  lockedFilters?: EmbedFilterEnvelope;
  params?: Record<string, string | number | boolean>;
  theme?: EmbedTheme;
}) {
  return request<{ token: EmbedToken; secret: string }>("/embed/tokens", {
    method: "POST",
    body,
  });
}

export function revoke(id: string, reason?: string) {
  return request<unknown>(`/embed/tokens/${id}/revoke`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

/** Public share link: the secret goes in the URL fragment (`/share#<secret>`). */
export function createShare(body: { dashboardId: string; name?: string; ttlSec?: number }) {
  return request<{ token: EmbedToken; secret: string }>("/embed/shares", {
    method: "POST",
    body,
  });
}

export interface EmbedConfig {
  allowedOrigins: string[];
  defaultTheme: EmbedTheme;
}

export function getConfig() {
  return request<EmbedConfig>("/embed/config");
}

export function updateConfig(body: Partial<EmbedConfig>) {
  return request<EmbedConfig>("/embed/config", { method: "PUT", body });
}

/* ---------------------------- public surface ----------------------------- */

/** The public, sanitised dashboard fields an embed session may read. */
export interface EmbedDashboard {
  id: string;
  name: string;
  description?: string;
  layout?: unknown;
  updatedAt?: string;
}

export interface EmbedView {
  dashboard: EmbedDashboard | null;
  widgets: DashboardExecutionEntry[];
  theme?: EmbedTheme;
}

export interface EmbedSession {
  sessionToken: string;
  expiresAt: string;
  theme: EmbedTheme;
  widgetId: string | null;
}

export interface SharePayload {
  dashboard: { name: string; description: string };
  widgets: Array<{
    key: string;
    name: string;
    type: string;
    status: string;
    result?: { columns: string[]; rows: Record<string, unknown>[]; total: number | null };
  }>;
}

/**
 * Public calls never send cookies (`credentials: "omit"`) and carry tokens
 * only in the body or the Authorization header, never in the URL.
 */
async function publicPost<T>(path: string, body: unknown, bearer?: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    credentials: "omit",
    body: JSON.stringify(body ?? {}),
  });
  type Envelope = { data?: T; message?: string; code?: string };
  let json: Envelope | null = null;
  try {
    json = (await res.json()) as Envelope;
  } catch {
    json = null;
  }
  if (!res.ok) throw new ApiError(json?.message ?? "Request failed", res.status, json?.code);
  return json?.data as T;
}

export function exchangeSession(token: string, parentOrigin: string) {
  return publicPost<EmbedSession>("/embed/public/session", { token, parentOrigin });
}

export function viewEmbed(
  sessionToken: string,
  parentOrigin: string,
  filters?: EmbedFilterEnvelope,
) {
  return publicPost<EmbedView>(
    "/embed/public/view",
    { parentOrigin, ...(filters ? { filters } : {}) },
    sessionToken,
  );
}

export function viewShare(secret: string) {
  return publicPost<SharePayload>("/embed/public/share", { secret });
}
