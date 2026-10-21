import { request, requestPaged, type Query } from "@/lib/api/client";

export type MetricStatus = "draft" | "approved" | "archived";
export type MetricAggregation = "count" | "sum" | "avg" | "min" | "max" | "count_distinct";

export interface MetricPart {
  aggregation: MetricAggregation;
  field?: string | null;
  filters?: unknown[];
}

export interface MetricDefinition {
  id: string;
  key: string;
  version: number;
  label: string;
  description?: string;
  connectorId: string | null;
  aggregation: MetricAggregation | "ratio";
  field?: string | null;
  numerator?: MetricPart | null;
  denominator?: MetricPart | null;
  filters?: unknown[];
  unit?: string | null;
  format: string;
  direction: string;
  source?: "manual" | "profiler";
  status: MetricStatus;
  approvedVersion?: number | null;
  versions?: Array<{ version: number; status: MetricStatus; createdAt?: string }>;
}

export type MetricInput = Partial<Omit<MetricDefinition, "id" | "version" | "status">>;

export function list(query: Query = {}) {
  return requestPaged<MetricDefinition>("/metrics", { query });
}
export function get(key: string, version?: number) {
  return request<MetricDefinition>(`/metrics/${key}`, { query: version ? { version } : {} });
}
export function create(body: MetricInput) {
  return request<MetricDefinition>("/metrics", { method: "POST", body });
}
/** Edit = a new draft version. */
export function update(key: string, body: MetricInput) {
  return request<MetricDefinition>(`/metrics/${key}`, { method: "PATCH", body });
}
export function approve(key: string, version: number) {
  return request<MetricDefinition>(`/metrics/${key}/versions/${version}/approve`, {
    method: "POST",
    body: {},
  });
}
export function archive(key: string) {
  return request<unknown>(`/metrics/${key}`, { method: "DELETE" });
}
export function suggest(connectorId: string) {
  return request<{ created: MetricDefinition[] }>("/metrics/suggest", {
    method: "POST",
    body: { connectorId },
  });
}
