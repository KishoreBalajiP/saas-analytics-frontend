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
import { featurePresentation } from "@/features/billing/featureCatalog";
import { formatMoney } from "@/features/billing/checkout";

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
    queryKey: ["billing", "timeline", tenantId, 1],
    queryFn: () => billingApi.getSubscriptionTimeline(tenantId, { page: 1, limit: 10 }),
    enabled: Boolean(tenantId),
  });
  const plans = useQuery({
    queryKey: ["billing", "plans", tenantId],
    queryFn: () => billingApi.listPlans(tenantId),
    enabled: Boolean(tenantId),
  });
  const transactions = useQuery({
    queryKey: ["billing", "transactions", tenantId, "pending"],
    queryFn: () => billingApi.listTransactions(tenantId, { limit: 10 }),
    enabled: Boolean(tenantId),
  });
  const pendingStatus = useMutation({
    mutationFn: (orderId: string) => billingApi.getCheckoutStatus(tenantId, orderId),
    onSuccess: (result) => {
      if (result.phase === "confirmed") toast.success("Payment confirmed");
      else toast.message(`Payment status: ${result.phase.replace(/_/g, " ")}`);
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Unable to check payment status"),
  });
  const abandonPending = useMutation({
    mutationFn: (orderId: string) => billingApi.cancelCheckout(tenantId, orderId),
    onSuccess: () => {
      toast.success("Pending checkout abandoned");
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Unable to abandon checkout"),
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

  if (subscription.isLoading || entitlements.isLoading || plans.isLoading) {
    return <TableSkeleton rows={4} cols={2} />;
  }
  if (subscription.isError || entitlements.isError) {
    return (
      <ErrorState
        error={subscription.error ?? entitlements.error}
        onRetry={() => {
          void subscription.refetch();
          void entitlements.refetch();
        }}
        resource="Subscription"
      />
    );
  }
  if (plans.isError) {
    return (
      <ErrorState
        error={plans.error}
        onRetry={() => void plans.refetch()}
        resource="Plan catalogue"
      />
    );
  }
  const sub = subscription.data;
  const ent = entitlements.data;
  if (!sub || !ent) {
    return <EmptyState title="No billing data" description="No subscription yet." />;
  }

  const currentPlan = plans.data?.plans.find((plan) => plan.code === ent.plan.code);
  const pending = (transactions.data?.data ?? []).find(
    (txn) =>
      txn.status === "pending" ||
      txn.status === "authorized" ||
      (txn.status === "captured" && !txn.applied),
  );
  const state = sub.access?.state ?? sub.state;
  const stateLabel = STATE_LABELS[state] ?? state;
  const allFeatureKeys = Array.from(
    new Set((plans.data?.plans ?? []).flatMap((plan) => Object.keys(plan.features))),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current plan</span>
            <Badge variant={STATE_BADGE[state]}>{stateLabel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-2xl font-semibold">
            {ent.plan.displayName}
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({ent.plan.code})
            </span>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <SummaryItem
              label="Billing interval"
              value={
                sub.billingInterval === "year"
                  ? "Annual"
                  : sub.planId === "free"
                    ? "No paid term"
                    : "Monthly"
              }
            />
            <SummaryItem
              label="Price"
              value={
                sub.planId === "free"
                  ? "Free"
                  : currentPlan
                    ? currentPlan.prices.find(
                        (p) => p.interval === (sub.billingInterval ?? "month"),
                      )
                      ? `${formatMoney(currentPlan.prices.find((p) => p.interval === (sub.billingInterval ?? "month"))!.amountMinor, currentPlan.prices.find((p) => p.interval === (sub.billingInterval ?? "month"))!.currency)} / ${sub.billingInterval === "year" ? "year" : "month"}`
                      : "Configured by catalogue"
                    : "Configured by catalogue"
              }
            />
            <SummaryItem label="Started" value={date(sub.currentPeriodStart)} />
            <SummaryItem
              label={state === "canceled" || state === "expired" ? "Expires" : "Term ends"}
              value={sub.planId === "free" ? "No expiration" : date(sub.currentPeriodEnd)}
            />
          </div>
          {pending && (
            <div
              className="rounded-lg border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-950"
              data-testid="pending-purchase"
            >
              <p className="font-medium">You have a payment awaiting confirmation.</p>
              <p className="text-xs">Plan selected: {pending.planId}</p>
              <p className="mt-1">
                Payment status: {pending.status === "captured" ? "Applying" : "Awaiting payment"}.
                Your current plan remains {ent.plan.displayName} until the server confirms and
                applies payment.
              </p>
              <p className="mt-1 text-xs">Reference: {pending.orderId}</p>
              {pending.status === "captured" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => pendingStatus.mutate(pending.orderId)}
                  disabled={pendingStatus.isPending}
                >
                  {pendingStatus.isPending ? "Checking…" : "Check payment status"}
                </Button>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs">Continue this order or choose another plan below.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abandonPending.mutate(pending.orderId)}
                    disabled={abandonPending.isPending}
                  >
                    {abandonPending.isPending ? "Abandoning…" : "Cancel pending order"}
                  </Button>
                </div>
              )}
            </div>
          )}
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
            {allFeatureKeys.map((feature) => {
              const presentation = featurePresentation(feature);
              const enabled = ent.features[feature] === true;
              const included = currentPlan?.features[feature] === true;
              return (
                <div
                  key={feature}
                  className="flex items-center justify-between rounded-md border p-2"
                >
                  <div>
                    <span className="text-sm">{presentation.label}</span>
                    <p className="text-muted-foreground text-xs">{presentation.description}</p>
                  </div>
                  {enabled ? (
                    <Badge variant="default">Available</Badge>
                  ) : included ? (
                    <Badge variant="outline">Included, not ready</Badge>
                  ) : (
                    <Badge variant="secondary">Not included</Badge>
                  )}
                </div>
              );
            })}
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
          ) : (timeline.data?.data ?? []).length === 0 ? (
            <EmptyState title="No activity yet" description="No subscription changes yet." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(timeline.data?.data ?? []).map((entry) => (
                <li key={entry._id} className="border-b py-1 last:border-b-0">
                  <div className="flex items-center justify-between">
                    <span>{activityLabel(entry.type, entry.toPlanId, entry.toState)}</span>
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
          <PricingPlans
            tenantId={tenantId}
            currentPlanId={sub.planId}
            pendingPlanId={pending?.planId ?? null}
            pendingStatus={pending?.status ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function activityLabel(type: string, plan: string | null, state: string | null) {
  if (type === "subscription.created") return `Subscription created${plan ? ` on ${plan}` : ""}`;
  if (type === "subscription.plan_changed") return `Plan changed${plan ? ` to ${plan}` : ""}`;
  if (type === "subscription.state_changed")
    return `Subscription status changed${state ? ` to ${state}` : ""}`;
  if (type === "subscription.payment_captured") return "Payment captured";
  if (type === "subscription.payment_failed") return "Payment failed";
  if (type === "subscription.payment_refunded") return "Payment refunded";
  return type
    .replace(/^subscription\./, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
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
