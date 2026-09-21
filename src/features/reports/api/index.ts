import { request, requestPaged, type Query } from "@/lib/api/client";
import type { AnalyticsQueryParams, Report } from "@/lib/api/types";

export function list(query: Query = {}) {
  return requestPaged<Report>("/reports", { query });
}

export function get(id: string) {
  return request<Report>(`/reports/${id}`);
}

export interface ReportInput {
  name: string;
  description?: string;
  source: "widget" | "query";
  dashboardId?: string;
  widgetId?: string;
  query?: AnalyticsQueryParams;
  format: "json" | "csv" | "xlsx";
  filters?: Record<string, unknown>;
  schedule?: {
    enabled?: boolean;
    cron?: string;
    timezone?: string;
    format?: "json" | "csv" | "xlsx";
    recipients?: Array<{ type?: "user" | "external"; value: string }>;
  };
  status?: string;
}

export function create(body: ReportInput) {
  return request<Report>("/reports", { method: "POST", body });
}

export function update(id: string, body: Partial<ReportInput>) {
  return request<Report>(`/reports/${id}`, { method: "PATCH", body });
}

export function run(
  id: string,
  body: { format?: "json" | "csv" | "xlsx"; filters?: Record<string, unknown> } = {},
) {
  return request<{ accepted?: boolean; runId?: string; status?: string }>(`/reports/${id}/run`, {
    method: "POST",
    body,
  });
}

export function remove(id: string) {
  return request<unknown>(`/reports/${id}`, { method: "DELETE" });
}

export function download(id: string, runId?: string) {
  const query: Query = {};
  if (runId) query["runId"] = runId;
  return request<{ url: string; expiresAt?: string }>(`/reports/${id}/download`, { query });
}
