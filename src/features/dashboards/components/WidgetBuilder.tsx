import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/states";
import { WidgetView } from "@/components/common/WidgetView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as analyticsApi from "@/features/analytics/api";
import { DateRangeFields } from "@/features/analytics/components/DateRangeFields";
import { DATE_BUCKET_OPTIONS } from "@/features/analytics/dateRange";
import * as dashboardsApi from "@/features/dashboards/api";
import { ALL_WIDGET_TYPES } from "@/features/dashboards/chartRecommendation";
import * as metricsApi from "@/features/metrics/api";
import { MetricPicker } from "@/features/metrics/components/MetricPicker";
import { ApiError } from "@/lib/api/client";
import {
  BUILDER_FILTER_OPS,
  BUILDER_METRIC_OPS,
  NUMBER_FORMATS,
  errorsFor,
  initialState,
  metricAlias,
  previewVisualization,
  toWidgetBody,
  type BuilderIssue,
  type BuilderState,
} from "@/features/dashboards/builder";
import type {
  AnalyticsResult,
  DateBucket,
  FilterOp,
  MetricOp,
  NumberFormat,
  Widget,
  WidgetType,
} from "@/lib/api/types";

const WIDGET_TYPES: WidgetType[] = ALL_WIDGET_TYPES;
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function FieldErrors({ messages }: { messages: string[] }) {
  if (!messages.length) return null;
  return (
    <ul role="alert" className="space-y-0.5 text-xs text-destructive">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

/**
 * Visual widget builder (vizbuilder): dataset, metrics, group-by with date
 * buckets, filters, date range, chart type and spec options, a live preview
 * through the analytics endpoint, and server field errors shown per section.
 */
export function WidgetBuilder({
  dashboardId,
  widget,
  connectors,
  onSaved,
}: {
  dashboardId: string;
  widget: Widget | null;
  connectors: Array<{ _id: string; name: string }>;
  onSaved: () => void;
}) {
  const [state, setState] = useState<BuilderState>(() => initialState(widget));
  const [issues, setIssues] = useState<BuilderIssue[]>([]);
  const [serverError, setServerError] = useState<unknown>(null);
  const [preview, setPreview] = useState<AnalyticsResult | null>(null);

  const schemaQuery = useQuery({
    queryKey: ["dashboards", "dataset-schema", state.datasetId],
    queryFn: () => dashboardsApi.datasetSchema(state.datasetId),
    enabled: !!state.datasetId,
  });
  // Saved metrics: only approved ones on the chosen dataset are offered.
  const metricsQuery = useQuery({
    queryKey: ["metrics", "list", "approved"],
    queryFn: () => metricsApi.list({ status: "approved", limit: 100 }),
    enabled: state.type !== "table",
  });
  const datasetMetrics = (metricsQuery.data?.data ?? []).filter(
    (m) => m.status === "approved" && (!state.datasetId || m.connectorId === state.datasetId),
  );
  const fields = schemaQuery.data?.fields ?? [];
  const fieldNames = fields.map((f) => f.name);
  const dateFields = fields
    .filter((f) => f.type === "date" || f.type === "datetime")
    .map((f) => f.name);

  const update = (patch: Partial<BuilderState>) => setState((s) => ({ ...s, ...patch }));
  const all = [...issues];
  const errs = (prefix: string) => [...errorsFor(all, prefix), ...errorsFor(serverError, prefix)];

  const build = () => {
    const out = toWidgetBody(state, fields);
    setIssues(out.issues);
    return out;
  };

  const previewMutation = useMutation({
    mutationFn: () => {
      const { body } = build();
      return analyticsApi.runQuery({ ...body.query, connectorIds: [body.datasetId], limit: 50 });
    },
    onSuccess: ({ result }) => {
      const { body } = toWidgetBody(state, fields);
      setServerError(null);
      setPreview({
        ...result,
        visualization: previewVisualization(body.type, body.query, body.visualization),
      });
    },
    onError: (error) => {
      setPreview(null);
      setServerError(error);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const { issues: found, body } = build();
      if (found.length) return Promise.reject(new Error("Fix the highlighted fields."));
      // A new widget gets the next free grid slot from the server; an edited
      // one keeps its place (the editor's Layout panel moves and resizes).
      return widget
        ? dashboardsApi.updateWidget(dashboardId, widget._id, {
            ...body,
            ...(widget.position ? { position: widget.position } : {}),
          })
        : dashboardsApi.createWidget(dashboardId, body);
    },
    onSuccess: () => {
      setServerError(null);
      toast.success(widget ? "Widget updated" : "Widget added");
      onSaved();
    },
    onError: (error) => setServerError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: () => dashboardsApi.removeWidget(dashboardId, widget?._id ?? ""),
    onSuccess: () => {
      toast.success("Widget deleted");
      onSaved();
    },
    onError: setServerError,
  });

  const dimensions = state.groupBy.map((g) => g.field).filter(Boolean);
  const listId = `builder-fields-${widget?._id ?? "new"}`;
  const busy = saveMutation.isPending || deleteMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{widget ? "Edit widget" : "Add widget"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <datalist id={listId}>
            {fieldNames.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="builder-name">Name</Label>
              <Input
                id="builder-name"
                value={state.name}
                maxLength={120}
                onChange={(e) => update({ name: e.target.value })}
              />
              <FieldErrors messages={errs("name")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="builder-type">Chart type</Label>
              <select
                id="builder-type"
                className={selectClass}
                value={state.type}
                onChange={(e) => update({ type: e.target.value as WidgetType })}
              >
                {WIDGET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="builder-dataset">Dataset</Label>
            <select
              id="builder-dataset"
              className={selectClass}
              value={state.datasetId}
              onChange={(e) => update({ datasetId: e.target.value })}
            >
              <option value="">Select a dataset</option>
              {connectors.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FieldErrors messages={[...errs("datasetId"), ...errs("query.connectorIds")]} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Metrics</legend>
            {state.metrics.map((m, i) =>
              m.ref ? (
                <div key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    Saved metric <span className="font-mono">{metricAlias(m)}</span>
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove metric ${i + 1}`}
                    onClick={() => update({ metrics: state.metrics.filter((_, j) => j !== i) })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                  <select
                    aria-label={`Metric ${i + 1} aggregation`}
                    className={selectClass}
                    value={m.op}
                    onChange={(e) => {
                      const metrics = [...state.metrics];
                      metrics[i] = { ...m, op: e.target.value as MetricOp };
                      update({ metrics });
                    }}
                  >
                    {BUILDER_METRIC_OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Metric ${i + 1} field`}
                    list={listId}
                    placeholder={m.op === "count" ? "(rows)" : "field"}
                    value={m.field}
                    onChange={(e) => {
                      const metrics = [...state.metrics];
                      metrics[i] = { ...m, field: e.target.value };
                      update({ metrics });
                    }}
                  />
                  <Input
                    aria-label={`Metric ${i + 1} name`}
                    placeholder={metricAlias({ op: m.op, field: m.field })}
                    value={m.alias}
                    onChange={(e) => {
                      const metrics = [...state.metrics];
                      metrics[i] = { ...m, alias: e.target.value };
                      update({ metrics });
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove metric ${i + 1}`}
                    onClick={() => update({ metrics: state.metrics.filter((_, j) => j !== i) })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ),
            )}
            <FieldErrors messages={errs("query.metrics")} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                update({ metrics: [...state.metrics, { op: "count", field: "", alias: "" }] })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add metric
            </Button>
            {state.type !== "table" && (
              <MetricPicker
                metrics={datasetMetrics}
                onPick={(ref) =>
                  update({
                    metrics: [...state.metrics, { op: "count", field: "", alias: "", ref }],
                  })
                }
              />
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Group by</legend>
            {state.groupBy.map((g, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  aria-label={`Group ${i + 1} field`}
                  list={listId}
                  value={g.field}
                  onChange={(e) => {
                    const groupBy = [...state.groupBy];
                    groupBy[i] = { ...g, field: e.target.value };
                    update({ groupBy });
                  }}
                />
                <select
                  aria-label={`Group ${i + 1} date bucket`}
                  className={selectClass}
                  value={g.bucket}
                  onChange={(e) => {
                    const groupBy = [...state.groupBy];
                    groupBy[i] = { ...g, bucket: e.target.value as DateBucket | "" };
                    update({ groupBy });
                  }}
                >
                  <option value="">No date bucket</option>
                  {DATE_BUCKET_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove group ${i + 1}`}
                  onClick={() => update({ groupBy: state.groupBy.filter((_, j) => j !== i) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <FieldErrors messages={errs("query.groupBy")} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => update({ groupBy: [...state.groupBy, { field: "", bucket: "" }] })}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add group
            </Button>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Filters</legend>
            {state.filters.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-2">
                <Input
                  aria-label={`Filter ${i + 1} field`}
                  list={listId}
                  value={f.field}
                  onChange={(e) => {
                    const filters = [...state.filters];
                    filters[i] = { ...f, field: e.target.value };
                    update({ filters });
                  }}
                />
                <select
                  aria-label={`Filter ${i + 1} operator`}
                  className={selectClass}
                  value={f.op}
                  onChange={(e) => {
                    const filters = [...state.filters];
                    filters[i] = { ...f, op: e.target.value as FilterOp };
                    update({ filters });
                  }}
                >
                  {BUILDER_FILTER_OPS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <Input
                  aria-label={`Filter ${i + 1} value`}
                  placeholder={
                    f.op === "in" || f.op === "nin"
                      ? "a, b, c"
                      : f.op === "exists"
                        ? "true"
                        : "value"
                  }
                  value={f.value}
                  onChange={(e) => {
                    const filters = [...state.filters];
                    filters[i] = { ...f, value: e.target.value };
                    update({ filters });
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove filter ${i + 1}`}
                  onClick={() => update({ filters: state.filters.filter((_, j) => j !== i) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <FieldErrors messages={errs("query.filters")} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                update({ filters: [...state.filters, { field: "", op: "eq", value: "" }] })
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add filter
            </Button>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Date range</legend>
            <DateRangeFields
              idPrefix="builder"
              value={state.dateRange}
              onChange={(dateRange) => update({ dateRange })}
              fieldSuggestions={dateFields}
            />
            <FieldErrors messages={errs("query.dateRange")} />
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-1 text-sm font-medium">Display</legend>
            {["bar", "line", "area", "pie", "doughnut", "scatter"].includes(state.type) ? (
              <div className="space-y-1">
                <Label htmlFor="builder-x">Category / time axis</Label>
                <select
                  id="builder-x"
                  className={selectClass}
                  value={state.spec.xField}
                  onChange={(e) => update({ spec: { ...state.spec, xField: e.target.value } })}
                >
                  <option value="">First group-by field</option>
                  {dimensions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="builder-format">Number format</Label>
              <select
                id="builder-format"
                className={selectClass}
                value={state.spec.numberFormat}
                onChange={(e) =>
                  update({ spec: { ...state.spec, numberFormat: e.target.value as NumberFormat } })
                }
              >
                {NUMBER_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            {state.spec.numberFormat === "currency" ? (
              <div className="space-y-1">
                <Label htmlFor="builder-currency">Currency</Label>
                <Input
                  id="builder-currency"
                  maxLength={3}
                  placeholder="USD"
                  value={state.spec.currency}
                  onChange={(e) => update({ spec: { ...state.spec, currency: e.target.value } })}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="builder-unit">Unit</Label>
                <Input
                  id="builder-unit"
                  maxLength={16}
                  value={state.spec.unit}
                  onChange={(e) => update({ spec: { ...state.spec, unit: e.target.value } })}
                />
              </div>
            )}
            {state.type === "bar" || state.type === "pie" || state.type === "doughnut" ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="builder-limit">Top N categories</Label>
                  <Input
                    id="builder-limit"
                    type="number"
                    min={1}
                    max={50}
                    value={state.spec.limit}
                    onChange={(e) => update({ spec: { ...state.spec, limit: e.target.value } })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={state.spec.showOther}
                    onChange={(e) =>
                      update({ spec: { ...state.spec, showOther: e.target.checked } })
                    }
                  />
                  Group the rest as “Other”
                </label>
              </>
            ) : null}
            {state.type === "table" ? (
              <div className="space-y-1">
                <Label htmlFor="builder-page-size">Rows per page</Label>
                <Input
                  id="builder-page-size"
                  type="number"
                  min={1}
                  max={200}
                  value={state.spec.pageSize}
                  onChange={(e) => update({ spec: { ...state.spec, pageSize: e.target.value } })}
                />
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <FieldErrors messages={errs("visualization")} />
            </div>
          </fieldset>

          {serverError && !(serverError instanceof ApiError && serverError.errors?.length) ? (
            <ErrorState error={serverError} />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={!state.datasetId || previewMutation.isPending}
            >
              <Eye className="mr-1 h-4 w-4" />
              {previewMutation.isPending ? "Running…" : "Preview"}
            </Button>
            <Button type="submit" disabled={busy}>
              {saveMutation.isPending ? "Saving…" : widget ? "Save widget" : "Add widget"}
            </Button>
            {widget ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={busy}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Delete
              </Button>
            ) : null}
          </div>
          {preview ? (
            <div aria-label="Widget preview" className="rounded-md border p-3">
              <WidgetView type={state.type} result={preview} height={200} />
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
