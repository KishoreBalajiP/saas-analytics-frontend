import { request, requestPaged, type Query } from "@/lib/api/client";
import type {
  AlertEvent,
  AlertEvaluationOutcome,
  AlertGroupEvaluation,
  AlertRule,
  AnalyticsQueryParams,
} from "@/lib/api/types";

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
  description?: string;
  datasetId?: string;
  /** An output of the query (metric alias, or `count` without metrics); omitted = first output. */
  metric?: string;
  groupEvaluation?: AlertGroupEvaluation;
  condition: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between";
  threshold: number;
  thresholdHigh?: number;
  source: "widget" | "query";
  dashboardId?: string;
  widgetId?: string;
  query?: AnalyticsQueryParams;
  schedule?: { cron?: string; timezone?: string | null };
  cooldownMinutes?: number;
  repeatMode?: "once_per_incident" | "after_cooldown";
  enabled?: boolean;
  notification?: {
    channels?: Array<"email" | "in_app">;
    recipients?: Array<{ type?: "user" | "email"; value: string }>;
    template?: unknown;
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

export interface AlertEvaluationResult {
  triggered: boolean;
  suppressed?: boolean;
  conditionMet?: boolean;
  noData?: boolean;
  outcome?: AlertEvaluationOutcome | "disabled";
  value?: number | null;
  groupsEvaluated?: number | null;
  groupsMatched?: number | null;
  event?: AlertEvent | null;
  disabled?: boolean;
}

export function evaluate(id: string) {
  return request<AlertEvaluationResult>(`/alerts/${id}/evaluate`, { method: "POST", body: {} });
}

export function listEvents(id: string, query: Query = {}) {
  return requestPaged<AlertEvent>(`/alerts/${id}/events`, { query });
}
