import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
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
import * as reportsApi from "@/features/reports/api";
import type { PaginationMeta, Report, ReportRun } from "@/lib/api/types";
import { errorMessage, isQuotaExceeded } from "@/lib/api/quota";
// delivery: roadmap 3.4
import { DeliveryFields } from "./DeliveryFields";
import { parseEmails } from "../lib/recipients";
import { DeliveryHistory } from "./DeliveryHistory";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";
import { formatRows, triggerDownload } from "@/lib/download";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function ReportsView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.REPORTS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.REPORTS_CREATE);
  const canDelete = hasPermission(permissions, Permissions.REPORTS_DELETE);
  // Running a report (POST /reports/:id/run) needs reports.export.
  const canExport = hasPermission(permissions, Permissions.REPORTS_EXPORT);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ["reports", "list", page],
    queryFn: () => reportsApi.list({ page, limit: 20 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Reports" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Reports" />;
  const rows = (query.data?.data ?? []) as Report[];
  const meta = query.data?.meta as PaginationMeta | undefined;
  return (
    <div className="space-y-4">
      {canCreate && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create report
        </Button>
      )}
      {!rows.length ? (
        <EmptyState
          title="No reports yet"
          description="Create a report from a saved widget or a safe analytics query."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>Create report</Button>
            ) : undefined
          }
        />
      ) : (
        <ReportTable
          rows={rows}
          {...(meta ? { meta } : {})}
          page={page}
          setPage={setPage}
          canDelete={canDelete}
          canExport={canExport}
        />
      )}
      {createOpen && <ReportForm onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ReportTable({
  rows,
  meta,
  page,
  setPage,
  canDelete,
  canExport,
}: {
  rows: Report[];
  meta?: PaginationMeta;
  page: number;
  setPage: (page: number) => void;
  canDelete: boolean;
  canExport: boolean;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => reportsApi.remove(id),
    onSuccess: () => {
      toast.success("Report deleted");
      setPending(null);
      void client.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to delete report"),
  });
  const run = useMutation({
    mutationFn: (id: string) => reportsApi.run(id),
    onSuccess: (result) => {
      toast.success(result.accepted ? "Report queued" : "Report started");
      void client.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to run report"),
  });
  const columns: Column<Report>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <AppLink className="font-medium hover:underline" to={`/reports/${row._id}` as string}>
          {row.name}
        </AppLink>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (row) => <Badge variant="outline">{row.source}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <span className="flex items-center gap-1.5">
          <Badge className="capitalize" variant="secondary">
            {row.status ?? "draft"}
          </Badge>
          <BrokenBadge entity={row} />
        </span>
      ),
    },
    {
      key: "schedule",
      header: "Schedule",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.schedule?.enabled ? row.schedule.cron : "Manual"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          {canExport && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => run.mutate(row._id)}
              disabled={run.isPending}
              aria-label={`Run ${row.name}`}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <AppLink to={`/reports/${row._id}/edit` as string}>Edit</AppLink>
          </Button>
          {canDelete && (
            <AlertDialog
              open={pending === row._id}
              onOpenChange={(open) => !open && setPending(null)}
            >
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPending(row._id)}
                  aria-label={`Delete ${row.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete report?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the report and its run history.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => remove.mutate(row._id)}
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
  const tableRows = rows as Array<Report & Record<string, unknown>>;
  return (
    <DataTable
      columns={columns as Column<Report & Record<string, unknown>>[]}
      data={tableRows}
      {...(meta ? { meta } : {})}
      onPageChange={setPage}
      getRowId={(row) => String(row["_id"])}
    />
  );
}

const ACTIVE_RUN_STATUSES = new Set(["pending", "running"]);

/** Re-read a report every 2 s while one of its runs is still being generated. */
function pollWhileGenerating(report: Report | undefined) {
  return report?.runs?.some((run) => ACTIVE_RUN_STATUSES.has(run.status)) ? 2000 : false;
}

export function ReportDetail({ reportId, edit = false }: { reportId: string; edit?: boolean }) {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.REPORTS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.REPORTS_UPDATE);
  const canExport = hasPermission(permissions, Permissions.REPORTS_EXPORT);
  const query = useQuery({
    queryKey: ["reports", reportId],
    queryFn: () => reportsApi.get(reportId),
    enabled: canView,
    refetchInterval: (q) => (edit ? false : pollWhileGenerating(q.state.data)),
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Report" />;
  if (query.isLoading) return <TableSkeleton rows={4} cols={2} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Report" />;
  if (!query.data) return null;
  return edit && canUpdate ? (
    <ReportForm report={query.data} onClose={() => void query.refetch()} />
  ) : (
    <ReportSummary report={query.data} canExport={canExport} />
  );
}

/** Download a run's artefact through a short-lived signed link. */
function useRunDownload(reportId: string) {
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: (runId: string | undefined) => reportsApi.download(reportId, runId),
    onSuccess: (descriptor) => {
      setError(null);
      triggerDownload(descriptor.url, descriptor.fileName);
    },
    onError: (e) => setError(e),
  });
  return {
    download: (runId?: string) => mutation.mutate(runId),
    pendingRunId: mutation.isPending ? (mutation.variables ?? "latest") : null,
    error,
  };
}

function ReportSummary({ report, canExport }: { report: Report; canExport: boolean }) {
  const client = useQueryClient();
  const run = useMutation({
    mutationFn: () => reportsApi.run(report._id),
    onSuccess: () => {
      toast.success("Report queued");
      void client.invalidateQueries({ queryKey: ["reports", report._id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to run report"),
  });
  const runs = report.runs ?? [];
  const latestReady = [...runs].reverse().find((r) => r.status === "ready" && r.resultKey);
  // retention: the newest ready run whose file the cleanup job already removed.
  const latestRun = [...runs].reverse().find((r) => r.status === "ready");
  const latestExpired = latestRun && !latestRun.resultKey && latestRun.expiredAt ? latestRun : null;
  const { download, pendingRunId, error } = useRunDownload(report._id);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{report.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isBroken(report) ? (
            <BrokenDependencyState
              entity={report}
              resource="report"
              fixHint="Edit the report and choose another dataset or widget. Its schedule was paused; turn it back on afterwards."
            />
          ) : null}
          <p>{report.description || "No description."}</p>
          <p>
            Status:{" "}
            <Badge variant="secondary" className="capitalize">
              {report.status ?? "draft"}
            </Badge>
          </p>
          <p>
            Format: <span className="uppercase">{report.format}</span>
          </p>
          <p>
            Schedule:{" "}
            {report.schedule?.enabled
              ? `${report.schedule.cron} (${report.schedule.timezone || "workspace time zone"})`
              : "Manual"}
          </p>
          <div className="flex gap-2">
            {canExport ? (
              <Button onClick={() => run.mutate()} disabled={run.isPending}>
                <Play className="mr-1 h-4 w-4" />
                {run.isPending ? "Queuing…" : "Generate"}
              </Button>
            ) : null}
            {canExport && latestReady ? (
              <Button
                variant="outline"
                onClick={() => download(latestReady._id)}
                disabled={pendingRunId !== null}
              >
                <Download className="mr-1 h-4 w-4" /> Download latest
              </Button>
            ) : null}
          </div>
          {latestExpired ? (
            // retention: the file was deleted after its retention window.
            <p className="text-sm text-muted-foreground">
              The latest file expired on {date(latestExpired.expiredAt)}. Generate the report again
              to download it.
            </p>
          ) : null}
          {error ? <ErrorState error={error} resource="Report download" /> : null}
        </CardContent>
      </Card>
      <RunHistory
        runs={runs}
        canExport={canExport}
        onDownload={download}
        pendingRunId={pendingRunId}
      />
      {/* delivery: roadmap 3.4 */}
      <DeliveryHistory reportId={report._id} canRetry={canExport} />
    </div>
  );
}

const RUN_STATUS_VARIANT: Record<
  ReportRun["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  running: "secondary",
  ready: "default",
  failed: "destructive",
};

export function RunHistory({
  runs,
  canExport,
  onDownload,
  pendingRunId = null,
}: {
  runs: ReportRun[];
  canExport: boolean;
  onDownload: (runId: string) => void;
  pendingRunId?: string | null;
}) {
  const ordered = [...runs].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run history</CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length ? (
          <ul className="divide-y" aria-label="Report runs">
            {ordered.map((run) => {
              const when = date(run.finishedAt ?? run.startedAt ?? run.createdAt);
              const downloadable = run.status === "ready" && Boolean(run.resultKey);
              return (
                <li
                  key={run._id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={RUN_STATUS_VARIANT[run.status] ?? "outline"}
                      className="capitalize"
                    >
                      {run.status}
                    </Badge>
                    <span className="font-mono text-xs uppercase">{run.format}</span>
                    {run.status === "ready" ? <span>{formatRows(run.rowCount)}</span> : null}
                    {run.truncated ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700"
                        title="The result was larger than the export safety limit; the file holds the first rows only."
                      >
                        Truncated at {formatRows(run.rowLimit ?? run.rowCount)}
                      </Badge>
                    ) : null}
                    <span className="text-muted-foreground">
                      {run.triggeredBy === "schedule" ? "Scheduled" : "Manual"} · {when}
                      {run.expiredAt && !run.resultKey ? " · file expired" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.status === "failed" && run.error ? (
                      <span className="text-xs text-destructive">{run.error}</span>
                    ) : null}
                    {canExport && downloadable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDownload(run._id)}
                        disabled={pendingRunId === run._id}
                        aria-label={`Download ${run.format.toUpperCase()} from ${when}`}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        {pendingRunId === run._id ? "Preparing…" : "Download"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportForm({ report, onClose }: { report?: Report; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(report?.name ?? "");
  const [source, setSource] = useState<"widget" | "query">(report?.source ?? "query");
  const [format, setFormat] = useState<"json" | "csv" | "xlsx">(report?.format ?? "csv");
  const [dashboardId, setDashboardId] = useState(report?.dashboardId ?? "");
  const [widgetId, setWidgetId] = useState(report?.widgetId ?? "");
  const [queryJson, setQueryJson] = useState(
    report?.query ? JSON.stringify(report.query, null, 2) : "{}",
  );
  const [enabled, setEnabled] = useState(report?.schedule?.enabled ?? false);
  const [cron, setCron] = useState(report?.schedule?.cron ?? "0 8 * * 1");
  // Empty = run in the workspace time zone (Settings).
  const [timezone, setTimezone] = useState(report?.schedule?.timezone ?? "");
  // delivery: external recipients (member recipients are kept as they are) and destinations.
  const [externalEmails, setExternalEmails] = useState(
    (report?.schedule?.recipients ?? [])
      .filter((r) => r.type === "external")
      .map((r) => r.value)
      .join(", "),
  );
  const [destinationIds, setDestinationIds] = useState<string[]>(
    report?.schedule?.destinationIds ?? [],
  );
  const [error, setError] = useState("");
  // The API rejects an invalid query with 400 INVALID_QUERY and field errors.
  const [failure, setFailure] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      let query: unknown;
      try {
        query = JSON.parse(queryJson);
      } catch {
        throw new Error("Query must be valid JSON.");
      }
      if (!name.trim()) throw new Error("Name is required.");
      if (source === "widget" && (!dashboardId || !widgetId))
        throw new Error("Dashboard and widget IDs are required for widget reports.");
      const body = {
        name: name.trim(),
        source,
        format,
        schedule: {
          enabled,
          cron,
          timezone: timezone.trim() || null,
          format,
          recipients: [
            ...(report?.schedule?.recipients ?? []).filter((r) => r.type !== "external"),
            ...parseEmails(externalEmails).map((value) => ({ type: "external" as const, value })),
          ],
          destinationIds,
        },
        ...(dashboardId ? { dashboardId } : {}),
        ...(widgetId ? { widgetId } : {}),
        ...(source === "query"
          ? { query: query as import("@/lib/api/types").AnalyticsQueryParams }
          : {}),
      };
      return report ? reportsApi.update(report._id, body) : reportsApi.create(body);
    },
    onSuccess: () => {
      setError("");
      setFailure(null);
      toast.success(report ? "Report updated" : "Report created");
      onClose();
      void client.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => {
      setError(errorMessage(e, "Unable to save report"));
      // A plan-limit refusal is already one sentence; field errors show inline.
      setFailure(isQuotaExceeded(e) ? null : e);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{report ? "Edit report" : "Create report"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="report-name">Name</Label>
            <Input
              id="report-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-source">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as "widget" | "query")}>
              <SelectTrigger id="report-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="query">Analytics query</SelectItem>
                <SelectItem value="widget">Dashboard widget</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                className="min-h-32 font-mono text-xs"
              />
            </Label>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Label>
              Format
              <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["json", "csv", "xlsx"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Timezone
              <Input
                value={timezone}
                placeholder="Workspace time zone"
                onChange={(e) => setTimezone(e.target.value)}
              />
            </Label>
            <Label>
              Cron
              <Input value={cron} disabled={!enabled} onChange={(e) => setCron(e.target.value)} />
            </Label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            Enable schedule
          </label>
          <DeliveryFields
            externalEmails={externalEmails}
            onExternalEmails={setExternalEmails}
            destinationIds={destinationIds}
            onDestinationIds={setDestinationIds}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {failure ? <InlineFieldErrors error={failure} /> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
