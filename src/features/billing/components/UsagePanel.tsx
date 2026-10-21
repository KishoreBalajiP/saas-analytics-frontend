import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Infinity as InfinityIcon,
  MinusCircle,
  XCircle,
} from "lucide-react";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as billingApi from "@/features/billing/api";
import type { UsageMetric, UsageStatus, UsageSummary } from "@/features/billing/api";
import { metricTitle } from "@/lib/api/quota";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Display order; metrics the backend adds later are appended. */
const METRIC_ORDER = [
  "members",
  "connectors",
  "dashboards",
  "reports",
  "scheduledReports",
  "alerts",
  "storedRows",
  "apiCallsPerDay",
];

const STATUS_LABEL: Record<UsageStatus, string> = {
  ok: "OK",
  warning: "Near limit",
  at_limit: "At limit",
  over_limit: "Over limit",
  not_included: "Not included",
  unlimited: "Unlimited",
};

const STATUS_BADGE: Record<UsageStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "secondary",
  warning: "outline",
  at_limit: "destructive",
  over_limit: "destructive",
  not_included: "secondary",
  unlimited: "secondary",
};

const BAR_CLASS: Record<UsageStatus, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  at_limit: "bg-destructive",
  over_limit: "bg-destructive",
  not_included: "bg-muted-foreground",
  unlimited: "bg-primary",
};

function fmt(value: number) {
  return value.toLocaleString("en-US");
}

/** Soft limits never block; show them in the warning colour, not as errors. */
function effectiveStatus(m: UsageMetric): UsageStatus {
  if ((m.status === "at_limit" || m.status === "over_limit") && !m.hard) return "warning";
  return m.status;
}

function StatusIcon({ status }: { status: UsageStatus }) {
  if (status === "at_limit" || status === "over_limit")
    return <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden />;
  if (status === "warning")
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />;
  if (status === "unlimited")
    return <InfinityIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
  if (status === "not_included")
    return <MinusCircle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />;
  return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />;
}

function resetText(resetsAt: string | null) {
  if (!resetsAt) return null;
  const at = new Date(resetsAt);
  if (Number.isNaN(at.getTime())) return null;
  return `Resets daily at ${at.toISOString().slice(11, 16)} UTC`;
}

function MetricTile({ metric, m }: { metric: string; m: UsageMetric }) {
  const status = effectiveStatus(m);
  const title = metricTitle(metric);
  const width = m.limit && m.limit > 0 ? Math.min(100, (m.current / m.limit) * 100) : 0;
  let detail: string | null = null;
  if (status === "not_included") detail = "Not included in your plan";
  else if (m.limit !== null && m.blocked)
    detail =
      m.period === "day"
        ? "Daily limit reached — calls are refused until the reset"
        : "Limit reached — new ones are blocked";
  else if (m.limit !== null && !m.hard && m.overLimit) detail = "Soft limit passed — still allowed";
  else if (m.remaining !== null) detail = `${fmt(m.remaining)} left`;
  return (
    <div className="rounded-md border p-3" data-testid={`usage-${metric}`} data-status={status}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs uppercase tracking-wide">{title}</div>
        <div className="flex items-center gap-1">
          <StatusIcon status={status} />
          <Badge variant={STATUS_BADGE[status]} className="text-[10px]">
            {STATUS_LABEL[status]}
          </Badge>
        </div>
      </div>
      <div className="mt-1 text-lg font-semibold">
        {fmt(m.current)}
        <span className="text-muted-foreground ml-1 text-sm font-normal">
          / {m.limit === null ? "Unlimited" : fmt(m.limit)}
          {m.limit !== null && !m.hard ? " (soft)" : ""}
        </span>
      </div>
      {m.limit !== null && m.limit > 0 && (
        <div
          className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded"
          role="progressbar"
          aria-label={`${title} usage`}
          aria-valuemin={0}
          aria-valuemax={m.limit}
          aria-valuenow={m.current}
        >
          <div className={cn("h-full", BAR_CLASS[status])} style={{ width: `${width}%` }} />
        </div>
      )}
      <div className="text-muted-foreground mt-1 flex flex-wrap justify-between gap-x-2 text-xs">
        {detail && <span>{detail}</span>}
        {m.period === "day" && resetText(m.resetsAt) && <span>{resetText(m.resetsAt)}</span>}
      </div>
    </div>
  );
}

/** Presentational usage grid: usage vs plan limits with warning states. */
export function UsageSummaryView({ usage }: { usage: UsageSummary }) {
  const metrics = [
    ...METRIC_ORDER.filter((m) => usage.usage[m]),
    ...Object.keys(usage.usage).filter((m) => !METRIC_ORDER.includes(m)),
  ];
  const threshold = Math.round((usage.warningThreshold ?? 0.8) * 100);
  const attention = metrics.filter((m) => {
    const s = effectiveStatus(usage.usage[m] as UsageMetric);
    return s === "warning" || s === "at_limit" || s === "over_limit";
  });
  // Metrics the plan does not include are shown on their tile, not as an alert.
  const blocked = metrics.filter((m) => {
    const metric = usage.usage[m] as UsageMetric;
    return metric.blocked && effectiveStatus(metric) !== "not_included";
  });
  // Resource counts free up when something is deleted; daily metered limits
  // (API calls) only free up at the reset.
  const blockedResources = blocked.filter((m) => usage.usage[m]?.period !== "day");
  const blockedDaily = blocked.filter((m) => usage.usage[m]?.period === "day");
  return (
    <div className="space-y-3">
      {attention.length > 0 && (
        <div
          role="status"
          data-testid="usage-attention"
          className={cn(
            "rounded-md border p-3 text-sm",
            blocked.length > 0
              ? "border-destructive/50 text-destructive"
              : "border-amber-300/70 bg-amber-50 text-amber-950",
          )}
        >
          {blocked.length > 0 ? (
            <>
              {blockedResources.length > 0 && (
                <p>
                  Limit reached for{" "}
                  {blockedResources.map((m) => metricTitle(m).toLowerCase()).join(", ")}. Free up
                  capacity or upgrade your plan to create more.
                </p>
              )}
              {blockedDaily.length > 0 && (
                <p>
                  Daily limit reached for{" "}
                  {blockedDaily.map((m) => metricTitle(m).toLowerCase()).join(", ")}. Calls are
                  refused until the reset at midnight UTC, or upgrade your plan.
                </p>
              )}
            </>
          ) : (
            <p>
              {attention.map((m) => metricTitle(m)).join(", ")}{" "}
              {attention.length === 1 ? "is" : "are"} at or above {threshold}% of the plan limit.
            </p>
          )}
        </div>
      )}
      {usage.writeBlocked && (
        <p className="text-sm text-destructive">
          Your subscription is "{usage.state}": new resources cannot be created until it is
          restored.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <MetricTile key={metric} metric={metric} m={usage.usage[metric] as UsageMetric} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Warnings start at {threshold}% of a limit. Daily API calls reset at midnight UTC.
      </p>
    </div>
  );
}

/** Usage card for the subscription page; loads and gates its own data. */
export function UsagePanel({ tenantId }: { tenantId: string }) {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.IAM_ENTITLEMENTS_VIEW);
  const usage = useQuery({
    queryKey: ["billing", "usage", tenantId],
    queryFn: () => billingApi.getUsage(tenantId),
    enabled: Boolean(tenantId) && canView,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {!canView ? (
          <ErrorState error={{ statusCode: 403 }} resource="Usage" />
        ) : usage.isLoading ? (
          <TableSkeleton rows={2} cols={2} />
        ) : usage.isError ? (
          <ErrorState error={usage.error} onRetry={() => usage.refetch()} resource="Usage" />
        ) : usage.data ? (
          <UsageSummaryView usage={usage.data} />
        ) : null}
      </CardContent>
    </Card>
  );
}
