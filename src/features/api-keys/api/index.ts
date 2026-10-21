import { apiUrl, request, requestFull, requestPaged, type Query } from "@/lib/api/client";
import type { ApiKey, ApiKeyScope } from "@/lib/api/types";

export function list(query: Query = {}) {
  return requestPaged<ApiKey>("/api-keys", { query });
}

export function get(id: string) {
  return request<ApiKey>(`/api-keys/${id}`);
}

/** The `secret` is returned ONCE at creation and must never be persisted. */
export function create(body: {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
  ipAllowList?: string[];
}) {
  return request<{ key: ApiKey; secret: string }>("/api-keys", { method: "POST", body });
}

export function update(
  id: string,
  body: { name?: string; scopes?: ApiKeyScope[]; expiresAt?: string; ipAllowList?: string[] },
) {
  return request<ApiKey>(`/api-keys/${id}`, { method: "PATCH", body });
}

export function revoke(id: string, reason?: string) {
  return request<unknown>(`/api-keys/${id}/revoke`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}

export interface RotateResult {
  newKey: Pick<ApiKey, "id" | "prefix" | "name" | "scopes" | "expiresAt">;
  oldKeyRevoked: boolean;
  overlapEndsAt: string;
  secret: string;
}

/** Rotate: a new secret (shown once); the old key works until `overlapEndsAt`. */
export function rotate(id: string) {
  return request<RotateResult>(`/api-keys/${id}/rotate`, { method: "POST", body: {} });
}

export interface ApiKeyUsage {
  total: number;
  days: Array<{ day: string; total: number; errors: number }>;
  byEndpoint: Array<{ endpoint: string; status: number; count: number }>;
}

export function usage(id: string, days = 7) {
  return request<ApiKeyUsage>(`/api-keys/${id}/usage`, { query: { days } });
}

export interface ScopeCatalogue {
  scopes: Array<{ scope: ApiKeyScope; description: string }>;
  maxTtlDays: number | null;
  rotationOverlapMinutes: number | null;
}

export async function scopes(): Promise<ScopeCatalogue> {
  const res =
    await requestFull<Array<{ scope: ApiKeyScope; description: string }>>("/api-keys/scopes");
  const meta = (res.meta ?? {}) as { maxTtlDays?: number; rotationOverlapMinutes?: number };
  return {
    scopes: res.data ?? [],
    maxTtlDays: meta.maxTtlDays ?? null,
    rotationOverlapMinutes: meta.rotationOverlapMinutes ?? null,
  };
}

/** Public OpenAPI 3.1 reference of the external API (a bare JSON document, no envelope). */
export async function openApi(): Promise<OpenApiDoc> {
  const res = await fetch(apiUrl("/external/openapi.json"), { credentials: "omit" });
  if (!res.ok) throw new Error(`Unable to load the API reference (${res.status})`);
  return (await res.json()) as OpenApiDoc;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  "x-scope"?: string | null;
  parameters?: Array<{ name: string; in: string; required?: boolean; description?: string }>;
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { example?: unknown }> }
  >;
  "x-codeSamples"?: Array<{ lang: string; source: string }>;
}

export interface OpenApiDoc {
  openapi: string;
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  "x-errorCodes"?: Record<string, { status: number; description: string }>;
}
