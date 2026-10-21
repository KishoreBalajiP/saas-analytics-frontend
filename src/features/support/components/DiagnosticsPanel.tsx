import { useQuery } from "@tanstack/react-query";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as adminApi from "@/features/admin/api";
import { formatDateTime } from "@/features/support/lib/labels";
import type { SupportDiagnostics } from "@/features/support/types";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function counts(record: Record<string, number>) {
  const entries = Object.entries(record);
  return entries.length === 0 ? "—" : entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

/**
 * Sanitised diagnostics for one workspace - the first stop for a support
 * ticket. Operational facts only (statuses, counts, error codes); no
 * customer data and no personal data.
 */
export function DiagnosticsPanel({ tenantId }: { tenantId: string }) {
  const query = useQuery({
    queryKey: ["admin", "support", "diagnostics", tenantId],
    queryFn: () => adminApi.tenantDiagnostics(tenantId),
    enabled: Boolean(tenantId),
  });

  if (query.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (query.isError || !query.data)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Workspace" />;
  return <DiagnosticsView d={query.data} />;
}

export function DiagnosticsView({ d }: { d: SupportDiagnostics }) {
  const usage = Object.entries(d.usage ?? {});
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {d.tenant.name ?? d.tenant.id}
          <Badge variant={d.tenant.status === "active" ? "default" : "destructive"}>
            {d.tenant.status ?? "unknown"}
          </Badge>
          {d.subscription.writeBlocked ? <Badge variant="destructive">Writes blocked</Badge> : null}
        </CardTitle>
        <CardDescription>
          Plan{" "}
          {d.subscription.plan?.displayName ?? d.subscription.plan?.code ?? d.tenant.planId ?? "—"}{" "}
          · subscription {d.subscription.state ?? "—"} · time zone{" "}
          {d.tenant.defaultTimezone ?? "UTC"} · generated {formatDateTime(d.generatedAt)} (last{" "}
          {d.window.hours} h)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={d.users.total} />
          <Stat label="Live sessions" value={d.users.activeSessions} />
          <Stat
            label="Connectors with errors"
            value={`${d.connectors.withErrors} / ${d.connectors.total}`}
          />
          <Stat label="Failed syncs (24 h)" value={d.syncRuns.failedInWindow} />
          <Stat label="Requests (24 h)" value={d.requests.total} />
          <Stat label="Error rate" value={`${Math.round(d.requests.errorRate * 1000) / 10}%`} />
          <Stat
            label="Broken items"
            value={d.broken.widgets + d.broken.reports + d.broken.alerts}
          />
          <Stat label="Open support sessions" value={d.supportAccess.openSessions} />
        </div>

        <section className="space-y-1 text-sm" aria-label="Support access state">
          <h3 className="font-semibold">Support access</h3>
          {d.supportAccess.active ? (
            <p>
              {d.supportAccess.active.breakGlass ? "Break-glass" : "Consent"} active until{" "}
              {formatDateTime(d.supportAccess.active.expiresAt)}
            </p>
          ) : (
            <p className="text-muted-foreground">
              No support access granted. Ask the workspace to grant it in Settings, or request
              break-glass access for an incident.
            </p>
          )}
          {d.supportAccess.pendingBreakGlass > 0 ? (
            <p>{d.supportAccess.pendingBreakGlass} break-glass request(s) awaiting approval.</p>
          ) : null}
        </section>

        <section className="space-y-1 text-sm" aria-label="Users and connectors">
          <h3 className="font-semibold">Users and connectors</h3>
          <p>Users by status: {counts(d.users.byStatus)}</p>
          <p>Connectors by status: {counts(d.connectors.byStatus)}</p>
          {d.connectors.items.length > 0 ? (
            <ul className="space-y-1">
              {d.connectors.items.map((c) => (
                <li key={c.id} className="rounded-md border p-2">
                  <span className="font-medium">{c.name ?? c.id}</span>{" "}
                  <span className="text-muted-foreground">
                    ({c.type}) · {c.status} · sync {c.syncStatus} · last synced{" "}
                    {formatDateTime(c.lastSyncedAt)} · errors {c.errorCount}
                  </span>
                  {c.lastError ? (
                    <div className="mt-1 font-mono text-xs text-destructive">{c.lastError}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {d.requests.topErrors.length > 0 ? (
          <section className="space-y-1 text-sm" aria-label="Failing requests">
            <h3 className="font-semibold">Most frequent failing requests</h3>
            <ul className="font-mono text-xs">
              {d.requests.topErrors.map((row) => (
                <li key={`${row.path}-${row.statusCode}`}>
                  {row.statusCode} {row.path} × {row.count}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {usage.length > 0 ? (
          <section className="space-y-1 text-sm" aria-label="Usage">
            <h3 className="font-semibold">Usage against limits</h3>
            <ul className="grid gap-1 sm:grid-cols-2">
              {usage.map(([metric, m]) => (
                <li key={metric} className="flex justify-between gap-2 rounded-md border px-2 py-1">
                  <span>{metric}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.current ?? 0} / {m.limit ?? "∞"}
                    {m.overLimit ? " (over)" : m.warning ? " (near limit)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
