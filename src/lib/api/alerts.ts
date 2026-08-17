import { request, requestPaged, type Query } from "./client";
import type { AlertEvent, AlertRule, AnalyticsQueryParams, FilterOp } from "./types";

export function list(query: Query = {}) {
  return requestPaged<AlertRule>("/alerts", { query });
}

export function listAllEvents(query: Query = {}) {
  return requestPaged<AlertEvent>("/alerts/events", { query });
}

export function get(id: string) {
  return request<AlertRule>(`/alerts/${id}`);
}

export interface AlertInput {
  name: string;
  datasetId: string;
  condition: { field: string; op: FilterOp; value: unknown };
  source: "widget" | "query";
  sourceWidgetId?: string;
  sourceQuery?: AnalyticsQueryParams;
  schedule?: { cron?: string; timezone?: string };
  cooldownMinutes?: number;
  enabled?: boolean;
  notification?: {
    channels?: Array<"email" | "in_app">;
    recipients?: string[];
    template?: string;
  };
}

export function create(body: AlertInput) {
  return request<AlertRule>("/alerts", { method: "POST", body });
}

export function update(id: string, body: Partial<AlertInput>) {
  return request<AlertRule>(`/alerts/${id}`, { method: "PATCH", body });
}

export function remove(id: string) {
  return request<unknown>(`/alerts/${id}`, { method: "DELETE" });
}

export function evaluate(id: string) {
  return request<{ triggered: boolean; event?: AlertEvent; disabled?: boolean }>(
    `/alerts/${id}/evaluate`,
    { method: "POST", body: {} },
  );
}

export function listEvents(id: string, query: Query = {}) {
  return requestPaged<AlertEvent>(`/alerts/${id}/events`, { query });
}
