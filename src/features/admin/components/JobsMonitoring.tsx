import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { DataTable, type Column } from "@/components/common/DataTable";
import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as adminApi from "@/features/admin/api";
import type { JobRun, JobRunStatus, QueueStats, SchedulerJobHealth } from "@/features/admin/api";
import type { PaginationMeta } from "@/lib/api/types";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function duration(ms?: number | null) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

type Variant = "default" | "secondary" | "destructive" | "outline";

function statusVariant(status?: string | null): Variant {
  if (status === "ok" || status === "succeeded") return "default";
  if (status === "failed" || status === "abandoned" || status === "down") return "destructive";
  if (status === "degraded" || status === "running") return "secondary";
  return "outline";
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant={statusVariant(status)} className="capitalize">
      {status ?? "unknown"}
    </Badge>
  );
}

function countsText(counts: Record<string, number> | null | undefined) {
  if (!counts) return "—";
  return Object.entries(counts)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

const schedulerColumns: Column<SchedulerJobHealth & Record<string, unknown>>[] = [
  {
    key: "name",
    header: "Job",
    render: (job) => <span className="font-mono text-xs">{job.name}</span>,
  },
  {
    key: "cronExpression",
    header: "Schedule",
    render: (job) => <code className="text-xs">{job.cronExpression}</code>,
  },
  {
    key: "state",
    header: "State",
    render: (job) =>
      !job.enabled ? (
        <Badge variant="outline">Disabled</Badge>
      ) : job.overdue ? (
        <Badge variant="destructive">Overdue</Badge>
      ) : (
        <StatusBadge status={job.lastRun?.status ?? "never run"} />
      ),
  },
  { key: "lastRun", header: "Last run", render: (job) => date(job.lastRun?.startedAt) },
  { key: "lastSuccessAt", header: "Last success", render: (job) => date(job.lastSuccessAt) },
  {
    key: "lastFailure",
    header: "Last failure",
    render: (job) =>
      job.lastFailure ? (
        <span className="text-destructive">
          {date(job.lastFailure.startedAt)}
          {job.lastFailure.error?.message ? ` — ${job.lastFailure.error.message}` : ""}
        </span>
      ) : (
        "—"
      ),
  },
];

const queueColumns: Column<QueueStats & Record<string, unknown>>[] = [
  {
    key: "name",
    header: "Queue",
    render: (q) => <span className="font-mono text-xs">{q.name}</span>,
  },
  { key: "status", header: "Status", render: (q) => <StatusBadge status={q.status} /> },
  { key: "waiting", header: "Waiting", render: (q) => q.waiting ?? "—" },
  { key: "active", header: "Active", render: (q) => q.active ?? "—" },
  { key: "delayed", header: "Delayed", render: (q) => q.delayed ?? "—" },
  { key: "failed", header: "Failed", render: (q) => q.failed ?? "—" },
];

const runColumns: Column<JobRun & Record<string, unknown>>[] = [
  {
    key: "job",
    header: "Job",
    render: (run) => <span className="font-mono text-xs">{run.job}</span>,
  },
  { key: "status", header: "Status", render: (run) => <StatusBadge status={run.status} /> },
  { key: "startedAt", header: "Started", render: (run) => date(run.startedAt) },
  { key: "durationMs", header: "Duration", render: (run) => duration(run.durationMs) },
  { key: "instanceId", header: "Instance", render: (run) => run.instanceId ?? "—" },
  { key: "counts", header: "Counts", render: (run) => countsText(run.counts) },
  {
    key: "error",
    header: "Error",
    render: (run) =>
      run.error?.message ? <span className="text-destructive">{run.error.message}</span> : "—",
  },
];

const RUN_FILTERS: Array<{ label: string; value: JobRunStatus | "" }> = [
  { label: "All", value: "" },
  { label: "Failed", value: "failed" },
  { label: "Interrupted", value: "abandoned" },
  { label: "Running", value: "running" },
];

/**
 * Scheduler health, queue health and scheduled-job run history for the
 * platform monitoring page. Callers gate on `monitoring.view`.
 */
export function JobsMonitoring() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<JobRunStatus | "">("");

  const scheduler = useQuery({
    queryKey: ["admin", "monitoring", "scheduler"],
    queryFn: adminApi.schedulerHealth,
    refetchInterval: 30000,
  });
  const queues = useQuery({
    queryKey: ["admin", "monitoring", "queues"],
    queryFn: adminApi.queueHealth,
    refetchInterval: 30000,
  });
  const runs = useQuery({
    queryKey: ["admin", "monitoring", "job-runs", status, page],
    queryFn: () => adminApi.listJobRuns({ page, limit: 20, status: status || undefined }),
  });

  const refresh = () => {
    void scheduler.refetch();
    void queues.refetch();
    void runs.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh jobs
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Scheduler</CardTitle>
          {scheduler.data ? <StatusBadge status={scheduler.data.status} /> : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduler.isLoading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : scheduler.isError ? (
            <ErrorState
              error={scheduler.error}
              onRetry={() => scheduler.refetch()}
              resource="Scheduler health"
            />
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Last tick {date(scheduler.data?.lastTickAt)}
              </p>
              <DataTable
                columns={schedulerColumns}
                data={
                  (scheduler.data?.jobs ?? []) as (SchedulerJobHealth & Record<string, unknown>)[]
                }
                getRowId={(job) => String(job.name)}
                emptyMessage="No scheduled jobs registered."
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Queues</CardTitle>
          {queues.data ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {queues.data.transport === "bullmq" ? "BullMQ (Redis)" : "In-memory"}
              <StatusBadge status={queues.data.status} />
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          {queues.isLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : queues.isError ? (
            <ErrorState
              error={queues.error}
              onRetry={() => queues.refetch()}
              resource="Queue health"
            />
          ) : (
            <DataTable
              columns={queueColumns}
              data={(queues.data?.queues ?? []) as (QueueStats & Record<string, unknown>)[]}
              getRowId={(q) => String(q.name)}
              emptyMessage="No queues."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Job runs</CardTitle>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter job runs by status">
            {RUN_FILTERS.map((filter) => (
              <Button
                key={filter.label}
                size="sm"
                variant={status === filter.value ? "default" : "outline"}
                aria-pressed={status === filter.value}
                onClick={() => {
                  setStatus(filter.value);
                  setPage(1);
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {runs.isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : runs.isError ? (
            <ErrorState error={runs.error} onRetry={() => runs.refetch()} resource="Job runs" />
          ) : (
            <DataTable
              columns={runColumns}
              data={(runs.data?.data ?? []) as (JobRun & Record<string, unknown>)[]}
              meta={runs.data?.meta as PaginationMeta | undefined}
              onPageChange={setPage}
              getRowId={(run) => String(run.id)}
              emptyMessage="No job runs recorded yet."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
