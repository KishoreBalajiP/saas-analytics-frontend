import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as metricsApi from "@/features/metrics/api";
import * as connectorsApi from "@/features/datasets/api";
import * as analyticsApi from "@/features/analytics/api";
import { selectableDatasets } from "@/features/datasets/sync";
import type { MetricDefinition, MetricInput } from "@/features/metrics/api";
import {
  FiltersEditor,
  describeFilters,
  draftsFromFilters,
  filtersFromDrafts,
  validateFilterDrafts,
  type FilterDraft,
} from "@/features/metrics/components/FiltersEditor";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const AGGREGATIONS = ["count", "sum", "avg", "min", "max", "count_distinct"] as const;

export function MetricsCatalogue() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.METRICS_VIEW);
  const canManage = hasPermission(permissions, Permissions.METRICS_MANAGE);
  const canApprove = hasPermission(permissions, Permissions.METRICS_APPROVE);
  const [editing, setEditing] = useState<MetricDefinition | "new" | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["metrics", "list"],
    queryFn: () => metricsApi.list({ limit: 100 }),
    enabled: canView,
  });
  const approve = useMutation({
    mutationFn: (m: MetricDefinition) => metricsApi.approve(m.key, m.version),
    onSuccess: () => {
      toast.success("Metric approved");
      void client.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to approve"),
  });
  const archive = useMutation({
    mutationFn: (m: MetricDefinition) => metricsApi.archive(m.key),
    onSuccess: () => {
      toast.success("Metric archived");
      void client.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to archive"),
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Metrics" />;
  if (query.isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Metrics" />;
  const rows = query.data?.data ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A metric is a named calculation (for example "total revenue" = sum of the amount field). New
        metrics and edits start as <strong>drafts</strong>: they can't be used in dashboards,
        reports or alerts until someone approves them. Approved metrics are <strong>active</strong>;
        archived metrics stop being usable but keep their history.
      </p>
      {canManage && <Button onClick={() => setEditing("new")}>New metric</Button>}
      {rows.length === 0 ? (
        <EmptyState
          title="No metrics yet"
          description="Define a named, versioned business metric."
        />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th>Key</th>
              <th>Label</th>
              <th>Definition</th>
              <th>Version</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.key} className="border-t border-border">
                <td className="font-mono text-xs">{m.key}</td>
                <td>{m.label}</td>
                <td className="font-mono text-xs">
                  {m.aggregation === "ratio"
                    ? `${m.numerator?.aggregation}(${m.numerator?.field ?? ""}) / ${m.denominator?.aggregation}(${m.denominator?.field ?? ""})`
                    : `${m.aggregation}(${m.field ?? ""})`}
                </td>
                <td>
                  v{m.version}{" "}
                  <Badge variant={m.status === "approved" ? "default" : "secondary"}>
                    {m.status}
                  </Badge>
                  {m.approvedVersion && m.approvedVersion !== m.version && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (v{m.approvedVersion} in use)
                    </span>
                  )}
                </td>
                <td className="space-x-2 text-right">
                  {canManage && m.status !== "archived" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive "${m.label}"? It will no longer be usable in dashboards, reports or alerts.`,
                          )
                        )
                          archive.mutate(m);
                      }}
                    >
                      Archive
                    </Button>
                  )}
                  {canManage && m.aggregation !== ("ratio" as string) && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                      Edit
                    </Button>
                  )}
                  {canApprove && m.status === "draft" && (
                    <Button size="sm" onClick={() => approve.mutate(m)}>
                      Approve v{m.version}
                    </Button>
                  )}
                  {!canApprove && m.status === "draft" && (
                    <span className="text-xs text-muted-foreground">
                      Waiting for approval by an Owner or Admin
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <MetricForm
          metric={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function MetricForm({
  metric,
  onClose,
}: {
  metric?: MetricDefinition | undefined;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [key, setKey] = useState(metric?.key ?? "");
  const [label, setLabel] = useState(metric?.label ?? "");
  const [connectorId, setConnectorId] = useState(metric?.connectorId ?? "");
  const [aggregation, setAggregation] = useState<string>(
    metric?.aggregation === "ratio" ? "sum" : (metric?.aggregation ?? "sum"),
  );
  const [field, setField] = useState(metric?.field ?? "");
  const [description, setDescription] = useState(metric?.description ?? "");
  const [filterDrafts, setFilterDrafts] = useState<FilterDraft[]>(
    () => draftsFromFilters(metric?.filters) ?? [],
  );
  // Saved filters the guided editor can't show exactly are kept verbatim
  // (read-only) until the user explicitly replaces them.
  const [keptFilters, setKeptFilters] = useState<unknown[] | null>(() =>
    metric?.filters && draftsFromFilters(metric.filters) === null ? metric.filters : null,
  );
  const filterIssues = keptFilters ? [] : validateFilterDrafts(filterDrafts);
  const effectiveFilters = (keptFilters ?? filtersFromDrafts(filterDrafts)) as never[];
  const [previewValue, setPreviewValue] = useState<string | null>(null);
  const connectorsQuery = useQuery({
    queryKey: ["connectors", "list", { limit: 200 }],
    queryFn: () => connectorsApi.list({ limit: 200 }),
  });
  // Ready datasets only (the metric's current dataset stays selectable).
  const connectors = selectableDatasets(
    connectorsQuery.data?.data ?? [],
    connectorId ? [connectorId] : [],
  );
  const schemaQuery = useQuery({
    queryKey: ["connector", connectorId, "schema"],
    queryFn: () => connectorsApi.getSchema(connectorId),
    enabled: !!connectorId,
    retry: false,
  });
  const numericOps = ["sum", "avg", "min", "max"];
  // Suggest numeric fields for sum/avg/min/max, every field otherwise.
  const fieldSuggestions = (schemaQuery.data?.fields ?? [])
    .filter((f) => !numericOps.includes(aggregation) || f.type === "number" || f.type === "integer")
    .map((f) => f.name);
  const fieldListId = `metric-fields-${useId()}`;
  // Preview runs the definition through the validated analytics query API
  // (a draft can't be referenced by key yet, so the inline definition is sent).
  const preview = useMutation({
    mutationFn: () =>
      analyticsApi.runQuery({
        connectorIds: [connectorId],
        metrics: [
          {
            op: aggregation as MetricDefinition["aggregation"],
            field: aggregation === "count" ? "" : field,
            alias: "value",
          } as never,
        ],
        ...(effectiveFilters.length ? { filters: effectiveFilters } : {}),
      }),
    onSuccess: ({ result }) => {
      const v = result.rows?.[0]?.["value"];
      setPreviewValue(v === undefined || v === null ? "No data" : String(v));
    },
    onError: (e) => {
      setPreviewValue(null);
      toast.error(e instanceof Error ? e.message : "Unable to preview metric");
    },
  });
  const save = useMutation({
    mutationFn: () => {
      const body: MetricInput = {
        label,
        description,
        connectorId,
        aggregation: aggregation as MetricDefinition["aggregation"],
        field: aggregation === "count" ? null : field,
        filters: effectiveFilters,
      };
      return metric ? metricsApi.update(metric.key, body) : metricsApi.create({ ...body, key });
    },
    onSuccess: () => {
      toast.success(metric ? "New draft version saved" : "Metric draft created");
      void client.invalidateQueries({ queryKey: ["metrics"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to save metric"),
  });
  return (
    <form
      className="space-y-3 rounded-lg border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {metric && (
        <p className="text-xs text-muted-foreground">
          Saving creates version {metric.version + 1} as a draft; v{metric.version} is kept.
        </p>
      )}
      <div>
        <Label htmlFor="metric-key">Key</Label>
        <Input
          id="metric-key"
          value={key}
          disabled={!!metric}
          onChange={(e) => setKey(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          A short unique id (lowercase letters, numbers and _), e.g. total_revenue. It can't be
          changed later.
        </p>
      </div>
      <div>
        <Label htmlFor="metric-label">Label</Label>
        <Input id="metric-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <p className="text-xs text-muted-foreground">The name people see, e.g. "Total revenue".</p>
      </div>
      <div>
        <Label htmlFor="metric-description">Description</Label>
        <Input
          id="metric-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">What this number means, in plain English.</p>
      </div>
      <div>
        <Label htmlFor="metric-dataset">Dataset</Label>
        <select
          id="metric-dataset"
          className="block rounded border border-border bg-background p-1 text-sm"
          value={connectorId}
          onChange={(e) => setConnectorId(e.target.value)}
        >
          <option value="">Choose a dataset…</option>
          {connectors.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
          {connectorId && !connectors.some((c) => c._id === connectorId) && (
            <option value={connectorId}>{connectorId}</option>
          )}
        </select>
        <p className="text-xs text-muted-foreground">
          The dataset (data source) the metric is calculated from.
        </p>
      </div>
      <div>
        <Label htmlFor="metric-aggregation">Aggregation</Label>
        <select
          id="metric-aggregation"
          className="block rounded border border-border bg-background p-1 text-sm"
          value={aggregation}
          onChange={(e) => setAggregation(e.target.value)}
        >
          {AGGREGATIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          How rows are combined: count rows, or sum / average / min / max / count distinct values of
          a field.
        </p>
      </div>
      {aggregation !== "count" && (
        <div>
          <Label htmlFor="metric-field">Field</Label>
          <Input
            id="metric-field"
            list={fieldListId}
            value={field}
            onChange={(e) => setField(e.target.value)}
          />
          <datalist id={fieldListId}>
            {fieldSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      )}
      {keptFilters ? (
        <div className="space-y-2 rounded border border-border p-2" data-testid="kept-filters">
          <p className="text-sm font-medium">Filters (kept as saved)</p>
          <p className="text-xs text-muted-foreground">
            This metric has filters the guided editor can't show exactly. They will be kept
            unchanged when you save. To replace them with guided filters, use the reset button.
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
            {JSON.stringify(keptFilters, null, 2)}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (
                window.confirm("Remove these saved filters and start again with guided filters?")
              ) {
                setKeptFilters(null);
                setFilterDrafts([]);
              }
            }}
          >
            Reset and use guided filters
          </Button>
        </div>
      ) : (
        <FiltersEditor
          idPrefix="metric-filter"
          value={filterDrafts}
          onChange={setFilterDrafts}
          help="Only rows that match every filter are included in this metric, e.g. status is paid. For “is one of”, separate values with commas (put a value that contains a comma in double quotes). Greater/less-than filters need numbers."
        />
      )}
      {filterIssues.length > 0 && (
        <ul className="text-xs text-destructive">
          {filterIssues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending || filterIssues.length > 0}>
          Save draft
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={
            !connectorId ||
            (aggregation !== "count" && !field) ||
            filterIssues.length > 0 ||
            preview.isPending
          }
          onClick={() => preview.mutate()}
        >
          Preview result
        </Button>
        {previewValue !== null && (
          <span className="self-center text-sm" data-testid="metric-preview">
            Result: <strong>{previewValue}</strong>
            <span className="ml-1 text-xs text-muted-foreground">
              ({keptFilters ? "saved filters applied" : describeFilters(filterDrafts)})
            </span>
          </span>
        )}
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
