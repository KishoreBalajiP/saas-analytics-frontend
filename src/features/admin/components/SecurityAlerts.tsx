import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getSecurityAlert,
  listDetectionRules,
  listSecurityAlerts,
  SECURITY_ALERT_SEVERITIES,
  statusCountsOf,
  triageSecurityAlert,
  type DetectionRule,
  type SecurityAlert,
  type SecurityAlertAction,
  type SecurityAlertDetail,
  type SecurityAlertSeverity,
  type SecurityAlertStatus,
} from "@/features/admin/api/securityAlerts";
import type { PaginationMeta } from "@/lib/api/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const QUERY_KEY = ["admin", "security-alerts"] as const;
const NOTE_MIN = 3;
const NOTE_MAX = 2000;

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

type Variant = "default" | "secondary" | "destructive" | "outline";

const SEVERITY_VARIANT: Record<SecurityAlertSeverity, Variant> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const STATUS_LABEL: Record<SecurityAlertStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  false_positive: "False positive",
  resolved: "Resolved",
};

function SeverityBadge({ severity }: { severity: SecurityAlertSeverity }) {
  return (
    <Badge variant={SEVERITY_VARIANT[severity] ?? "outline"} className="capitalize">
      {severity}
    </Badge>
  );
}

function StatusBadge({ status }: { status: SecurityAlertStatus }) {
  const variant: Variant =
    status === "open" ? "default" : status === "acknowledged" ? "secondary" : "outline";
  return <Badge variant={variant}>{STATUS_LABEL[status] ?? status}</Badge>;
}

function subjectText(alert: Pick<SecurityAlert, "subject">) {
  const { type, id, display } = alert.subject ?? {};
  return `${type ?? "subject"} ${display || id || ""}`.trim();
}

function countsText(counts: Record<string, unknown> | null | undefined) {
  if (!counts) return "—";
  return Object.entries(counts)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
}

/** The triage queue: alerts nobody has closed yet. */
const DEFAULT_STATUS = "open,acknowledged";

/** Status filter presets; "Active" is the triage queue. */
const STATUS_FILTERS: Array<{ label: string; value: string; counts: SecurityAlertStatus[] }> = [
  { label: "Active", value: DEFAULT_STATUS, counts: ["open", "acknowledged"] },
  { label: "Open", value: "open", counts: ["open"] },
  { label: "Acknowledged", value: "acknowledged", counts: ["acknowledged"] },
  { label: "False positive", value: "false_positive", counts: ["false_positive"] },
  { label: "Resolved", value: "resolved", counts: ["resolved"] },
  { label: "All", value: "", counts: ["open", "acknowledged", "false_positive", "resolved"] },
];

/**
 * Platform security alerts: triage queue with filters, alert evidence and
 * the acknowledge / false positive / resolve workflow, plus the detection
 * rule catalogue. Needs `security.alerts.view`; triage needs
 * `security.alerts.update`.
 */
export function SecurityAlertsView({ initialAlertId }: { initialAlertId?: string | undefined }) {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.SECURITY_ALERTS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.SECURITY_ALERTS_UPDATE);
  const [tab, setTab] = useState<"alerts" | "rules">("alerts");

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Security alerts" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Security alert views">
        <Button
          size="sm"
          variant={tab === "alerts" ? "default" : "outline"}
          aria-pressed={tab === "alerts"}
          onClick={() => setTab("alerts")}
        >
          Alerts
        </Button>
        <Button
          size="sm"
          variant={tab === "rules" ? "default" : "outline"}
          aria-pressed={tab === "rules"}
          onClick={() => setTab("rules")}
        >
          Detection rules
        </Button>
      </div>
      {tab === "alerts" ? (
        <AlertsPanel canUpdate={canUpdate} initialAlertId={initialAlertId} />
      ) : (
        <RulesPanel />
      )}
    </div>
  );
}

function AlertsPanel({
  canUpdate,
  initialAlertId,
}: {
  canUpdate: boolean;
  initialAlertId?: string | undefined;
}) {
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [severity, setSeverity] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(initialAlertId ?? null);

  const alerts = useQuery({
    queryKey: [...QUERY_KEY, "list", status, severity, search, page],
    queryFn: () =>
      listSecurityAlerts({
        status: status || undefined,
        severity: severity || undefined,
        search: search || undefined,
        page,
        limit: 20,
      }),
  });
  const counts = statusCountsOf(alerts.data?.meta);

  const columns: Column<SecurityAlert & Record<string, unknown>>[] = [
    { key: "severity", header: "Severity", render: (a) => <SeverityBadge severity={a.severity} /> },
    {
      key: "title",
      header: "Alert",
      render: (a) => (
        <div className="min-w-0">
          <p className="font-medium">{a.title}</p>
          <p className="truncate text-xs text-muted-foreground">{subjectText(a)}</p>
        </div>
      ),
    },
    {
      key: "ruleId",
      header: "Rule",
      render: (a) => (
        <code className="text-xs">
          {a.ruleId} v{a.ruleVersion}
        </code>
      ),
    },
    { key: "tenantId", header: "Tenant", render: (a) => a.tenantId ?? "Platform" },
    { key: "lastSeenAt", header: "Last seen", render: (a) => date(a.lastSeenAt) },
    { key: "occurrences", header: "Seen", render: (a) => `${a.occurrences}×` },
    { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
    { key: "owner", header: "Owner", render: (a) => a.owner?.display ?? a.owner?.id ?? "—" },
    {
      key: "actions",
      header: "",
      render: (a) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`View alert ${a.title}`}
          onClick={() => setSelected(a.id)}
        >
          View
        </Button>
      ),
    },
  ];

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Security alerts</CardTitle>
            <Button variant="outline" size="sm" onClick={() => void alerts.refetch()}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter alerts by status">
            {STATUS_FILTERS.map((filter) => {
              const total = filter.counts.reduce((sum, key) => sum + counts[key], 0);
              return (
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
                  {alerts.data ? <span className="ml-1 text-xs opacity-70">({total})</span> : null}
                </Button>
              );
            })}
          </div>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onSearch}>
            <div className="space-y-1">
              <Label htmlFor="security-alert-severity">Severity</Label>
              <select
                id="security-alert-severity"
                className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                value={severity}
                onChange={(e) => {
                  setSeverity(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All severities</option>
                {SECURITY_ALERT_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-56 flex-1 space-y-1">
              <Label htmlFor="security-alert-search">Search</Label>
              <Input
                id="security-alert-search"
                value={searchInput}
                maxLength={100}
                placeholder="Title, IP, admin, key…"
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Search
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {alerts.isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : alerts.isError ? (
            <ErrorState
              error={alerts.error}
              onRetry={() => alerts.refetch()}
              resource="Security alerts"
            />
          ) : (alerts.data?.data.length ?? 0) === 0 ? (
            <EmptyState
              icon={<ShieldAlert className="h-8 w-8" />}
              title="No security alerts"
              description="Nothing matches these filters. The detector checks the platform every few minutes."
            />
          ) : (
            <DataTable
              columns={columns}
              data={(alerts.data?.data ?? []) as (SecurityAlert & Record<string, unknown>)[]}
              meta={alerts.data?.meta as PaginationMeta | undefined}
              onPageChange={setPage}
              getRowId={(a) => String(a.id)}
            />
          )}
        </CardContent>
      </Card>

      {selected ? (
        <AlertDetail alertId={selected} canUpdate={canUpdate} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function AlertDetail({
  alertId,
  canUpdate,
  onClose,
}: {
  alertId: string;
  canUpdate: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [note, setNote] = useState("");
  const detail = useQuery({
    queryKey: [...QUERY_KEY, "detail", alertId],
    queryFn: () => getSecurityAlert(alertId),
  });

  const triage = useMutation({
    mutationFn: ({ action }: { action: SecurityAlertAction }) =>
      triageSecurityAlert(alertId, action, note),
    onSuccess: (alert) => {
      toast.success(`Alert ${STATUS_LABEL[alert.status].toLowerCase()}`);
      setNote("");
      client.setQueryData([...QUERY_KEY, "detail", alertId], alert);
      void client.invalidateQueries({ queryKey: [...QUERY_KEY, "list"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update the alert");
      void client.invalidateQueries({ queryKey: [...QUERY_KEY, "detail", alertId] });
    },
  });

  if (detail.isLoading) return <TableSkeleton rows={4} cols={2} />;
  if (detail.isError)
    return (
      <ErrorState error={detail.error} onRetry={() => detail.refetch()} resource="Security alert" />
    );
  const alert = detail.data as SecurityAlertDetail | undefined;
  if (!alert) return null;
  const active = alert.status === "open" || alert.status === "acknowledged";
  const noteOk = note.trim().length >= NOTE_MIN;

  return (
    <Card aria-label="Security alert detail">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{alert.title}</CardTitle>
            <CardDescription>{alert.summary}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={alert.status} />
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Rule">
            <code className="text-xs">
              {alert.ruleId} v{alert.ruleVersion}
            </code>
          </Field>
          <Field label="Subject">{subjectText(alert)}</Field>
          <Field label="Tenant">{alert.tenantId ?? "Platform"}</Field>
          <Field label="First seen">{date(alert.firstSeenAt)}</Field>
          <Field label="Last seen">{date(alert.lastSeenAt)}</Field>
          <Field label="Occurrences">{alert.occurrences}</Field>
          <Field label="Owner">{alert.owner?.display ?? alert.owner?.id ?? "Unassigned"}</Field>
          <Field label="Notified">{date(alert.notifiedAt)}</Field>
          {alert.resolutionNote ? (
            <Field label="Resolution note">{alert.resolutionNote}</Field>
          ) : null}
        </dl>

        <section className="space-y-2">
          <h3 className="font-semibold">Evidence</h3>
          <p>Counts: {countsText(alert.evidence?.counts)}</p>
          {alert.evidence?.details ? (
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(alert.evidence.details, null, 2)}
            </pre>
          ) : null}
          {alert.evidence?.refs?.length ? (
            <ul className="space-y-1" aria-label="Evidence references">
              {alert.evidence.refs.map((ref, index) => (
                <li key={`${ref.source}-${ref.id ?? index}`} className="flex flex-wrap gap-2">
                  <Badge variant="outline">{ref.source}</Badge>
                  <code className="text-xs">{ref.id ?? "—"}</code>
                  <span className="text-muted-foreground">{date(ref.at)}</span>
                  <span>{ref.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No evidence references.</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">History</h3>
          <ul className="space-y-1" aria-label="Alert history">
            {alert.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="text-muted-foreground">{date(entry.at)}</span>{" "}
                <span className="font-medium capitalize">{entry.action.replace("_", " ")}</span>
                {entry.by?.display || entry.by?.id ? ` by ${entry.by.display ?? entry.by.id}` : ""}
                {entry.note ? ` — ${entry.note}` : ""}
              </li>
            ))}
          </ul>
          {alert.notifications.length ? (
            <p className="text-muted-foreground">
              Notifications:{" "}
              {alert.notifications
                .map((n) => `${n.channel} ${n.status}${n.code ? ` (${n.code})` : ""}`)
                .join(", ")}
            </p>
          ) : null}
        </section>

        {active && canUpdate ? (
          <section className="space-y-3" aria-label="Triage">
            <div className="space-y-1">
              <Label htmlFor="security-alert-note">Note</Label>
              <Textarea
                id="security-alert-note"
                value={note}
                maxLength={NOTE_MAX}
                placeholder="What did you find? Required to close the alert."
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {alert.status === "open" ? (
                <Button
                  size="sm"
                  disabled={triage.isPending}
                  onClick={() => triage.mutate({ action: "acknowledge" })}
                >
                  Acknowledge
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={triage.isPending || !noteOk}
                onClick={() => triage.mutate({ action: "false-positive" })}
              >
                Mark false positive
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={triage.isPending || !noteOk}
                onClick={() => triage.mutate({ action: "resolve" })}
              >
                Resolve
              </Button>
            </div>
          </section>
        ) : active ? (
          <p className="text-muted-foreground">
            Triage needs the security.alerts.update permission.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function thresholdsText(rule: DetectionRule) {
  return Object.entries(rule.config)
    .filter(([key]) => key !== "enabled")
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("|") : String(value)}`)
    .join(", ");
}

function RulesPanel() {
  const rules = useQuery({ queryKey: [...QUERY_KEY, "rules"], queryFn: listDetectionRules });
  const columns: Column<DetectionRule & Record<string, unknown>>[] = [
    {
      key: "title",
      header: "Rule",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium">{r.title}</p>
          <code className="text-xs text-muted-foreground">
            {r.id} v{r.version}
          </code>
        </div>
      ),
    },
    { key: "severity", header: "Severity", render: (r) => <SeverityBadge severity={r.severity} /> },
    {
      key: "enabled",
      header: "State",
      render: (r) =>
        r.enabled ? <Badge>Enabled</Badge> : <Badge variant="outline">Disabled</Badge>,
    },
    {
      key: "config",
      header: "Thresholds",
      render: (r) => <span className="text-xs">{thresholdsText(r) || "—"}</span>,
    },
    { key: "watermark", header: "Evaluated up to", render: (r) => date(r.watermark) },
    {
      key: "lastError",
      header: "Last error",
      render: (r) =>
        r.lastError ? (
          <span className="text-destructive">{r.lastError}</span>
        ) : r.ignoredOverrides.length ? (
          <span className="text-warning">{r.ignoredOverrides.length} ignored override(s)</span>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Detection rules</CardTitle>
        <CardDescription>
          Versioned rules evaluated by the detector job. Thresholds come from code defaults,
          SECURITY_DETECTION_RULES_JSON and the platform setting security.detection.rules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rules.isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : rules.isError ? (
          <ErrorState
            error={rules.error}
            onRetry={() => rules.refetch()}
            resource="Detection rules"
          />
        ) : (
          <DataTable
            columns={columns}
            data={(rules.data ?? []) as (DetectionRule & Record<string, unknown>)[]}
            getRowId={(r) => String(r.id)}
            emptyMessage="No detection rules."
          />
        )}
      </CardContent>
    </Card>
  );
}
