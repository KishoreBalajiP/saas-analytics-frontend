import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as adminApi from "@/features/admin/api";
import { ExportStatusCard } from "@/features/admin/components/ExportStatusCard";
import {
  EMPTY_ACCESS_FILTERS,
  EMPTY_AUDIT_FILTERS,
  EMPTY_LOGIN_ATTEMPT_FILTERS,
  SECURITY_ACTIONS,
  SEVERITIES,
  toAccessQuery,
  toAuditQuery,
  toLoginAttemptQuery,
  type AccessFilters,
  type AuditFilters,
  type LoginAttemptFilters,
} from "@/features/admin/auditFilters";
import type { AccessLog, AuditLog, AuditSeverity, PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useAdminSession } from "@/lib/auth/session";

const SELECT_CLASS = "border-input bg-background h-9 rounded-md border px-3 py-1 text-sm";

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function severityVariant(severity?: AuditSeverity | null) {
  if (severity === "critical" || severity === "warning") return "destructive" as const;
  if (severity === "notice") return "default" as const;
  return "secondary" as const;
}

function actorLabel(log: AuditLog) {
  const who = log.actorDisplay || log.actorId || (log.actorType === "system" ? "system" : "—");
  return `${log.actorType}: ${who}`;
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && Object.keys(value as object).length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/** Full detail of one audit entry. */
export function AuditEntryDialog({
  entry,
  onOpenChange,
}: {
  entry: AuditLog | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {entry ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-base">{entry.action}</DialogTitle>
              <DialogDescription>
                {entry.module} · {formatDate(entry.occurredAt)}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Category</dt>
              <dd>{entry.category ?? "change"}</dd>
              {entry.severity ? (
                <>
                  <dt className="text-muted-foreground">Severity</dt>
                  <dd>{entry.severity}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Actor</dt>
              <dd className="break-all">{actorLabel(entry)}</dd>
              <dt className="text-muted-foreground">Tenant</dt>
              <dd className="break-all">{entry.tenantId ?? "platform"}</dd>
              <dt className="text-muted-foreground">Resource</dt>
              <dd className="break-all">
                {entry.resourceType ?? "—"}
                {entry.resourceId ? ` ${entry.resourceId}` : ""}
              </dd>
              <dt className="text-muted-foreground">Result</dt>
              <dd>
                {entry.result}
                {entry.errorCode ? ` (${entry.errorCode})` : ""}
              </dd>
              {entry.reason ? (
                <>
                  <dt className="text-muted-foreground">Reason</dt>
                  <dd className="break-all">{entry.reason}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">IP</dt>
              <dd>{entry.ip ?? "—"}</dd>
              <dt className="text-muted-foreground">User agent</dt>
              <dd className="break-all">{entry.userAgent ?? "—"}</dd>
              <dt className="text-muted-foreground">Request</dt>
              <dd className="break-all font-mono text-xs">{entry.requestId ?? "—"}</dd>
              {entry.seq ? (
                <>
                  <dt className="text-muted-foreground">Chain</dt>
                  <dd className="break-all font-mono text-xs">
                    #{entry.seq} {entry.hash}
                  </dd>
                </>
              ) : null}
            </dl>
            <JsonBlock label="Before" value={entry.before} />
            <JsonBlock label="After" value={entry.after} />
            <JsonBlock label="Details" value={entry.metadata} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Admin audit trail viewer: all entries, or only security events / data
 * changes, with filters, a detail view and exports. With `tenantId` the list
 * is pinned to one tenant (tenant audit history).
 */
export function AuditLogList({ tenantId: fixedTenantId }: { tenantId?: string } = {}) {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.AUDIT_LOGS_VIEW);
  const canExport = hasPermission(permissions, Permissions.AUDIT_LOGS_EXPORT);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [exportId, setExportId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "audit", fixedTenantId ?? null, applied, page],
    queryFn: () =>
      adminApi.listAuditLogs({ ...toAuditQuery(applied, fixedTenantId), page, limit: 25 }),
    enabled: canView,
  });
  const exportMutation = useMutation({
    mutationFn: (format: "json" | "csv") =>
      adminApi.exportAuditLogs(toAuditQuery(applied, fixedTenantId), format),
    onSuccess: (data) => {
      toast.success("Export requested");
      setExportId(String(data.exportId));
    },
    onError: (err: Error) => toast.error(`Export failed: ${err.message}`),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Audit logs" />;

  const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const applyFilters = (next: AuditFilters) => {
    setDraft(next);
    setApplied(next);
    setPage(1);
  };

  const rows = (query.data?.data ?? []) as Array<AuditLog & Record<string, unknown>>;
  const meta = query.data?.meta as PaginationMeta | undefined;
  const columns: Column<AuditLog & Record<string, unknown>>[] = [
    {
      key: "occurredAt",
      header: "Time",
      render: (log) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(log.occurredAt)}
        </span>
      ),
    },
    {
      key: "category",
      header: "Type",
      render: (log) =>
        log.category === "security" ? (
          <Badge variant={severityVariant(log.severity)} title={log.severity ?? undefined}>
            <ShieldAlert className="mr-1 h-3 w-3" />
            {log.severity ?? "security"}
          </Badge>
        ) : (
          <Badge variant="outline">change</Badge>
        ),
    },
    {
      key: "action",
      header: "Action",
      render: (log) => <code className="text-xs">{log.action}</code>,
    },
    { key: "module", header: "Module", render: (log) => <span>{log.module}</span> },
    {
      key: "actor",
      header: "Actor",
      render: (log) => <span className="break-all text-xs">{actorLabel(log)}</span>,
    },
    ...(fixedTenantId
      ? []
      : [
          {
            key: "tenantId",
            header: "Tenant",
            render: (log: AuditLog & Record<string, unknown>) => (
              <span className="font-mono text-xs">{log.tenantId ?? "platform"}</span>
            ),
          },
        ]),
    {
      key: "result",
      header: "Result",
      render: (log) =>
        log.result === "failure" ? (
          <Badge variant="destructive">failure</Badge>
        ) : (
          <Badge variant="secondary">success</Badge>
        ),
    },
    { key: "ip", header: "IP", render: (log) => <span className="text-xs">{log.ip ?? "—"}</span> },
    {
      key: "details",
      header: "",
      render: (log) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSelected(log)}
          aria-label={`Details for ${log.action}`}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Entry type">
        {(
          [
            ["all", "All entries"],
            ["security", "Security events"],
            ["change", "Data changes"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={applied.category === value ? "default" : "outline"}
            aria-pressed={applied.category === value}
            onClick={() => applyFilters({ ...draft, category: value })}
          >
            {label}
          </Button>
        ))}
      </div>
      <form
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters(draft);
        }}
      >
        <select
          className={SELECT_CLASS}
          value={draft.severity}
          onChange={(e) => set("severity", e.target.value)}
          aria-label="Filter by severity"
        >
          <option value="">Any severity</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Input
          value={draft.action}
          onChange={(e) => set("action", e.target.value)}
          placeholder="Action (e.g. auth.login.failed)"
          aria-label="Filter by action"
          list="audit-security-actions"
        />
        <datalist id="audit-security-actions">
          {SECURITY_ACTIONS.map((action) => (
            <option key={action} value={action} />
          ))}
        </datalist>
        <Input
          value={draft.module}
          onChange={(e) => set("module", e.target.value)}
          placeholder="Module (e.g. iam.auth)"
          aria-label="Filter by module"
        />
        <select
          className={SELECT_CLASS}
          value={draft.actorType}
          onChange={(e) => set("actorType", e.target.value)}
          aria-label="Filter by actor type"
        >
          <option value="">Any actor</option>
          {["admin", "user", "service", "system"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          value={draft.actorId}
          onChange={(e) => set("actorId", e.target.value)}
          placeholder="Actor id"
          aria-label="Filter by actor id"
        />
        <select
          className={SELECT_CLASS}
          value={draft.result}
          onChange={(e) => set("result", e.target.value)}
          aria-label="Filter by result"
        >
          <option value="">Any result</option>
          <option value="success">success</option>
          <option value="failure">failure</option>
        </select>
        {fixedTenantId ? null : (
          <Input
            value={draft.tenantId}
            onChange={(e) => set("tenantId", e.target.value)}
            placeholder="Tenant id"
            aria-label="Filter by tenant"
          />
        )}
        <Input
          value={draft.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search"
          aria-label="Search audit entries"
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="audit-from" className="shrink-0 text-xs">
            From
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={draft.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="audit-to" className="shrink-0 text-xs">
            To
          </Label>
          <Input
            id="audit-to"
            type="date"
            value={draft.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <Button type="submit" variant="outline">
            <Search className="mr-1 h-4 w-4" /> Filter
          </Button>
          <Button type="button" variant="ghost" onClick={() => applyFilters(EMPTY_AUDIT_FILTERS)}>
            Reset
          </Button>
          {canExport ? (
            <>
              <Button
                type="button"
                onClick={() => exportMutation.mutate("json")}
                disabled={exportMutation.isPending}
              >
                Export JSON
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => exportMutation.mutate("csv")}
                disabled={exportMutation.isPending}
              >
                Export CSV
              </Button>
            </>
          ) : null}
        </div>
      </form>
      {exportId ? (
        // retention: polls until done, offers the download, handles 410 expiry.
        <ExportStatusCard
          exportId={exportId}
          fetchStatus={adminApi.auditExportStatus}
          queryKey={["admin", "audit", "export"]}
          onReset={() => setExportId(null)}
        />
      ) : null}
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Audit logs" />
      ) : rows.length ? (
        <DataTable
          columns={columns}
          data={rows}
          {...(meta ? { meta } : {})}
          onPageChange={setPage}
          getRowId={(log) => String(log._id)}
        />
      ) : (
        <EmptyState
          title={applied.category === "security" ? "No security events" : "No audit events"}
          description="Nothing matches these filters."
        />
      )}
      <AuditEntryDialog entry={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

/** Audit history of one tenant (admin tenant detail page). */
export function TenantAuditHistory({ tenantId }: { tenantId: string }) {
  const { permissions } = useAdminSession();
  if (!hasPermission(permissions, Permissions.AUDIT_LOGS_VIEW)) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit history</CardTitle>
      </CardHeader>
      <CardContent>
        <AuditLogList tenantId={tenantId} />
      </CardContent>
    </Card>
  );
}

/** Access trace viewer (requests by users, admins, API keys and the sign-in surface). */
export function AccessLogList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.ACCESS_LOGS_VIEW);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<AccessFilters>(EMPTY_ACCESS_FILTERS);
  const [applied, setApplied] = useState<AccessFilters>(EMPTY_ACCESS_FILTERS);
  const query = useQuery({
    queryKey: ["admin", "access-logs", applied, page],
    queryFn: () => adminApi.listAccessLogs({ ...toAccessQuery(applied), page, limit: 50 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Access logs" />;
  const set = (key: keyof AccessFilters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const rows = (query.data?.data ?? []) as Array<AccessLog & Record<string, unknown>>;
  const meta = query.data?.meta as PaginationMeta | undefined;
  const columns: Column<AccessLog & Record<string, unknown>>[] = [
    {
      key: "occurredAt",
      header: "Time",
      render: (log) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(log.occurredAt)}
        </span>
      ),
    },
    { key: "method", header: "Method", render: (log) => <span>{log.method}</span> },
    {
      key: "path",
      header: "Path",
      render: (log) => <span className="break-all font-mono text-xs">{log.path}</span>,
    },
    {
      key: "statusCode",
      header: "Status",
      render: (log) => (
        <Badge variant={log.statusCode >= 400 ? "destructive" : "secondary"}>
          {log.statusCode}
        </Badge>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (log) => (
        <span className="break-all text-xs">
          {log.actorType}
          {log.actorId ? `: ${log.actorId}` : ""}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (log) => <code className="text-xs">{log.event ?? "—"}</code>,
    },
    { key: "ip", header: "IP", render: (log) => <span className="text-xs">{log.ip ?? "—"}</span> },
  ];
  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(draft);
          setPage(1);
        }}
      >
        <select
          className={SELECT_CLASS}
          value={draft.method}
          onChange={(e) => set("method", e.target.value)}
          aria-label="Filter by method"
        >
          <option value="">Any method</option>
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <Input
          value={draft.path}
          onChange={(e) => set("path", e.target.value)}
          placeholder="Path"
          aria-label="Filter by path"
        />
        <Input
          value={draft.statusCode}
          onChange={(e) => set("statusCode", e.target.value.replace(/\D/g, ""))}
          placeholder="Status"
          inputMode="numeric"
          aria-label="Filter by status code"
        />
        <Input
          value={draft.event}
          onChange={(e) => set("event", e.target.value)}
          placeholder="Event (e.g. auth.login)"
          aria-label="Filter by event"
        />
        <select
          className={SELECT_CLASS}
          value={draft.actorType}
          onChange={(e) => set("actorType", e.target.value)}
          aria-label="Filter access by actor type"
        >
          <option value="">Any actor</option>
          {["admin", "user", "service", "system"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          <Search className="mr-1 h-4 w-4" /> Filter
        </Button>
      </form>
      {query.isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Access logs" />
      ) : rows.length ? (
        <DataTable
          columns={columns}
          data={rows}
          {...(meta ? { meta } : {})}
          onPageChange={setPage}
          getRowId={(log) => String(log._id)}
        />
      ) : (
        <EmptyState title="No access events" />
      )}
    </div>
  );
}

/**
 * Sign-in attempt trail (every attempt, successful or not, with email, ip
 * and reason). The audit trail keeps failed logins de-duplicated per window;
 * this is the per-attempt record.
 */
export function LoginAttemptList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.ACCESS_LOGS_VIEW);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<LoginAttemptFilters>(EMPTY_LOGIN_ATTEMPT_FILTERS);
  const [applied, setApplied] = useState<LoginAttemptFilters>(EMPTY_LOGIN_ATTEMPT_FILTERS);
  const query = useQuery({
    queryKey: ["admin", "login-attempts", applied, page],
    queryFn: () => adminApi.listLoginAttempts({ ...toLoginAttemptQuery(applied), page, limit: 25 }),
    enabled: canView,
  });
  if (!canView) return null;

  const rows = (query.data?.data ?? []) as Array<adminApi.LoginAttempt & Record<string, unknown>>;
  const meta = query.data?.meta as PaginationMeta | undefined;
  const columns: Column<adminApi.LoginAttempt & Record<string, unknown>>[] = [
    {
      key: "occurredAt",
      header: "Time",
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDate(row.occurredAt)}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => <span className="break-all">{row.email}</span>,
    },
    { key: "actorType", header: "Portal", render: (row) => <span>{row.actorType}</span> },
    {
      key: "success",
      header: "Outcome",
      render: (row) =>
        row.success ? (
          <Badge variant="secondary">success</Badge>
        ) : (
          <Badge variant="destructive">failure</Badge>
        ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (row) => <code className="text-xs">{row.reason}</code>,
    },
    {
      key: "tenantId",
      header: "Tenant",
      render: (row) => <span className="font-mono text-xs">{row.tenantId ?? "platform"}</span>,
    },
    { key: "ip", header: "IP", render: (row) => <span className="text-xs">{row.ip || "—"}</span> },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign-in attempts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
            setPage(1);
          }}
        >
          <Input
            value={draft.email}
            onChange={(e) => setDraft((current) => ({ ...current, email: e.target.value }))}
            placeholder="Email"
            aria-label="Filter sign-in attempts by email"
          />
          <Input
            value={draft.ip}
            onChange={(e) => setDraft((current) => ({ ...current, ip: e.target.value }))}
            placeholder="IP address"
            aria-label="Filter sign-in attempts by ip"
          />
          <select
            className={SELECT_CLASS}
            value={draft.outcome}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                outcome: e.target.value as LoginAttemptFilters["outcome"],
              }))
            }
            aria-label="Filter sign-in attempts by outcome"
          >
            <option value="">Any outcome</option>
            <option value="success">success</option>
            <option value="failure">failure</option>
          </select>
          <select
            className={SELECT_CLASS}
            value={draft.actorType}
            onChange={(e) =>
              setDraft((current) => ({
                ...current,
                actorType: e.target.value as LoginAttemptFilters["actorType"],
              }))
            }
            aria-label="Filter sign-in attempts by portal"
          >
            <option value="">Any portal</option>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <Button type="submit" variant="outline">
            <Search className="mr-1 h-4 w-4" /> Filter attempts
          </Button>
        </form>
        {query.isLoading ? (
          <TableSkeleton rows={4} cols={6} />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => query.refetch()}
            resource="Sign-in attempts"
          />
        ) : rows.length ? (
          <DataTable
            columns={columns}
            data={rows}
            {...(meta ? { meta } : {})}
            onPageChange={setPage}
            getRowId={(row) => String(row._id)}
          />
        ) : (
          <EmptyState title="No sign-in attempts" description="Nothing matches these filters." />
        )}
      </CardContent>
    </Card>
  );
}
