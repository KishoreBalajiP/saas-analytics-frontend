import { useQuery } from "@tanstack/react-query";

import { DataTable, type Column } from "@/components/common/DataTable";
import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as adminApi from "@/features/admin/api";
import type { RetentionPolicy } from "@/features/admin/api";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

const ENFORCED_BY: Record<string, string> = {
  "cleanup-job": "Cleanup job",
  "ttl-index": "TTL index",
  "cache-ttl": "Cache expiry",
};

/**
 * Data retention: each policy's window and how it is enforced, legal holds,
 * and the cleanup job's latest run (rows deleted per collection). Callers
 * gate the page on `monitoring.view`.
 */
export function RetentionMonitoring() {
  const query = useQuery({
    queryKey: ["admin", "monitoring", "retention"],
    queryFn: adminApi.retentionStatus,
  });

  const lastRun = query.data?.lastRun ?? null;
  const counts = lastRun?.counts ?? null;

  const columns: Column<RetentionPolicy & Record<string, unknown>>[] = [
    {
      key: "key",
      header: "Policy",
      render: (p) => <span className="font-mono text-xs">{p.key}</span>,
    },
    { key: "collection", header: "Data", render: (p) => p.description ?? p.collection ?? "—" },
    {
      key: "days",
      header: "Kept for",
      render: (p) =>
        p.invalid ? (
          <span className="text-destructive">Invalid: {p.invalid}</span>
        ) : p.enabled ? (
          `${p.days} day${p.days === 1 ? "" : "s"}`
        ) : (
          <Badge variant="outline">Not purged</Badge>
        ),
    },
    {
      key: "enforcedBy",
      header: "Enforced by",
      render: (p) => ENFORCED_BY[p.enforcedBy] ?? p.enforcedBy,
    },
    {
      key: "lastRun",
      header: "Last run",
      render: (p) =>
        counts && typeof counts[p.key] === "number"
          ? `${counts[p.key]} ${counts["dryRun"] ? "would be deleted" : "deleted"}`
          : "—",
    },
  ];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Data retention</CardTitle>
          {query.data ? (
            query.data.job.enabled ? (
              <Badge variant={query.data.job.dryRun ? "secondary" : "default"}>
                {query.data.job.dryRun ? "Dry run" : "Enforced"}
              </Badge>
            ) : (
              <Badge variant="destructive">Cleanup job disabled</Badge>
            )
          ) : null}
        </div>
        {query.data ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            {!query.data.job.enabled ? (
              <p>
                Nothing is purged until the cleanup job is enabled (JOB_CLEANUP_ENABLED). The
                windows below are configured but not enforced.
              </p>
            ) : null}
            <p>
              Schedule <code className="text-xs">{query.data.job.cronExpression ?? "—"}</code> ·
              last run {date(lastRun?.startedAt)}
              {lastRun ? ` (${lastRun.status})` : ""} · last success{" "}
              {date(query.data.lastSuccessAt)}
            </p>
            <p>
              Legal holds:{" "}
              {query.data.legalHoldTenantIds.length
                ? query.data.legalHoldTenantIds.join(", ")
                : "none"}
            </p>
            {lastRun?.error?.message ? (
              <p className="text-destructive">{lastRun.error.message}</p>
            ) : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Retention" />
        ) : (
          <DataTable
            columns={columns}
            data={(query.data?.policies ?? []) as (RetentionPolicy & Record<string, unknown>)[]}
            getRowId={(p) => String(p.key)}
            emptyMessage="No retention policies."
          />
        )}
      </CardContent>
    </Card>
  );
}
