import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import * as billingApi from "@/features/billing/api";
import type { SubscriptionSummary } from "@/features/billing/api";

const USAGE_LABELS: Record<string, string> = {
  members: "Team members",
  connectors: "Connectors",
  dashboards: "Dashboards",
  reports: "Reports",
  alerts: "Alerts",
  scheduledReports: "Scheduled reports",
  storedRows: "Stored rows",
  apiCallsPerDay: "API calls / day",
};

const STATE_LABELS: Record<SubscriptionSummary["state"], string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Expired",
  restricted: "Restricted",
};

const STATE_BADGE: Record<
  SubscriptionSummary["state"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  trialing: "outline",
  active: "default",
  past_due: "destructive",
  canceled: "secondary",
  expired: "destructive",
  restricted: "destructive",
};

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function formatLimit(limit: { max: number; hard: boolean } | null | undefined) {
  if (!limit) return "Unlimited";
  if (limit.max === 0) return limit.hard ? "Blocked" : "0 (warning)";
  return `${limit.max}${limit.hard ? "" : " (soft)"}`;
}

export function BillingPanel({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const subscription = useQuery({
    queryKey: ["billing", "subscription", tenantId],
    queryFn: () => billingApi.getSubscription(tenantId),
    enabled: Boolean(tenantId),
  });
  const entitlements = useQuery({
    queryKey: ["billing", "entitlements", tenantId],
    queryFn: () => billingApi.getEntitlements(tenantId),
    enabled: Boolean(tenantId),
  });
  const usage = useQuery({
    queryKey: ["billing", "usage", tenantId],
    queryFn: () => billingApi.getUsage(tenantId),
    enabled: Boolean(tenantId),
  });
  const timeline = useQuery({
    queryKey: ["billing", "timeline", tenantId],
    queryFn: () => billingApi.getSubscriptionTimeline(tenantId, { limit: 10 }),
    enabled: Boolean(tenantId),
  });

  const cancel = useMutation({
    mutationFn: (immediate: boolean) =>
      billingApi.cancelSubscription(tenantId, { immediate, reason: "User-initiated cancel" }),
    onSuccess: () => {
      toast.success("Subscription canceled");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to cancel"),
  });
  const reactivate = useMutation({
    mutationFn: () => billingApi.reactivateSubscription(tenantId),
    onSuccess: () => {
      toast.success("Subscription reactivated");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to reactivate"),
  });

  if (subscription.isLoading || entitlements.isLoading || usage.isLoading) {
    return <TableSkeleton rows={4} cols={2} />;
  }
  if (subscription.isError) {
    return (
      <ErrorState
        error={subscription.error}
        onRetry={() => {
          void subscription.refetch();
          void entitlements.refetch();
          void usage.refetch();
        }}
        resource="Subscription"
      />
    );
  }
  const sub = subscription.data;
  const ent = entitlements.data;
  const use = usage.data;
  if (!sub || !ent || !use) {
    return <EmptyState title="No billing data" description="No subscription yet." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current plan</span>
            <Badge variant={STATE_BADGE[sub.state]}>{STATE_LABELS[sub.state]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold">
            {ent.plan.displayName}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({ent.plan.code})
            </span>
          </div>
          {sub.state === "trialing" && sub.trialEndsAt && (
            <p className="text-muted-foreground text-sm">Trial ends {date(sub.trialEndsAt)}</p>
          )}
          {sub.state === "past_due" && sub.graceEndsAt && (
            <p className="flex items-center gap-1 text-sm text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              Grace period ends {date(sub.graceEndsAt)}
            </p>
          )}
          {sub.cancelAtPeriodEnd && (
            <p className="text-muted-foreground text-sm">
              Cancellation takes effect on {date(sub.currentPeriodEnd)}.
            </p>
          )}
          {ent.writeBlocked && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              Subscription is in state "{sub.state}" — new writes are blocked.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            {sub.state !== "active" && sub.state !== "trialing" && (
              <Button size="sm" onClick={() => reactivate.mutate()} disabled={reactivate.isPending}>
                Reactivate
              </Button>
            )}
            {sub.state === "active" || sub.state === "trialing" || sub.state === "past_due" ? (
              <CancelDialog
                onConfirm={(immediate) => cancel.mutate(immediate)}
                pending={cancel.isPending}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(use.usage).map(([metric, raw]) => {
              const info = raw as { current: number; limit: number | null; hard: boolean };
              const limit = ent.limits[metric];
              const overLimit = limit && info.current > limit.max;
              const ratio = limit && limit.max > 0 ? info.current / limit.max : 0;
              return (
                <div key={metric} className="rounded-md border p-3" data-testid={`usage-${metric}`}>
                  <div className="flex items-center justify-between">
                    <div className="text-muted-foreground text-xs uppercase tracking-wide">
                      {USAGE_LABELS[metric] ?? metric}
                    </div>
                    {overLimit && limit?.hard ? (
                      <XCircle className="text-destructive h-3.5 w-3.5" />
                    ) : overLimit ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {info.current}
                    <span className="text-muted-foreground ml-1 text-sm font-normal">
                      / {formatLimit(limit)}
                    </span>
                  </div>
                  {limit && limit.max > 0 && (
                    <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded">
                      <div
                        className={
                          overLimit
                            ? limit.hard
                              ? "bg-destructive h-full"
                              : "bg-amber-500 h-full"
                            : "bg-primary h-full"
                        }
                        style={{ width: `${Math.min(100, ratio * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(ent.features).map(([feature, enabled]) => (
              <div
                key={feature}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <span className="text-sm">{feature}</span>
                {enabled ? (
                  <Badge variant="default">enabled</Badge>
                ) : (
                  <Badge variant="secondary">disabled</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.isLoading ? (
            <TableSkeleton rows={3} cols={2} />
          ) : timeline.isError ? (
            <ErrorState error={timeline.error} resource="Activity" />
          ) : (timeline.data ?? []).length === 0 ? (
            <EmptyState title="No activity yet" description="No subscription changes yet." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(timeline.data ?? []).map((entry) => (
                <li key={entry._id} className="border-b py-1 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span>{entry.type}</span>
                    <span className="text-muted-foreground text-xs">{date(entry.occurredAt)}</span>
                  </div>
                  {entry.reason && (
                    <div className="text-muted-foreground text-xs">{entry.reason}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upgrade</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Checkout is not yet available. To change plans, contact your platform administrator or
            use the in-product plan picker once a payment provider is configured.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CancelDialog({
  onConfirm,
  pending,
}: {
  onConfirm: (immediate: boolean) => void;
  pending: boolean;
}) {
  const [immediate, setImmediate] = useState(false);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          Cancel subscription
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
          <AlertDialogDescription>
            The subscription will be canceled immediately or at the end of the current period.
            Customer data is never deleted by a cancellation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={immediate}
            onChange={(e) => setImmediate(e.target.checked)}
          />
          Cancel immediately (otherwise the subscription remains active until the period end).
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep subscription</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(immediate)}>Confirm cancel</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
