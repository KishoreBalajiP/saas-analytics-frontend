import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { XCircle } from "lucide-react";
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
import { AppLink } from "@/components/common/AppLink";
import * as billingApi from "@/features/billing/api";
import type { SubscriptionSummary } from "@/features/billing/api";
import { BillingHistory } from "@/features/billing/components/BillingHistory";
import { PricingPlans } from "@/features/billing/components/PricingPlans";
import { SubscriptionBanner } from "@/features/billing/components/SubscriptionBanner";
import { UsagePanel } from "@/features/billing/components/UsagePanel";
import { FEATURE_LABELS } from "@/lib/api/quota";

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
  const downgrade = useMutation({
    mutationFn: (planId: string) => billingApi.changePlan(tenantId, { planId }),
    onSuccess: (result) => {
      toast.success(
        result.scheduledChange ? "Plan change scheduled for the end of the term" : "Plan changed",
      );
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to change plan"),
  });
  const reactivate = useMutation({
    mutationFn: () => billingApi.reactivateSubscription(tenantId),
    onSuccess: () => {
      toast.success("Subscription reactivated");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to reactivate"),
  });

  if (subscription.isLoading || entitlements.isLoading) {
    return <TableSkeleton rows={4} cols={2} />;
  }
  if (subscription.isError) {
    return (
      <ErrorState
        error={subscription.error}
        onRetry={() => {
          void subscription.refetch();
          void entitlements.refetch();
        }}
        resource="Subscription"
      />
    );
  }
  const sub = subscription.data;
  const ent = entitlements.data;
  if (!sub || !ent) {
    return <EmptyState title="No billing data" description="No subscription yet." />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current plan</span>
            <Badge variant={STATE_BADGE[sub.access?.state ?? sub.state]}>
              {STATE_LABELS[sub.access?.state ?? sub.state]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold">
            {ent.plan.displayName}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({ent.plan.code})
            </span>
          </div>
          {sub.planId !== "free" && (
            <p className="text-muted-foreground text-sm" data-testid="period-end">
              {sub.billingInterval === "year" ? "Annual" : "Monthly"} prepaid term · ends{" "}
              {date(sub.currentPeriodEnd)}
            </p>
          )}
          <SubscriptionBanner subscription={sub} />
          {ent.writeBlocked && (
            <p className="flex items-center gap-1 text-sm text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              New changes are blocked until the subscription is restored.
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm">
              <AppLink to="/pricing">
                {sub.planId === "free" ? "Upgrade" : "Renew or change plan"}
              </AppLink>
            </Button>
            {sub.state === "canceled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => reactivate.mutate()}
                disabled={reactivate.isPending}
              >
                Undo cancellation
              </Button>
            )}
            {sub.planId !== "free" &&
              !sub.scheduledChange &&
              (sub.state === "active" || sub.state === "trialing") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downgrade.mutate("free")}
                  disabled={downgrade.isPending}
                >
                  Move to free at term end
                </Button>
              )}
            {sub.scheduledChange?.source === "workspace" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => downgrade.mutate(sub.planId)}
                disabled={downgrade.isPending}
              >
                Keep current plan
              </Button>
            )}
            {sub.planId !== "free" &&
            (sub.state === "active" || sub.state === "trialing" || sub.state === "past_due") ? (
              <CancelDialog
                onConfirm={(immediate) => cancel.mutate(immediate)}
                pending={cancel.isPending}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <UsagePanel tenantId={tenantId} />

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
                <span className="text-sm">{FEATURE_LABELS[feature] ?? feature}</span>
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
          <CardTitle>Billing history</CardTitle>
        </CardHeader>
        <CardContent>
          <BillingHistory tenantId={tenantId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <PricingPlans tenantId={tenantId} currentPlanId={sub.planId} />
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
            The subscription ends immediately or at the end of the prepaid term. After it ends the
            workspace becomes read-only. Customer data is never deleted by a cancellation.
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
