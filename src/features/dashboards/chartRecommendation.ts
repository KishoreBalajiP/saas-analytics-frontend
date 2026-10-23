import type { AnalyticsQueryParams, WidgetType } from "@/lib/api/types";

type Row = Record<string, unknown>;

export const ALL_WIDGET_TYPES: WidgetType[] = [
  "kpi",
  "table",
  "bar",
  "line",
  "area",
  "pie",
  "doughnut",
  "scatter",
];

export const WIDGET_TYPE_LABELS: Record<WidgetType, string> = {
  kpi: "KPI",
  table: "Table",
  bar: "Bar",
  line: "Line",
  area: "Area",
  pie: "Pie",
  doughnut: "Doughnut",
  scatter: "Scatter",
};

function shape(query: AnalyticsQueryParams | undefined) {
  const groupBy = query?.groupBy ?? [];
  const metrics = query?.metrics ?? [];
  const hasDateBucket = groupBy.some((g) => typeof g === "object" && g !== null && !!g.bucket);
  return { dims: groupBy.length, measures: metrics.length, hasDateBucket };
}

/**
 * Widget types the backend accepts for this query (mirrors the server's
 * visualization rules: kpi = metrics without groupBy; charts need a groupBy;
 * pie/doughnut exactly one measure; scatter two or more).
 */
export function supportedWidgetTypes(query: AnalyticsQueryParams | undefined): WidgetType[] {
  const { dims, measures } = shape(query);
  const out: WidgetType[] = ["table"];
  if (!dims && measures > 0) out.unshift("kpi");
  if (dims) {
    out.push("bar", "line", "area");
    // An omitted metric list counts rows: one implicit measure.
    if (measures <= 1) out.push("pie", "doughnut");
    if (measures >= 2) out.push("scatter");
  }
  return out;
}

/**
 * Automatic chart choice: single value -> kpi, date bucket -> line,
 * two measures -> scatter, <= 6 categories with one measure -> pie,
 * category + measure -> bar, otherwise table.
 */
export function recommendChartType(
  query: AnalyticsQueryParams | undefined,
  rows: Row[] = [],
): WidgetType {
  const { dims, measures, hasDateBucket } = shape(query);
  if (!dims) return measures > 0 ? "kpi" : "table";
  if (hasDateBucket) return "line";
  if (measures === 2) return "scatter";
  if (measures <= 1 && rows.length > 0 && rows.length <= 6) return "pie";
  return "bar";
}

/** Keep only the keys a widget query stores (the dataset comes from datasetId). */
export function toWidgetQuery(params: AnalyticsQueryParams | Record<string, unknown>) {
  const p = params as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ["filters", "filtersOp", "dateRange", "metrics", "groupBy", "orderBy"]) {
    const value = p[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && !value.length) continue;
    out[key] = value;
  }
  return out as AnalyticsQueryParams;
}
