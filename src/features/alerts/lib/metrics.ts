import type { AlertGroupEvaluation, QueryMetric } from "@/lib/api/types";

/**
 * The alert metric contract (mirrors the API): an alert's `metric` must name
 * an output column of its query — a metric alias (`<op>_<field>` unless
 * `alias` is set, `count` for a bare count) — or `count` when the query
 * defines no metrics. Anything else is refused with 400 ALERT_METRIC_INVALID.
 */
export function metricAlias(metric: Partial<QueryMetric>): string {
  if (metric.alias) return metric.alias;
  return metric.field ? `${metric.op}_${metric.field}` : String(metric.op ?? "count");
}

/** Output columns of a query an alert may watch (unknown shape: `count`). */
export function queryOutputs(query: unknown): string[] {
  const metrics =
    query && typeof query === "object" && !Array.isArray(query)
      ? (query as { metrics?: unknown }).metrics
      : undefined;
  if (!Array.isArray(metrics) || metrics.length === 0) return ["count"];
  const names = metrics
    .filter((m): m is Partial<QueryMetric> => Boolean(m) && typeof m === "object")
    .map(metricAlias);
  return names.length ? Array.from(new Set(names)) : ["count"];
}

/** True when the query groups its rows (group evaluation then matters). */
export function isGrouped(query: unknown): boolean {
  if (!query || typeof query !== "object" || Array.isArray(query)) return false;
  const groupBy = (query as { groupBy?: unknown }).groupBy;
  return Array.isArray(groupBy) && groupBy.length > 0;
}

export const GROUP_EVALUATION_LABELS: Record<AlertGroupEvaluation, string> = {
  total: "Total across all groups",
  any: "Any group meets the condition",
  all: "Every group meets the condition",
};

/** Parse query JSON leniently: `undefined` while the text is not valid JSON. */
export function parseQueryJson(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
