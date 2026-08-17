import { request, requestPaged, type Query } from "./client";
import type { AnalyticsQueryParams, Report } from "./types";

export function list(query: Query = {}) {
  return requestPaged<Report>("/reports", { query });
}

export function get(id: string) {
  return request<Report>(`/reports/${id}`);
}

export interface ReportInput {
  name: string;
  source: "widget" | "query";
  sourceWidgetId?: string;
  sourceQuery?: AnalyticsQueryParams;
  format: "json" | "csv" | "xlsx";
  schedule?: {
    enabled?: boolean;
    cron?: string;
    timezone?: string;
    recipients?: string[];
  };
}

export function create(body: ReportInput) {
  return request<Report>("/reports", { method: "POST", body });
}

export function update(id: string, body: Partial<ReportInput>) {
  return request<Report>(`/reports/${id}`, { method: "PATCH", body });
}

export function run(id: string, body: { format?: string; filters?: unknown } = {}) {
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
