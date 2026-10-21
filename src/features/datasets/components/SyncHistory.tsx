import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { DataTable, type Column } from "@/components/common/DataTable";
import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import * as connectorsApi from "@/features/datasets/api";
import type { SyncRun } from "@/features/datasets/api";
import {
  SYNC_POLL_INTERVAL_MS,
  formatDuration,
  isSyncInFlight,
  syncStatusLabel,
  syncStatusVariant,
  syncTriggerLabel,
} from "@/features/datasets/sync";
import type { Connector, PaginationMeta } from "@/lib/api/types";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

/** Badge for a connector's current sync state or one sync run. */
export function SyncStatusBadge({ status }: { status: string | null | undefined }) {
  const active = status === "queued" || status === "running" || status === "retrying";
  return (
    <Badge variant={syncStatusVariant(status)} className="gap-1">
      {active ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
      {syncStatusLabel(status)}
    </Badge>
  );
}

/** Current sync state of a connector (overview card rows). */
export function SyncStateSummary({ connector }: { connector: Connector }) {
  const inFlight = isSyncInFlight(connector);
  return (
    <>
      <div className="flex gap-2">
        <dt className="w-36 text-muted-foreground">Sync status</dt>
        <dd data-testid="sync-state">
          <SyncStatusBadge status={connector.syncStatus ?? "idle"} />
        </dd>
      </div>
      {connector.syncRequestedAt ? (
        <div className="flex gap-2">
          <dt className="w-36 text-muted-foreground">Last requested</dt>
          <dd>{formatDate(connector.syncRequestedAt)}</dd>
        </div>
      ) : null}
      {inFlight ? (
        <p className="text-xs text-muted-foreground">
          This page refreshes automatically until the sync finishes.
        </p>
      ) : null}
    </>
  );
}

function rowsSummary(run: SyncRun) {
  const rows = run.rows;
  if (!rows || (!rows.received && !rows.upserted && !rows.matched)) return "—";
  const parts = [`${(rows.received ?? 0).toLocaleString()} read`];
  if (rows.upserted) parts.push(`${rows.upserted.toLocaleString()} new`);
  if (rows.matched) parts.push(`${rows.matched.toLocaleString()} updated`);
  if (rows.failed) parts.push(`${rows.failed.toLocaleString()} with errors`);
  return parts.join(" · ");
}

const columns: Column<SyncRun & Record<string, unknown>>[] = [
  {
    key: "status",
    header: "Status",
    render: (run) => <SyncStatusBadge status={run.status} />,
  },
  {
    key: "trigger",
    header: "Trigger",
    render: (run) => (
      <span>
        {syncTriggerLabel(run.trigger)}
        {run.filename ? (
          <span className="block text-xs text-muted-foreground">{run.filename}</span>
        ) : null}
      </span>
    ),
  },
  {
    key: "queuedAt",
    header: "Requested",
    render: (run) => formatDate(run.queuedAt ?? run.createdAt),
  },
  {
    key: "durationMs",
    header: "Duration",
    render: (run) => formatDuration(run.durationMs),
  },
  {
    key: "attempts",
    header: "Attempts",
    render: (run) =>
      run.maxAttempts ? `${run.attempts} / ${run.maxAttempts}` : String(run.attempts ?? 0),
  },
  {
    key: "rows",
    header: "Rows",
    render: (run) => rowsSummary(run),
  },
  {
    key: "error",
    header: "Details",
    className: "max-w-xs",
    render: (run) =>
      run.error?.message ? (
        <span className="text-destructive" title={run.error.code ?? undefined}>
          {run.error.message}
        </span>
      ) : (
        "—"
      ),
  },
];

/**
 * Sync history of one connector (newest first). Polls while a sync is in
 * flight so the latest run's state is visible without a reload.
 */
export function SyncHistory({
  connectorId,
  enabled = true,
  live = false,
}: {
  connectorId: string;
  enabled?: boolean;
  live?: boolean;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["connector", connectorId, "sync-runs", page],
    queryFn: () => connectorsApi.listSyncRuns(connectorId, { page, limit: 10 }),
    enabled: enabled && Boolean(connectorId),
    refetchInterval: live ? SYNC_POLL_INTERVAL_MS : false,
  });

  if (query.isLoading) return <TableSkeleton rows={4} cols={5} />;
  if (query.isError) {
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Sync history" />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={(query.data?.data ?? []) as (SyncRun & Record<string, unknown>)[]}
      meta={query.data?.meta as PaginationMeta | undefined}
      onPageChange={setPage}
      getRowId={(run) => String(run.id)}
      emptyMessage="No syncs yet. Upload a file or start a sync to see its history here."
    />
  );
}
