import { requestFull, request, requestPaged, type Query } from "./client";
import type {
  AnalyticsQueryParams,
  AnalyticsResult,
  Dashboard,
  DashboardExecutionEntry,
  Widget,
  WidgetType,
} from "./types";

export function list(query: Query = {}) {
  return requestPaged<Dashboard>("/dashboards", { query });
}

export function get(id: string, includeWidgets = true) {
  return request<Dashboard>(`/dashboards/${id}`, {
    query: { includeWidgets: String(includeWidgets) },
  });
}

export function create(body: {
  name: string;
  description?: string;
  layout?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  refresh?: Record<string, unknown>;
}) {
  return request<Dashboard>("/dashboards", { method: "POST", body });
}

export function update(
  id: string,
  body: {
    name?: string;
    description?: string;
    status?: Dashboard["status"];
    layout?: Record<string, unknown>;
    filters?: Record<string, unknown>;
    refresh?: Record<string, unknown>;
  },
) {
  return request<Dashboard>(`/dashboards/${id}`, { method: "PATCH", body });
}

export function publish(id: string) {
  return request<Dashboard>(`/dashboards/${id}/publish`, { method: "POST", body: {} });
}

export function duplicate(id: string) {
  return request<Dashboard>(`/dashboards/${id}/duplicate`, { method: "POST", body: {} });
}

export function share(id: string, body: { email: string; role: "viewer"; expiresAt?: string }) {
  return request<Dashboard>(`/dashboards/${id}/share`, { method: "POST", body });
}

export function revokeShare(id: string, entryId: string) {
  return request<unknown>(`/dashboards/${id}/share/${entryId}`, { method: "DELETE" });
}

export function remove(id: string) {
  return request<unknown>(`/dashboards/${id}`, { method: "DELETE" });
}

export function execute(id: string) {
  return request<DashboardExecutionEntry[]>(`/dashboards/${id}/execute`);
}

export function listWidgets(dashboardId: string, query: Query = {}) {
  return requestPaged<Widget>(`/dashboards/${dashboardId}/widgets`, { query });
}

export function getWidget(dashboardId: string, widgetId: string) {
  return request<Widget>(`/dashboards/${dashboardId}/widgets/${widgetId}`);
}

export interface WidgetInput {
  name: string;
  type: WidgetType;
  datasetId: string;
  query?: AnalyticsQueryParams;
  visualization?: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
}

export function createWidget(dashboardId: string, body: WidgetInput) {
  return request<Widget>(`/dashboards/${dashboardId}/widgets`, { method: "POST", body });
}

export function updateWidget(dashboardId: string, widgetId: string, body: Partial<WidgetInput>) {
  return request<Widget>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
    method: "PATCH",
    body,
  });
}

export function removeWidget(dashboardId: string, widgetId: string) {
  return request<unknown>(`/dashboards/${dashboardId}/widgets/${widgetId}`, {
    method: "DELETE",
  });
}

export async function executeWidget(dashboardId: string, widgetId: string) {
  const payload = await requestFull<AnalyticsResult>(
    `/dashboards/${dashboardId}/widgets/${widgetId}/execute`,
  );
  return { result: payload.data, meta: payload.meta ?? {} };
}
