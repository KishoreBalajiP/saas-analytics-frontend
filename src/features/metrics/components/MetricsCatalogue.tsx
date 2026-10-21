import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as metricsApi from "@/features/metrics/api";
import type { MetricDefinition, MetricInput } from "@/features/metrics/api";
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
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Metrics" />;
  if (query.isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Metrics" />;
  const rows = query.data?.data ?? [];
  return (
    <div className="space-y-4">
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
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={() => setEditing(m)}>
                      Edit
                    </Button>
                  )}
                  {canApprove && m.status === "draft" && (
                    <Button size="sm" onClick={() => approve.mutate(m)}>
                      Approve v{m.version}
                    </Button>
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
  const save = useMutation({
    mutationFn: () => {
      const body: MetricInput = {
        label,
        connectorId,
        aggregation: aggregation as MetricDefinition["aggregation"],
        field: aggregation === "count" ? null : field,
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
      </div>
      <div>
        <Label htmlFor="metric-label">Label</Label>
        <Input id="metric-label" value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="metric-dataset">Dataset ID</Label>
        <Input
          id="metric-dataset"
          value={connectorId}
          onChange={(e) => setConnectorId(e.target.value)}
        />
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
      </div>
      {aggregation !== "count" && (
        <div>
          <Label htmlFor="metric-field">Field</Label>
          <Input id="metric-field" value={field} onChange={(e) => setField(e.target.value)} />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          Save draft
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
