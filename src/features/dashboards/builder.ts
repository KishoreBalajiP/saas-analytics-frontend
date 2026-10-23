/**
 * Visual widget builder model (vizbuilder, roadmap 3.5): the builder's form
 * state, its conversion to the widget contract (`query` + `visualization`),
 * client-side checks, and the mapping of server field errors to sections.
 */
import { ApiError } from "@/lib/api/client";
import {
  dateRangeFromDraft,
  draftFromDateRange,
  validateDateRangeDraft,
  type DateRangeDraft,
} from "@/features/analytics/dateRange";
import type {
  AnalyticsQueryParams,
  DateBucket,
  DatasetSchemaField,
  FilterOp,
  MetricOp,
  NumberFormat,
  QueryFilter,
  QueryMetric,
  ResolvedVisualization,
  VisualizationSpec,
  Widget,
  WidgetType,
} from "@/lib/api/types";

export const BUILDER_METRIC_OPS: MetricOp[] = [
  "count",
  "count_non_null",
  "count_distinct",
  "sum",
  "avg",
  "min",
  "max",
];
export const BUILDER_FILTER_OPS: FilterOp[] = [
  "eq",
  "neq",
  "in",
  "nin",
  "gt",
  "gte",
  "lt",
  "lte",
  "exists",
];
export const NUMBER_FORMATS: NumberFormat[] = [
  "number",
  "integer",
  "percent",
  "currency",
  "compact",
];

export interface MetricDraft {
  op: MetricOp;
  field: string;
  alias: string;
  /** A saved, approved metric ('metric:<key>'); op/field are then ignored. */
  ref?: string;
}
export interface GroupDraft {
  field: string;
  bucket: DateBucket | "";
}
export interface FilterDraft {
  field: string;
  op: FilterOp;
  value: string;
}
export interface SpecDraft {
  xField: string;
  numberFormat: NumberFormat;
  currency: string;
  unit: string;
  limit: string;
  showOther: boolean;
  pageSize: string;
}

export interface BuilderState {
  name: string;
  type: WidgetType;
  datasetId: string;
  metrics: MetricDraft[];
  groupBy: GroupDraft[];
  filters: FilterDraft[];
  dateRange: DateRangeDraft;
  spec: SpecDraft;
}

export interface BuilderIssue {
  field: string;
  message: string;
}

const NUMERIC_TYPES = new Set(["number", "integer"]);

export function initialState(widget: Widget | null): BuilderState {
  const q = widget?.query ?? {};
  const v = (widget?.visualization ?? {}) as VisualizationSpec;
  return {
    name: widget?.name ?? "",
    type: widget?.type ?? "bar",
    datasetId: widget?.datasetId ?? "",
    metrics: (q.metrics ?? []).map((m) => ({
      op: m.op,
      field: m.field ?? "",
      alias: m.alias ?? "",
      ...(m.ref ? { ref: m.ref } : {}),
    })),
    groupBy: (q.groupBy ?? []).map((g) =>
      typeof g === "string" ? { field: g, bucket: "" } : { field: g.field, bucket: g.bucket ?? "" },
    ),
    filters: (q.filters ?? []).map((f) => ({
      field: f.field,
      op: f.op,
      value: Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? ""),
    })),
    dateRange: draftFromDateRange(q.dateRange),
    spec: {
      xField: v.xField ?? "",
      numberFormat: v.numberFormat ?? "number",
      currency: v.currency ?? "",
      unit: v.unit ?? "",
      limit: v.limit ? String(v.limit) : "",
      showOther: Boolean(v.showOther),
      pageSize: v.pageSize ? String(v.pageSize) : "",
    },
  };
}

export function metricAlias(m: { op: string; field?: string; alias?: string; ref?: string }) {
  if (m.alias) return m.alias;
  if (m.ref) return m.ref.replace(/^metric:/, "").replace(/@d+$/, "");
  return m.field ? `${m.op}_${m.field}` : m.op;
}

function parseScalar(raw: string, numeric: boolean): unknown {
  const text = raw.trim();
  if (numeric) return Number(text);
  if (text === "true") return true;
  if (text === "false") return false;
  return text;
}

/** Convert the form to the widget contract, with client-side issues (same field paths as the server). */
export function toWidgetBody(state: BuilderState, fields: DatasetSchemaField[] = []) {
  const issues: BuilderIssue[] = [];
  const typeOf = new Map(fields.map((f) => [f.name, f.type]));
  if (!state.name.trim()) issues.push({ field: "name", message: "Name is required." });
  if (!state.datasetId) issues.push({ field: "datasetId", message: "Choose a dataset." });

  const metrics = state.metrics.map((m, i) => {
    if (m.ref) return { ref: m.ref, ...(m.alias ? { alias: m.alias } : {}) } as QueryMetric;
    if (m.op !== "count" && !m.field)
      issues.push({ field: `query.metrics[${i}].field`, message: `${m.op} needs a field.` });
    return {
      op: m.op,
      ...(m.field ? { field: m.field } : {}),
      ...(m.alias ? { alias: m.alias } : {}),
    } as QueryMetric; // a bare count carries no field
  });
  const groupBy = state.groupBy.map((g, i) => {
    if (!g.field) issues.push({ field: `query.groupBy[${i}].field`, message: "Choose a field." });
    return g.bucket ? { field: g.field, bucket: g.bucket } : { field: g.field };
  });
  const filters: QueryFilter[] = state.filters.map((f, i) => {
    const at = `query.filters[${i}]`;
    if (!f.field) issues.push({ field: `${at}.field`, message: "Choose a field." });
    const numeric = NUMERIC_TYPES.has(typeOf.get(f.field) ?? "");
    let value: unknown;
    if (f.op === "exists") {
      if (f.value !== "true" && f.value !== "false")
        issues.push({ field: `${at}.value`, message: "Use true or false." });
      value = f.value === "true";
    } else if (f.op === "in" || f.op === "nin") {
      const parts = f.value
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (!parts.length)
        issues.push({
          field: `${at}.value`,
          message: "Enter one or more values, comma separated.",
        });
      value = parts.map((p) => parseScalar(p, numeric));
    } else {
      if (!f.value.trim()) issues.push({ field: `${at}.value`, message: "Enter a value." });
      value = parseScalar(f.value, numeric);
    }
    const bad = (v: unknown) => typeof v === "number" && !Number.isFinite(v);
    if ((Array.isArray(value) && value.some(bad)) || bad(value))
      issues.push({ field: `${at}.value`, message: "Must be a number for this field." });
    return { field: f.field, op: f.op, value };
  });
  for (const issue of validateDateRangeDraft(state.dateRange, "query.dateRange"))
    issues.push({ field: issue.field, message: issue.message });
  const dateRange = dateRangeFromDraft(state.dateRange);

  const query: AnalyticsQueryParams = {
    ...(metrics.length ? { metrics } : {}),
    ...(groupBy.length ? { groupBy } : {}),
    ...(filters.length ? { filters } : {}),
    ...(dateRange ? { dateRange } : {}),
  };

  // Client mirror of the server's type rules (the server stays authoritative).
  if (state.type === "kpi" && !metrics.length)
    issues.push({ field: "query.metrics", message: "A KPI needs at least one aggregate metric." });
  if (state.type === "kpi" && groupBy.length)
    issues.push({ field: "query.groupBy", message: "A KPI shows one value: remove group-by." });
  if (["bar", "line", "area", "pie", "doughnut", "scatter"].includes(state.type) && !groupBy.length)
    issues.push({
      field: "query.groupBy",
      message: `A ${state.type} chart needs a group-by field.`,
    });
  if (state.type === "scatter" && metrics.length < 2)
    issues.push({
      field: "query.metrics",
      message: "A scatter chart needs two metrics (x and y).",
    });

  const s = state.spec;
  const visualization: VisualizationSpec = {};
  if (state.type !== "table" && state.type !== "kpi" && s.xField) visualization.xField = s.xField;
  if (s.numberFormat !== "number") visualization.numberFormat = s.numberFormat;
  if (s.numberFormat === "currency" && s.currency)
    visualization.currency = s.currency.toUpperCase();
  if (s.unit) visualization.unit = s.unit;
  if ((state.type === "bar" || state.type === "pie" || state.type === "doughnut") && s.limit) {
    visualization.limit = Number(s.limit);
    if (s.showOther) visualization.showOther = true;
  }
  if (state.type === "table" && s.pageSize) visualization.pageSize = Number(s.pageSize);

  return {
    issues,
    body: {
      name: state.name.trim(),
      type: state.type,
      datasetId: state.datasetId,
      query,
      visualization,
    },
  };
}

/** Resolve a spec locally for the live preview (mirrors the server's resolveVisualization). */
export function previewVisualization(
  type: WidgetType,
  query: AnalyticsQueryParams,
  spec: VisualizationSpec,
): ResolvedVisualization {
  const groups = (query.groupBy ?? []).map((g) =>
    typeof g === "string" ? { field: g, bucket: undefined } : g,
  );
  const dimensions = groups.map((g) => g.field);
  const measures = (query.metrics ?? []).map(metricAlias);
  const xField =
    spec.xField && dimensions.includes(spec.xField) ? spec.xField : (dimensions[0] ?? null);
  return {
    type,
    xField,
    xBucket: groups.find((g) => g.field === xField)?.bucket ?? null,
    dimensions,
    measures: measures.length ? measures : dimensions.length ? ["count"] : [],
    numberFormat: spec.numberFormat ?? "number",
    currency: spec.currency ?? null,
    unit: spec.unit ?? null,
    sort: spec.sort ?? null,
    limit: spec.limit ?? null,
    showOther: Boolean(spec.showOther),
    nullHandling: spec.nullHandling ?? "skip",
    pageSize: spec.pageSize ?? null,
    columns: spec.columns ?? null,
  };
}

/** Field errors (client issues or a server ApiError) whose path starts with `prefix`. */
export function errorsFor(source: BuilderIssue[] | unknown, prefix: string): string[] {
  const list: BuilderIssue[] = Array.isArray(source)
    ? (source as BuilderIssue[])
    : source instanceof ApiError
      ? (source.errors ?? []).map((e) => ({ field: e.field ?? "", message: e.message }))
      : [];
  return list
    .filter(
      (e) =>
        e.field === prefix ||
        e.field.startsWith(`${prefix}.`) ||
        e.field.startsWith(`${prefix}[`) ||
        e.field.startsWith(`${prefix}-`),
    )
    .map((e) =>
      e.field === prefix
        ? e.message
        : `${e.field.slice(prefix.length).replace(/^\./, "")}: ${e.message}`,
    );
}
