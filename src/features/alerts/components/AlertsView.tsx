import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import {
  EmptyState,
  ErrorState,
  InlineFieldErrors,
  TableSkeleton,
} from "@/components/common/states";
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
import {
  BrokenBadge,
  BrokenDependencyState,
} from "@/features/datasets/components/BrokenDependency";
import { isBroken } from "@/features/datasets/lib/brokenDependency";
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
import type { AlertEvaluationResult, AlertInput } from "@/features/alerts/api";
import {
  GROUP_EVALUATION_LABELS,
  isGrouped,
  parseQueryJson,
  queryOutputs,
} from "@/features/alerts/lib/metrics";
import type {
  AlertEvaluation,
  AlertEvaluationOutcome,
  AlertEvent,
  AlertGroupEvaluation,
  AlertRule,
  AnalyticsQueryParams,
  PaginationMeta,
} from "@/lib/api/types";
import { errorMessage, isQuotaExceeded } from "@/lib/api/quota";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

const CONDITIONS = ["gt", "gte", "lt", "lte", "eq", "neq", "between"] as const;
function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function evaluationToast(result: AlertEvaluationResult) {
  if (result.disabled) return "Alert is disabled";
  if (result.triggered) return `Alert triggered (value ${result.value ?? "—"})`;
  if (result.suppressed) return "Condition met, notification suppressed (cooldown)";
  if (result.noData) return "No data to evaluate";
  return `Condition not met (value ${result.value ?? "—"})`;
}

export function AlertsView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.ALERTS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.ALERTS_CREATE);
  const canDelete = hasPermission(permissions, Permissions.ALERTS_DELETE);
  const canEvaluate = hasPermission(permissions, Permissions.ALERTS_EVALUATE);
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
          canEvaluate={canEvaluate}
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
  canEvaluate,
}: {
  rows: AlertRule[];
  meta?: PaginationMeta;
  setPage: (page: number) => void;
  canDelete: boolean;
  canEvaluate: boolean;
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
    onSuccess: (result) => {
      toast.success(evaluationToast(result));
      void client.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to evaluate alert"),
  });
  const update = useMutation({
    mutationFn: (rule: AlertRule) => alertsApi.update(rule._id, { enabled: !rule.enabled }),
    onSuccess: () => {
      toast.success("Alert status updated");
      void client.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to update alert"),
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
        <span className="flex items-center gap-1.5">
          <Badge variant={r.enabled ? "default" : "secondary"}>
            {r.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <BrokenBadge entity={r} />
        </span>
      ),
    },
    {
      key: "lastEvaluation",
      header: "Last result",
      render: (r) =>
        r.lastEvaluation?.outcome ? (
          <Badge variant={r.lastEvaluation.outcome === "failed" ? "destructive" : "outline"}>
            {OUTCOME_LABELS[r.lastEvaluation.outcome]}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
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
          {canEvaluate && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => evaluate.mutate(r._id)}
              disabled={evaluate.isPending}
              aria-label={`Evaluate ${r.name}`}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update.mutate(r)}
            disabled={update.isPending || (!r.enabled && isBroken(r))}
            title={
              !r.enabled && isBroken(r)
                ? "Point this alert at another dataset or widget before enabling it"
                : undefined
            }
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

const OUTCOME_LABELS: Record<AlertEvaluationOutcome, string> = {
  triggered: "Triggered",
  suppressed: "Suppressed (cooldown)",
  not_met: "Not met",
  no_data: "No data",
  failed: "Failed",
};

/** Outcome of the most recent evaluation (value, groups, or why it failed). */
export function LastEvaluation({
  evaluation,
}: {
  evaluation?: AlertEvaluation | null | undefined;
}) {
  if (!evaluation?.outcome) return <p className="text-muted-foreground">Not evaluated yet.</p>;
  const groups =
    typeof evaluation.groupsEvaluated === "number"
      ? ` · ${evaluation.groupsMatched ?? 0} of ${evaluation.groupsEvaluated} groups`
      : "";
  return (
    <div>
      Last evaluation:{" "}
      <Badge variant={evaluation.outcome === "failed" ? "destructive" : "secondary"}>
        {OUTCOME_LABELS[evaluation.outcome]}
      </Badge>{" "}
      {evaluation.outcome !== "failed" ? `value ${evaluation.value ?? "—"}${groups}` : null}
      {evaluation.at ? ` · ${date(evaluation.at)}` : null}
      {evaluation.error ? (
        <span className="mt-1 block text-xs text-destructive">{evaluation.error}</span>
      ) : null}
    </div>
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
          {isBroken(alert) ? (
            <BrokenDependencyState
              entity={alert}
              resource="alert"
              fixHint="Edit the alert and choose another dataset or widget, then enable it again."
            />
          ) : null}
          <p>
            {alert.metric} {alert.condition} {alert.threshold}
            {alert.condition === "between" ? `–${alert.thresholdHigh ?? ""}` : ""}
          </p>
          <p>
            Grouped results: {GROUP_EVALUATION_LABELS[alert.groupEvaluation ?? "total"]} · Cooldown{" "}
            {alert.cooldownMinutes ?? 60} min
          </p>
          <p>Status: {alert.enabled ? "Enabled" : "Disabled"}</p>
          <LastEvaluation evaluation={alert.lastEvaluation} />
          <p>
            Schedule: {alert.schedule?.cron ?? "—"} (
            {alert.schedule?.timezone || "workspace time zone"})
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
                <div key={event._id} className="flex justify-between gap-2 border-b py-2 text-sm">
                  <span className="capitalize">{event.status}</span>
                  <span className="truncate text-muted-foreground">{event.message}</span>
                  <span className="shrink-0 text-muted-foreground">{date(event.triggeredAt)}</span>
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

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function AlertForm({ alert, onClose }: { alert?: AlertRule; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(alert?.name ?? "");
  const [source, setSource] = useState<"widget" | "query">(alert?.source ?? "query");
  const [datasetId, setDatasetId] = useState(
    alert?.datasetId ??
      (alert?.query as { datasetId?: string } | null | undefined)?.datasetId ??
      "",
  );
  const [dashboardId, setDashboardId] = useState(alert?.dashboardId ?? "");
  const [widgetId, setWidgetId] = useState(alert?.widgetId ?? "");
  const [queryJson, setQueryJson] = useState(
    alert?.query ? JSON.stringify(alert.query, null, 2) : "{}",
  );
  const [metric, setMetric] = useState(alert?.metric ?? "");
  const [groupEvaluation, setGroupEvaluation] = useState<AlertGroupEvaluation>(
    alert?.groupEvaluation ?? "total",
  );
  const [condition, setCondition] = useState<AlertRule["condition"]>(alert?.condition ?? "gt");
  const [threshold, setThreshold] = useState(String(alert?.threshold ?? 0));
  const [thresholdHigh, setThresholdHigh] = useState(String(alert?.thresholdHigh ?? ""));
  const [cooldown, setCooldown] = useState(String(alert?.cooldownMinutes ?? 60));
  const [repeatMode, setRepeatMode] = useState<"once_per_incident" | "after_cooldown">(
    alert?.repeatMode ?? "once_per_incident",
  );
  const [error, setError] = useState("");
  // The API rejects an invalid query with 400 INVALID_QUERY and a metric the
  // query does not output with 400 ALERT_METRIC_INVALID, both with field errors.
  const [failure, setFailure] = useState<unknown>(null);

  // The metric must be one of the query's outputs (see features/alerts/lib/metrics).
  const parsedQuery = useMemo(() => parseQueryJson(queryJson), [queryJson]);
  const outputs = useMemo(() => queryOutputs(parsedQuery), [parsedQuery]);
  const queryMetric = outputs.includes(metric) ? metric : (outputs[0] ?? "count");
  const effectiveMetric = source === "query" ? queryMetric : metric.trim();
  const showGrouping = source === "widget" || isGrouped(parsedQuery);

  const mutation = useMutation({
    mutationFn: () => {
      const low = Number(threshold);
      if (!name.trim() || !Number.isFinite(low))
        throw new Error("Name and a numeric threshold are required.");
      if (condition === "between" && !(Number(thresholdHigh) >= low))
        throw new Error("Between conditions need a high threshold at or above the threshold.");
      const minutes = Number(cooldown);
      if (!Number.isInteger(minutes) || minutes < 0)
        throw new Error("Cooldown must be a whole number of minutes (0 or more).");
      let query: Record<string, unknown> | undefined;
      if (source === "query") {
        query = parseQueryJson(queryJson);
        if (!query) throw new Error("Query must be a valid JSON object.");
        if (datasetId.trim()) query = { ...query, datasetId: datasetId.trim() };
        if (!query["datasetId"]) throw new Error("A dataset ID is required (field or query JSON).");
      } else if (!dashboardId || !widgetId) {
        throw new Error("Dashboard and widget IDs are required for widget alerts.");
      }
      const body: AlertInput = {
        name: name.trim(),
        // Widget alerts may leave the metric empty: the widget's first output is used.
        ...(effectiveMetric ? { metric: effectiveMetric } : {}),
        groupEvaluation: showGrouping ? groupEvaluation : "total",
        condition,
        threshold: low,
        ...(condition === "between" ? { thresholdHigh: Number(thresholdHigh) } : {}),
        cooldownMinutes: minutes,
        repeatMode,
        source,
        ...(source === "query"
          ? { query: query as AnalyticsQueryParams }
          : { dashboardId, widgetId }),
        enabled: alert?.enabled ?? true,
      };
      return alert ? alertsApi.update(alert._id, body) : alertsApi.create(body);
    },
    onSuccess: () => {
      toast.success(alert ? "Alert updated" : "Alert created");
      setError("");
      setFailure(null);
      onClose();
      void client.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e) => {
      setError(errorMessage(e, "Unable to save alert"));
      // A plan-limit refusal is already one sentence; field errors show inline.
      setFailure(isQuotaExceeded(e) ? null : e);
    },
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
            <>
              <Label>
                Dataset ID
                <Input value={datasetId} onChange={(e) => setDatasetId(e.target.value)} />
              </Label>
              <Label>
                Query JSON
                <Textarea
                  value={queryJson}
                  onChange={(e) => setQueryJson(e.target.value)}
                  className="min-h-28 font-mono text-xs"
                />
              </Label>
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="alert-metric">Metric</Label>
            {source === "query" ? (
              <select
                id="alert-metric"
                className={selectClass}
                value={queryMetric}
                onChange={(e) => setMetric(e.target.value)}
              >
                {outputs.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="alert-metric"
                value={metric}
                placeholder="The widget's first metric"
                onChange={(e) => setMetric(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {source === "query"
                ? "One of the query's outputs: a metric alias, or count when the query has no metrics."
                : "A metric alias of the widget's query (count when it has no metrics)."}
            </p>
          </div>
          {showGrouping ? (
            <div className="space-y-1">
              <Label htmlFor="alert-group-evaluation">Grouped results</Label>
              <select
                id="alert-group-evaluation"
                className={selectClass}
                value={groupEvaluation}
                onChange={(e) => setGroupEvaluation(e.target.value as AlertGroupEvaluation)}
              >
                {(Object.keys(GROUP_EVALUATION_LABELS) as AlertGroupEvaluation[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {GROUP_EVALUATION_LABELS[mode]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
          <Label>
            Cooldown (minutes)
            <Input
              type="number"
              min={0}
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
            />
          </Label>
          <Label>
            Repeat notifications
            <select
              aria-label="Repeat notifications"
              className="mt-1 block w-full rounded-md border bg-background p-2 text-sm"
              value={repeatMode}
              onChange={(e) => setRepeatMode(e.target.value as typeof repeatMode)}
            >
              <option value="once_per_incident">Once per incident</option>
              <option value="after_cooldown">Every time the cooldown ends</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {repeatMode === "once_per_incident"
                ? "You're notified once when the condition starts. While it keeps firing with the same value you won't hear again; you'll be notified again if the value changes or after the condition clears and comes back."
                : "While the condition keeps firing you're reminded again each time the cooldown ends, even if the value hasn't changed."}
            </span>
          </Label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {failure ? <InlineFieldErrors error={failure} /> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save alert"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
