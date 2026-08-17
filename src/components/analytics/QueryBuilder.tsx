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
  ConnectorType,
  FilterOp,
  MetricOp,
  QueryFilter,
  QueryMetric,
  QueryOrder,
} from "@/lib/api/types";
import type { Connector } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const METRIC_OPS: MetricOp[] = ["count", "sum", "avg", "min", "max"];
const FILTER_OPS: FilterOp[] = ["eq", "neq", "in", "nin", "gt", "gte", "lt", "lte", "exists"];

function uniqueId() {
  return Math.random().toString(36).slice(2, 9);
}

interface QueryBuilderProps {
  connectors: Connector[];
  onRun: (params: AnalyticsQueryParams) => void;
  loading?: boolean;
  initialParams?: AnalyticsQueryParams | undefined;
}

export function QueryBuilder({ connectors, onRun, loading, initialParams }: QueryBuilderProps) {
  const [selectedConnectorIds, setSelectedConnectorIds] = useState<string[]>(
    initialParams?.connectorIds ?? [],
  );
  const [metrics, setMetrics] = useState<QueryMetric[]>(initialParams?.metrics ?? []);
  const [groupByFields, setGroupByFields] = useState<string[]>(initialParams?.groupBy ?? []);
  const [filters, setFilters] = useState<QueryFilter[]>(initialParams?.filters ?? []);
  const [filtersOp, setFiltersOp] = useState<"and" | "or">(initialParams?.filtersOp ?? "and");
  const [dateFrom, setDateFrom] = useState(initialParams?.dateRange?.from?.slice(0, 10) ?? "");
  const [dateTo, setDateTo] = useState(initialParams?.dateRange?.to?.slice(0, 10) ?? "");
  const [orderBy, setOrderBy] = useState<QueryOrder[]>(initialParams?.orderBy ?? []);
  const [page, setPage] = useState(initialParams?.page ?? 1);
  const [limit, setLimit] = useState(initialParams?.limit ?? 50);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
    setGroupByFields((prev) => [...prev, ""]);
  }

  function updateGroupBy(index: number, value: string) {
    setGroupByFields((prev) => prev.map((f, i) => (i === index ? value : f)));
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
    setOrderBy((prev) => [...prev, { field: "", dir: "asc" }]);
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
    if (metrics.length) {
      params.metrics = metrics.filter((m) => m.field.trim());
    }
    if (groupByFields.length) {
      params.groupBy = groupByFields.filter((f) => f.trim());
    }
    if (filters.length) {
      params.filters = filters.filter((f) => f.field.trim());
      params.filtersOp = filtersOp;
    }
    if (dateFrom || dateTo) {
      params.dateRange = {};
      if (dateFrom) params.dateRange.from = new Date(dateFrom).toISOString();
      if (dateTo) params.dateRange.to = new Date(dateTo + "T23:59:59").toISOString();
    }
    if (orderBy.length) {
      params.orderBy = orderBy.filter((o) => o.field.trim());
    }
    params.page = page;
    params.limit = limit;
    return params;
  }

  function handleRun() {
    onRun(buildParams());
  }

  return (
    <div className="space-y-6">
      {/* Connector selection */}
      <fieldset className="space-y-2">
        <Label className="text-sm font-medium">Dataset / Connectors</Label>
        {connectors.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No connectors available. Create one first.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {connectors.map((c) => {
              const selected = selectedConnectorIds.includes(c._id);
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggleConnector(c._id)}
                  className={cn(
                    "rounded-md border border-border px-3 py-1.5 text-xs transition-colors",
                    selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent/50",
                  )}
                >
                  {c.name}{" "}
                  <span className="ml-1 text-muted-foreground">({c.type.toUpperCase()})</span>
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
        {metrics.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No metrics defined. Add one to aggregate data.
          </p>
        )}
        {metrics.map((metric, index) => (
          <div key={uniqueId()} className="flex items-center gap-2">
            <Input
              placeholder="field name"
              value={metric.field}
              onChange={(e) => updateMetric(index, { field: e.target.value })}
              className="flex-1"
              aria-label="Metric field"
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
        {groupByFields.map((field, index) => (
          <div key={uniqueId()} className="flex items-center gap-2">
            <Input
              placeholder="field name"
              value={field}
              onChange={(e) => updateGroupBy(index, e.target.value)}
              className="flex-1"
              aria-label="Group by field"
            />
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
          <div key={uniqueId()} className="flex items-center gap-2">
            <Input
              placeholder="field"
              value={filter.field}
              onChange={(e) => updateFilter(index, { field: e.target.value })}
              className="flex-1"
              aria-label="Filter field"
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
              placeholder="value"
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
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
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
                <div key={uniqueId()} className="flex items-center gap-2">
                  <Input
                    placeholder="field"
                    value={order.field}
                    onChange={(e) => updateOrderBy(index, { field: e.target.value })}
                    className="flex-1"
                    aria-label="Sort field"
                  />
                  <Select
                    value={order.dir}
                    onValueChange={(v) => updateOrderBy(index, { dir: v as "asc" | "desc" })}
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
