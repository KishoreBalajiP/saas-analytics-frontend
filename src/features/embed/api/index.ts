import { apiUrl, request, requestPaged, type Query } from "@/lib/api/client";
import type { DashboardExecutionEntry, EmbedToken } from "@/lib/api/types";

export function list(query: Query = {}) {
  return requestPaged<EmbedToken>("/embed/tokens", { query });
}

export function get(id: string) {
  return request<EmbedToken>(`/embed/tokens/${id}`);
}

/** The `secret` token string is returned ONCE at creation. */
export function create(body: {
  dashboardId: string;
  widgetId?: string;
  name?: string;
  ttlSec?: number;
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

/** Public read — no credentials are sent. */
export function getEmbed(token: string) {
  return request<DashboardExecutionEntry[]>(`/embed/${token}`, { audience: "public" });
}

export function embedPublicUrl(token: string) {
  return apiUrl(`/embed/${token}`);
}
