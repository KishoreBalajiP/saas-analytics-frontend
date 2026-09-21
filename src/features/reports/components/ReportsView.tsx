import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Plus, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
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
import * as reportsApi from "@/features/reports/api";
import type { PaginationMeta, Report, ReportRun } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

export function ReportsView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.REPORTS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.REPORTS_CREATE);
  const canDelete = hasPermission(permissions, Permissions.REPORTS_DELETE);
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
}: {
  rows: Report[];
  meta?: PaginationMeta;
  page: number;
  setPage: (page: number) => void;
  canDelete: boolean;
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
        <Badge className="capitalize" variant="secondary">
          {row.status ?? "draft"}
        </Badge>
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run.mutate(row._id)}
            disabled={run.isPending}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
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

export function ReportDetail({ reportId, edit = false }: { reportId: string; edit?: boolean }) {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.REPORTS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.REPORTS_UPDATE);
  const canExport = hasPermission(permissions, Permissions.REPORTS_EXPORT);
  const query = useQuery({
    queryKey: ["reports", reportId],
    queryFn: () => reportsApi.get(reportId),
    enabled: canView,
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

function ReportSummary({ report, canExport }: { report: Report; canExport: boolean }) {
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const run = useMutation({
    mutationFn: () => reportsApi.run(report._id),
    onSuccess: () => toast.success("Report queued"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to run report"),
  });
  const latest = report.runs?.[report.runs.length - 1] as ReportRun | undefined;
  async function download() {
    try {
      const result = await reportsApi.download(report._id, latest?.runId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDownloadError(e);
    }
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{report.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
              ? `${report.schedule.cron} (${report.schedule.timezone ?? "UTC"})`
              : "Manual"}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => run.mutate()} disabled={run.isPending}>
              <Play className="mr-1 h-4 w-4" />
              {run.isPending ? "Queuing…" : "Generate"}
            </Button>
            {canExport && Boolean(latest?.resultKey) ? (
              <Button variant="outline" onClick={() => void download()}>
                <Download className="mr-1 h-4 w-4" /> Download
              </Button>
            ) : null}
          </div>
          {downloadError ? <ErrorState error={downloadError} resource="Report download" /> : null}
        </CardContent>
      </Card>
      <RunHistory runs={report.runs ?? []} />
    </div>
  );
}

function RunHistory({ runs }: { runs: ReportRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run history</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length ? (
          <div className="space-y-2">
            {runs.map((run) => (
              <div
                key={run.runId}
                className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm"
              >
                <span className="capitalize">{run.status}</span>
                <span className="text-muted-foreground">
                  {run.format} · {date(run.finishedAt ?? run.startedAt)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportForm({ report, onClose }: { report?: Report; onClose: () => void }) {
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
  const [timezone, setTimezone] = useState(report?.schedule?.timezone ?? "UTC");
  const [error, setError] = useState("");
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
        schedule: { enabled, cron, timezone, format },
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
      toast.success(report ? "Report updated" : "Report created");
      onClose();
      void client.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to save report"),
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
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
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
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
