import { request, requestPaged, type Query } from "./client";
import type { ApiKey, ApiKeyScope } from "./types";

export function list(query: Query = {}) {
  return requestPaged<ApiKey>("/api-keys", { query });
}

export function get(id: string) {
  return request<ApiKey>(`/api-keys/${id}`);
}

/** The `secret` is returned ONCE at creation and must never be persisted. */
export function create(body: { name: string; scopes: ApiKeyScope[]; expiresAt?: string }) {
  return request<{ key: ApiKey; secret: string }>("/api-keys", { method: "POST", body });
}

export function update(
  id: string,
  body: { name?: string; scopes?: ApiKeyScope[]; expiresAt?: string },
) {
  return request<ApiKey>(`/api-keys/${id}`, { method: "PATCH", body });
}

export function revoke(id: string, reason?: string) {
  return request<unknown>(`/api-keys/${id}/revoke`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
}
