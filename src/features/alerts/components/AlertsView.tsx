import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import * as alertsApi from "@/features/alerts/api";
import type { AlertEvent, AlertRule, PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

const CONDITIONS = ["gt", "gte", "lt", "lte", "eq", "neq", "between"] as const;
function date(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function AlertsView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.ALERTS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.ALERTS_CREATE);
  const canDelete = hasPermission(permissions, Permissions.ALERTS_DELETE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ["alerts", "list", page],
    queryFn: () => alertsApi.list({ page, limit: 20 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Alerts" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Alerts" />;
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  return (
    <div className="space-y-4">
      {canCreate && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create alert
        </Button>
      )}
      {rows.length ? (
        <AlertTable
          rows={rows}
          {...(meta ? { meta } : {})}
          setPage={setPage}
          canDelete={canDelete}
        />
      ) : (
        <EmptyState
          title="No alerts yet"
          description="Create a threshold rule over a tenant dataset."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>Create alert</Button>
            ) : undefined
          }
        />
      )}
      {createOpen && <AlertForm onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function AlertTable({
  rows,
  meta,
  setPage,
  canDelete,
}: {
  rows: AlertRule[];
  meta?: PaginationMeta;
  setPage: (page: number) => void;
  canDelete: boolean;
}) {
  const client = useQueryClient();
  const [editing, setEditing] = useState<AlertRule | undefined>();
  const remove = useMutation({
    mutationFn: (id: string) => alertsApi.remove(id),
    onSuccess: () => {
      toast.success("Alert deleted");
      void client.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete alert"),
  });
  const evaluate = useMutation({
    mutationFn: (id: string) => alertsApi.evaluate(id),
    onSuccess: (result) =>
      toast.success(result.triggered ? "Alert triggered" : "Alert did not trigger"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to evaluate alert"),
  });
  const update = useMutation({
    mutationFn: (rule: AlertRule) => alertsApi.update(rule._id, { enabled: !rule.enabled }),
    onSuccess: () => {
      toast.success("Alert status updated");
      void client.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
  const columns: Column<AlertRule>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <button className="font-medium hover:underline" onClick={() => setEditing(r)}>
          {r.name}
        </button>
      ),
    },
    {
      key: "condition",
      header: "Condition",
      render: (r) => (
        <span className="font-mono text-xs">
          {r.metric} {r.condition} {r.threshold}
          {r.condition === "between" ? `–${r.thresholdHigh ?? ""}` : ""}
        </span>
      ),
    },
    {
      key: "enabled",
      header: "Status",
      render: (r) => (
        <Badge variant={r.enabled ? "default" : "secondary"}>
          {r.enabled ? "Enabled" : "Disabled"}
        </Badge>
      ),
    },
    {
      key: "nextEvaluationAt",
      header: "Next evaluation",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {date(r.nextEvaluationAt ?? undefined)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => evaluate.mutate(r._id)}
            disabled={evaluate.isPending}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update.mutate(r)}
            disabled={update.isPending}
          >
            {r.enabled ? "Disable" : "Enable"}
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" aria-label={`Delete ${r.name}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete alert?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the alert rule and event history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => remove.mutate(r._id)}
                    disabled={remove.isPending}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ),
    },
  ];
  const tableRows = rows as Array<AlertRule & Record<string, unknown>>;
  return (
    <>
      {
        <DataTable
          columns={columns as Column<AlertRule & Record<string, unknown>>[]}
          data={tableRows}
          {...(meta ? { meta } : {})}
          onPageChange={setPage}
          getRowId={(r) => String(r["_id"])}
        />
      }
      {editing && <AlertDetail alertId={editing._id} edit onClose={() => setEditing(undefined)} />}
    </>
  );
}

export function AlertDetail({
  alertId,
  edit = false,
  onClose,
}: {
  alertId: string;
  edit?: boolean;
  onClose?: () => void;
}) {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.ALERTS_VIEW);
  const query = useQuery({
    queryKey: ["alerts", alertId],
    queryFn: () => alertsApi.get(alertId),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Alert" />;
  if (query.isLoading) return <TableSkeleton rows={3} cols={2} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Alert" />;
  if (!query.data) return null;
  return edit ? (
    <AlertForm alert={query.data} onClose={onClose ?? (() => void query.refetch())} />
  ) : (
    <AlertSummary alert={query.data} />
  );
}
function AlertSummary({ alert }: { alert: AlertRule }) {
  const events = useQuery({
    queryKey: ["alerts", alert._id, "events"],
    queryFn: () => alertsApi.listEvents(alert._id, { page: 1, limit: 20 }),
  });
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{alert.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {alert.metric} {alert.condition} {alert.threshold}
          </p>
          <p>Status: {alert.enabled ? "Enabled" : "Disabled"}</p>
          <p>
            Schedule: {alert.schedule?.cron ?? "—"} ({alert.schedule?.timezone ?? "UTC"})
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event history</CardTitle>
        </CardHeader>
        <CardContent>
          {events.isError ? (
            <ErrorState error={events.error} resource="Alert events" />
          ) : events.isLoading ? (
            <TableSkeleton rows={3} cols={3} />
          ) : events.data?.data.length ? (
            <div className="space-y-2">
              {events.data.data.map((event: AlertEvent) => (
                <div key={event._id} className="flex justify-between border-b py-2 text-sm">
                  <span className="capitalize">{event.status}</span>
                  <span className="text-muted-foreground">{date(event.triggeredAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertForm({ alert, onClose }: { alert?: AlertRule; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(alert?.name ?? "");
  const [source, setSource] = useState<"widget" | "query">(alert?.source ?? "query");
  const [datasetId, setDatasetId] = useState(alert?.datasetId ?? "");
  const [dashboardId, setDashboardId] = useState(alert?.dashboardId ?? "");
  const [widgetId, setWidgetId] = useState(alert?.widgetId ?? "");
  const [queryJson, setQueryJson] = useState(
    alert?.query ? JSON.stringify(alert.query, null, 2) : "{}",
  );
  const [metric, setMetric] = useState(alert?.metric ?? "count");
  const [condition, setCondition] = useState<AlertRule["condition"]>(alert?.condition ?? "gt");
  const [threshold, setThreshold] = useState(String(alert?.threshold ?? 0));
  const [thresholdHigh, setThresholdHigh] = useState(String(alert?.thresholdHigh ?? ""));
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const low = Number(threshold);
      if (!name.trim() || !metric.trim() || !Number.isFinite(low))
        throw new Error("Name, metric, and numeric threshold are required.");
      if (condition === "between" && !Number.isFinite(Number(thresholdHigh)))
        throw new Error("Between conditions require a high threshold.");
      let query: unknown;
      if (source === "query") {
        try {
          query = JSON.parse(queryJson);
        } catch {
          throw new Error("Query must be valid JSON.");
        }
        if (!query || typeof query !== "object" || Array.isArray(query) || !("datasetId" in query))
          throw new Error("Query JSON must include datasetId.");
      } else if (!dashboardId || !widgetId) {
        throw new Error("Dashboard and widget IDs are required for widget alerts.");
      }
      const body = {
        name: name.trim(),
        metric: metric.trim(),
        condition,
        threshold: low,
        ...(condition === "between" ? { thresholdHigh: Number(thresholdHigh) } : {}),
        source,
        ...(source === "query"
          ? { query: query as import("@/lib/api/types").AnalyticsQueryParams }
          : { dashboardId, widgetId }),
        enabled: alert?.enabled ?? true,
      };
      return alert ? alertsApi.update(alert._id, body) : alertsApi.create(body);
    },
    onSuccess: () => {
      toast.success(alert ? "Alert updated" : "Alert created");
      setError("");
      onClose();
      void client.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to save alert"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{alert ? "Edit alert" : "Create alert"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Label>
            Name
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Label>
          <Label>
            Source
            <Select value={source} onValueChange={(v) => setSource(v as "widget" | "query")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="query">Analytics query</SelectItem>
                <SelectItem value="widget">Dashboard widget</SelectItem>
              </SelectContent>
            </Select>
          </Label>
          <Label>
            Dataset ID
            <Input
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              disabled={source === "widget"}
            />
          </Label>
          {source === "widget" ? (
            <>
              <Label>
                Dashboard ID
                <Input value={dashboardId} onChange={(e) => setDashboardId(e.target.value)} />
              </Label>
              <Label>
                Widget ID
                <Input value={widgetId} onChange={(e) => setWidgetId(e.target.value)} />
              </Label>
            </>
          ) : (
            <Label>
              Query JSON
              <Textarea
                value={queryJson}
                onChange={(e) => setQueryJson(e.target.value)}
                className="min-h-28 font-mono text-xs"
              />
            </Label>
          )}
          <Label>
            Metric
            <Input value={metric} onChange={(e) => setMetric(e.target.value)} />
          </Label>
          <Label>
            Condition
            <Select
              value={condition}
              onValueChange={(v) => setCondition(v as AlertRule["condition"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Label>
          <Label>
            Threshold
            <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Label>
          {condition === "between" && (
            <Label>
              High threshold
              <Input
                type="number"
                value={thresholdHigh}
                onChange={(e) => setThresholdHigh(e.target.value)}
              />
            </Label>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save alert"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
