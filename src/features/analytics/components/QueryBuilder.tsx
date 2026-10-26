import { useQueries } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type {
  AnalyticsQueryParams,
  DateBucket,
  FieldError,
  FilterOp,
  MetricOp,
  QueryFilter,
  QueryGroupBy,
  QueryMetric,
  QueryOrder,
} from "@/lib/api/types";
import type { Connector } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { MetricPicker } from "@/features/metrics/components/MetricPicker";
import * as connectorsApi from "@/features/datasets/api";
import { DATASET_STATE_LABELS, datasetState } from "@/features/datasets/sync";
import type { MetricDefinition } from "@/features/metrics/api";
import { validateAnalyticsQuery, type QueryValidationError } from "@/features/analytics/validation";
import { DateRangeFields } from "@/features/analytics/components/DateRangeFields";
import {
  DATE_BUCKET_OPTIONS,
  dateRangeFromDraft,
  draftFromDateRange,
  type DateRangeDraft,
} from "@/features/analytics/dateRange";

const METRIC_OPS: MetricOp[] = ["count", "sum", "avg", "min", "max", "count_distinct"];
const FILTER_OPS: FilterOp[] = ["eq", "neq", "in", "nin", "gt", "gte", "lt", "lte", "exists"];

interface QueryBuilderProps {
  connectors: Connector[];
  onRun: (params: AnalyticsQueryParams) => void;
  loading?: boolean;
  initialParams?: AnalyticsQueryParams | undefined;
  /** Field errors from a 400 INVALID_QUERY response for the last run. */
  serverErrors?: FieldError[] | undefined;
  /** Workspace time zone (from the last result), shown next to date presets. */
  timezone?: string | undefined;
  /** ai-catalogue: catalogue metrics offered by the metric picker. */
  catalogueMetrics?: MetricDefinition[] | undefined;
}

type GroupRow = { field: string; bucket: DateBucket | "" };

function toGroupRows(groupBy: AnalyticsQueryParams["groupBy"]): GroupRow[] {
  return (groupBy ?? []).map((group) =>
    typeof group === "string"
      ? { field: group, bucket: "" }
      : { field: group.field, bucket: group.bucket ?? "" },
  );
}

function toOrderRows(orderBy: AnalyticsQueryParams["orderBy"]): QueryOrder[] {
  // History records saved before the contract alignment may carry `dir`.
  return (orderBy ?? []).map((order) => ({
    field: order.field,
    direction: order.direction ?? order.dir ?? "asc",
  }));
}

/** Text inputs hold strings; send the value type each operator expects. */
function filterValue(filter: QueryFilter): unknown {
  const raw = filter.value;
  if (typeof raw !== "string") return raw;
  if (filter.op === "in" || filter.op === "nin") {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (filter.op === "exists") return raw.trim() !== "false";
  return raw;
}

export function QueryBuilder({
  connectors,
  onRun,
  loading,
  initialParams,
  serverErrors,
  timezone,
  catalogueMetrics,
}: QueryBuilderProps) {
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>(
    initialParams?.connectorIds ?? [],
  );
  const [metrics, setMetrics] = useState<QueryMetric[]>(
    (initialParams?.metrics ?? []).filter((m) => !m.ref),
  );
  // ai-catalogue: metric references picked from the catalogue.
  const [metricRefs, setMetricRefs] = useState<string[]>(
    (initialParams?.metrics ?? []).flatMap((m) => (m.ref ? [m.ref] : [])),
  );
  const [groupByFields, setGroupByFields] = useState<GroupRow[]>(
    toGroupRows(initialParams?.groupBy),
  );
  const [filters, setFilters] = useState<QueryFilter[]>(
    (initialParams?.filters ?? []).map((f) => ({
      ...f,
      value: Array.isArray(f.value) ? f.value.join(", ") : f.value,
    })),
  );
  const [filtersOp, setFiltersOp] = useState<"and" | "or">(initialParams?.filtersOp ?? "and");
  const [dateRange, setDateRange] = useState<DateRangeDraft>(
    draftFromDateRange(initialParams?.dateRange),
  );
  const [orderBy, setOrderBy] = useState<QueryOrder[]>(toOrderRows(initialParams?.orderBy));
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 50);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<QueryValidationError[]>([]);

  // Field names of the selected datasets (from their profiled schemas) are
  // offered as suggestions; any field can still be typed.
  const fieldListId = `analytics-fields-${useId()}`;
  const schemaQueries = useQueries({
    queries: selectedConnectorIds.map((id) => ({
      queryKey: ["connector", id, "schema"],
      queryFn: () => connectorsApi.getSchema(id),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const schemaFields = new Map<string, string>();
  for (const q of schemaQueries)
    for (const f of q.data?.fields ?? []) schemaFields.set(f.name, f.type);
  const fieldNames = [...schemaFields.keys()].sort();
  const dateFieldNames = fieldNames.filter((name) =>
    ["date", "datetime"].includes(schemaFields.get(name) ?? ""),
  );

  function toggleConnector(id: string) {
    setSelectedConnectorIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  function addMetric() {
    setMetrics((prev) => [...prev, { field: "", op: "count", alias: "" }]);
  }

  function updateMetric(index: number, patch: Partial<QueryMetric>) {
    setMetrics((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function removeMetric(index: number) {
    setMetrics((prev) => prev.filter((_, i) => i !== index));
  }

  function addGroupBy() {
    setGroupByFields((prev) => [...prev, { field: "", bucket: "" }]);
  }

  function updateGroupBy(index: number, patch: Partial<GroupRow>) {
    setGroupByFields((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  function removeGroupBy(index: number) {
    setGroupByFields((prev) => prev.filter((_, i) => i !== index));
  }

  function addFilter() {
    setFilters((prev) => [...prev, { field: "", op: "eq", value: "" }]);
  }

  function updateFilter(index: number, patch: Partial<QueryFilter>) {
    setFilters((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  }

  function addOrderBy() {
    setOrderBy((prev) => [...prev, { field: "", direction: "asc" }]);
  }

  function updateOrderBy(index: number, patch: Partial<QueryOrder>) {
    setOrderBy((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function removeOrderBy(index: number) {
    setOrderBy((prev) => prev.filter((_, i) => i !== index));
  }

  function buildParams(): AnalyticsQueryParams {
    const params: AnalyticsQueryParams = {};
    if (selectedConnectorIds.length) params.connectorIds = selectedConnectorIds;
    if (metrics.length || metricRefs.length) {
      // A count needs no field; every other metric does.
      params.metrics = metrics
        .filter((m) => m.field.trim() || m.op === "count")
        .map((m) => {
          const field = m.field.trim();
          const alias = m.alias?.trim();
          // The API takes a bare count without a field.
          return {
            op: m.op,
            ...(field ? { field } : {}),
            ...(alias ? { alias } : {}),
          } as QueryMetric;
        })
        .concat(metricRefs.map((ref) => ({ ref }) as QueryMetric));
    }
    if (groupByFields.length) {
      params.groupBy = groupByFields
        .filter((g) => g.field.trim())
        .map((g): string | QueryGroupBy =>
          g.bucket ? { field: g.field.trim(), bucket: g.bucket } : g.field.trim(),
        );
    }
    if (filters.length) {
      params.filters = filters
        .filter((f) => f.field.trim())
        .map((f) => ({ field: f.field.trim(), op: f.op, value: filterValue(f) }));
      params.filtersOp = filtersOp;
    }
    const range = dateRangeFromDraft(dateRange);
    if (range) params.dateRange = range;
    if (orderBy.length) {
      params.orderBy = orderBy
        .filter((o) => o.field.trim())
        .map((o) => ({ field: o.field.trim(), direction: o.direction }));
    }
    params.page = page;
    params.limit = limit;
    return params;
  }

  function handleRun() {
    const params = buildParams();
    const errors = validateAnalyticsQuery(params);
    setValidationErrors(errors);
    if (!errors.length) onRun(params);
  }

  return (
    <div className="space-y-6">
      <datalist id={fieldListId}>
        {fieldNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {/* Connector selection */}
      <fieldset className="space-y-2">
        <Label className="text-sm font-medium">Dataset / Connectors</Label>
        {connectors.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No datasets yet. Upload a file or connect a source in Datasets first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {connectors.map((c) => {
              const selected = selectedConnectorIds.includes(c._id);
              const state = datasetState(c);
              // The API refuses datasets whose first import is running or failed.
              const blocked = (state === "processing" || state === "failed") && !selected;
              return (
                <button
                  key={c._id}
                  type="button"
                  disabled={blocked}
                  aria-pressed={selected}
                  title={state === "ready" ? undefined : DATASET_STATE_LABELS[state]}
                  onClick={() => toggleConnector(c._id)}
                  className={cn(
                    "rounded-md border border-border px-3 py-1.5 text-xs transition-colors",
                    selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent/50",
                    blocked && "cursor-not-allowed opacity-50 hover:bg-transparent",
                  )}
                >
                  {c.name}{" "}
                  <span className="ml-1 text-muted-foreground">({c.type.toUpperCase()})</span>
                  {state !== "ready" ? (
                    <span className="ml-1 text-muted-foreground">
                      · {DATASET_STATE_LABELS[state]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <Separator />

      {/* Metrics */}
      <fieldset className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Metrics</Label>
          <Button variant="ghost" size="sm" onClick={addMetric}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {catalogueMetrics && (
          <MetricPicker
            metrics={catalogueMetrics}
            onPick={(ref) => setMetricRefs((prev) => (prev.includes(ref) ? prev : [...prev, ref]))}
          />
        )}
        {metricRefs.map((ref) => (
          <div key={ref} className="flex items-center gap-2 text-xs">
            <span className="font-mono">{ref}</span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${ref}`}
              onClick={() => setMetricRefs((prev) => prev.filter((r) => r !== ref))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {metrics.length === 0 && metricRefs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No metrics defined. Add one to aggregate data.
          </p>
        )}
        {metrics.map((metric, index) => (
          <div key={`metric-${index}`} className="flex items-center gap-2">
            <Input
              placeholder="field name"
              value={metric.field}
              onChange={(e) => updateMetric(index, { field: e.target.value })}
              className="flex-1"
              aria-label="Metric field"
              list={fieldListId}
            />
            <Select
              value={metric.op}
              onValueChange={(v) => updateMetric(index, { op: v as MetricOp })}
            >
              <SelectTrigger className="w-28" aria-label="Metric operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_OPS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="alias"
              value={metric.alias ?? ""}
              onChange={(e) => updateMetric(index, { alias: e.target.value })}
              className="w-28"
              aria-label="Metric alias"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeMetric(index)}
              aria-label="Remove metric"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </fieldset>

      <Separator />

      {/* Group By */}
      <fieldset className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Group By</Label>
          <Button variant="ghost" size="sm" onClick={addGroupBy}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {groupByFields.map((group, index) => (
          <div key={`group-${index}`} className="flex items-center gap-2">
            <Input
              placeholder="field name"
              value={group.field}
              onChange={(e) => updateGroupBy(index, { field: e.target.value })}
              className="flex-1"
              aria-label="Group by field"
              list={fieldListId}
            />
            <select
              className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Group by date bucket"
              value={group.bucket}
              onChange={(e) => updateGroupBy(index, { bucket: e.target.value as DateBucket | "" })}
            >
              <option value="">Exact value</option>
              {DATE_BUCKET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  By {option.label.toLowerCase()}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeGroupBy(index)}
              aria-label="Remove group by"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </fieldset>

      <Separator />

      {/* Filters */}
      <fieldset className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Filters</Label>
          <div className="flex items-center gap-3">
            {filters.length > 1 && (
              <Select value={filtersOp} onValueChange={(v) => setFiltersOp(v as "and" | "or")}>
                <SelectTrigger className="w-20" aria-label="Filter operator">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">AND</SelectItem>
                  <SelectItem value="or">OR</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="ghost" size="sm" onClick={addFilter}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
        {filters.map((filter, index) => (
          <div key={`filter-${index}`} className="flex items-center gap-2">
            <Input
              placeholder="field"
              value={filter.field}
              onChange={(e) => updateFilter(index, { field: e.target.value })}
              className="flex-1"
              aria-label="Filter field"
              list={fieldListId}
            />
            <Select
              value={filter.op}
              onValueChange={(v) => updateFilter(index, { op: v as FilterOp })}
            >
              <SelectTrigger className="w-24" aria-label="Filter operator">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={
                filter.op === "in" || filter.op === "nin"
                  ? "a, b, c"
                  : filter.op === "exists"
                    ? "true or false"
                    : "value"
              }
              value={typeof filter.value === "string" ? filter.value : JSON.stringify(filter.value)}
              onChange={(e) => updateFilter(index, { value: e.target.value })}
              className="flex-1"
              aria-label="Filter value"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeFilter(index)}
              aria-label="Remove filter"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </fieldset>

      <Separator />

      {/* Date Range */}
      <fieldset className="space-y-2">
        <Label className="text-sm font-medium">Date Range</Label>
        <DateRangeFields
          idPrefix="query"
          value={dateRange}
          onChange={setDateRange}
          timezone={timezone}
          fieldSuggestions={dateFieldNames}
        />
      </fieldset>

      <Separator />

      {/* Advanced */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {advancedOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced options
        </button>
        {advancedOpen && (
          <div className="mt-4 space-y-6 pl-2">
            {/* Order By */}
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Sort by</Label>
                <Button variant="ghost" size="sm" onClick={addOrderBy}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              {orderBy.map((order, index) => (
                <div key={`sort-${index}`} className="flex items-center gap-2">
                  <Input
                    placeholder="field"
                    value={order.field}
                    onChange={(e) => updateOrderBy(index, { field: e.target.value })}
                    className="flex-1"
                    aria-label="Sort field"
                    list={fieldListId}
                  />
                  <Select
                    value={order.direction}
                    onValueChange={(v) => updateOrderBy(index, { direction: v as "asc" | "desc" })}
                  >
                    <SelectTrigger className="w-24" aria-label="Sort direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOrderBy(index)}
                    aria-label="Remove sort"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </fieldset>

            {/* Pagination */}
            <fieldset className="space-y-2">
              <Label className="text-sm font-medium">Pagination</Label>
              <div className="flex items-center gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Page</Label>
                  <Input
                    type="number"
                    min={1}
                    value={page}
                    onChange={(e) => setPage(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Limit (max 200)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={limit}
                    onChange={(e) =>
                      setLimit(Math.min(200, Math.max(1, Number(e.target.value) || 50)))
                    }
                    className="w-24"
                  />
                </div>
              </div>
            </fieldset>
          </div>
        )}
      </div>

      {validationErrors.length > 0 && (
        <ul className="space-y-1 text-sm text-destructive" role="alert">
          {validationErrors.map((error) => (
            <li key={`${error.field}-${error.message}`}>{error.message}</li>
          ))}
        </ul>
      )}

      {validationErrors.length === 0 && serverErrors?.length ? (
        <div className="space-y-1 text-sm text-destructive" role="alert">
          <p className="font-medium">The server rejected this query:</p>
          <ul className="space-y-1">
            {serverErrors.map((error) => (
              <li key={`${error.field}-${error.message}`}>
                <span className="font-mono text-xs">{error.field}</span>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Run button */}
      <Button
        onClick={handleRun}
        disabled={loading || !selectedConnectorIds.length}
        className="w-full"
      >
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Run Query
      </Button>
    </div>
  );
}
