/**
 * Phase 6 - Platform Admin plan / subscription / entitlement management
 * components. Mounted under /admin/plans, /admin/subscriptions and
 * /admin/entitlements. The backend is the source of truth for
 * authorization; the components use the existing `Permissions`
 * catalogue as a UX gate.
 *
 * All mutations go through the admin billing API client. Failures
 * surface via the shared toast sink; success invalidates the relevant
 * React Query keys.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Power, PowerOff, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import {
  archivePlan,
  createOverride,
  disablePlan,
  enablePlan,
  ensureDefaultPlans,
  listAllOverrides,
  listPlans,
  listSubscriptions,
  listTenantOverrides,
  listTransactions,
  listWebhooks,
  revokeOverride,
  adminChangePlan,
  adminSetState,
  triggerReconcile,
} from "@/features/admin/api/billing";
import type { AdminSubscription, Override, Plan } from "@/features/admin/api/billing";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useAdminSession } from "@/lib/auth/session";

const STATE_LABELS: Record<AdminSubscription["state"], string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  expired: "Expired",
  restricted: "Restricted",
};

const STATE_BADGE: Record<
  AdminSubscription["state"],
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

export function AdminPlansView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.BILLING_PLANS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.BILLING_PLANS_UPDATE);
  const canArchive = hasPermission(permissions, Permissions.BILLING_PLANS_ARCHIVE);
  const canCreate = hasPermission(permissions, Permissions.BILLING_PLANS_CREATE);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const plans = useQuery({
    queryKey: ["admin", "plans", { search }],
    queryFn: () => listPlans({ search: search || undefined, limit: 100 }),
    enabled: canView,
  });

  const seed = useMutation({
    mutationFn: () => ensureDefaultPlans(),
    onSuccess: (res) => {
      toast.success(`Default plans ensured (${res.total} plans).`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to seed"),
  });

  const disable = useMutation({
    mutationFn: (id: string) => disablePlan(id),
    onSuccess: () => {
      toast.success("Plan disabled");
      void queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to disable"),
  });
  const enable = useMutation({
    mutationFn: (id: string) => enablePlan(id),
    onSuccess: () => {
      toast.success("Plan enabled");
      void queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to enable"),
  });
  const archive = useMutation({
    mutationFn: (id: string) => archivePlan(id),
    onSuccess: () => {
      toast.success("Plan archived");
      void queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to archive"),
  });

  if (!canView) {
    return <ErrorState error={{ statusCode: 403 }} resource="Plans" />;
  }
  if (plans.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (plans.isError) {
    return <ErrorState error={plans.error} onRetry={() => plans.refetch()} resource="Plans" />;
  }
  const items = plans.data ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search plans…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canCreate ? (
          <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
            {seed.isPending ? "Seeding…" : "Ensure defaults"}
          </Button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="No plans in the catalogue. Click 'Ensure defaults' to seed the four reference plans."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
          {items.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              canUpdate={canUpdate}
              canArchive={canArchive}
              onDisable={() => disable.mutate(plan.id)}
              onEnable={() => enable.mutate(plan.id)}
              onArchive={() => archive.mutate(plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  canUpdate,
  canArchive,
  onDisable,
  onEnable,
  onArchive,
}: {
  plan: Plan;
  canUpdate: boolean;
  canArchive: boolean;
  onDisable: () => void;
  onEnable: () => void;
  onArchive: () => void;
}) {
  const limitCount = Object.keys(plan.data.limits ?? {}).length;
  const featureCount = Object.values(plan.data.features ?? {}).filter(Boolean).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {plan.data.displayName ?? plan.name}
            <span className="text-muted-foreground ml-2 text-sm font-normal">({plan.code})</span>
          </span>
          <Badge
            variant={
              plan.data.status === "active"
                ? "default"
                : plan.data.status === "disabled"
                  ? "secondary"
                  : "destructive"
            }
          >
            {plan.data.status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-sm">{plan.data.description ?? plan.description}</p>
        <p className="text-muted-foreground text-xs">
          {featureCount} features · {limitCount} limits · tier {plan.data.tier}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {canUpdate && plan.data.status === "active" ? (
            <Button size="sm" variant="outline" onClick={onDisable}>
              <PowerOff className="mr-1 h-3.5 w-3.5" /> Disable
            </Button>
          ) : null}
          {canUpdate && plan.data.status === "disabled" ? (
            <Button size="sm" variant="outline" onClick={onEnable}>
              <Power className="mr-1 h-3.5 w-3.5" /> Enable
            </Button>
          ) : null}
          {canArchive && plan.data.status !== "archived" ? (
            <ArchiveDialog onConfirm={onArchive} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ArchiveDialog({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Archive className="mr-1 h-3.5 w-3.5" /> Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive plan?</AlertDialogTitle>
          <AlertDialogDescription>
            Archived plans are no longer offered to tenants but existing subscriptions on this plan
            are not affected. The action is reversible only by editing the plan directly.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep plan</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminSubscriptionsView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.BILLING_SUBSCRIPTIONS_VIEW);
  const canOverride = hasPermission(permissions, Permissions.BILLING_SUBSCRIPTIONS_OVERRIDE);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const subscriptions = useQuery({
    queryKey: ["admin", "subscriptions", { search }],
    queryFn: () => listSubscriptions({ search: search || undefined, limit: 50 }),
    enabled: canView,
  });

  const reconcile = useMutation({
    mutationFn: () => triggerReconcile({ limit: 25 }),
    onSuccess: (res) => {
      toast.success(
        `Reconcile complete: ${res.checked} checked, ${res.captured} captured, ${res.skipped} skipped, ${res.stale} stale, ${res.errors} errors.`,
      );
    },
    onError: (err: Error) => toast.error(err.message ?? "Reconciliation failed"),
  });

  if (!canView) {
    return <ErrorState error={{ statusCode: 403 }} resource="Subscriptions" />;
  }
  if (subscriptions.isLoading) return <TableSkeleton rows={6} cols={4} />;
  if (subscriptions.isError) {
    return (
      <ErrorState
        error={subscriptions.error}
        onRetry={() => subscriptions.refetch()}
        resource="Subscriptions"
      />
    );
  }
  const items = subscriptions.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search subscriptions…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canOverride && (
          <Button
            size="sm"
            variant="outline"
            disabled={reconcile.isPending}
            onClick={() => reconcile.mutate()}
          >
            {reconcile.isPending ? "Reconciling…" : "Run reconciliation"}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState title="No subscriptions" description="No tenant subscriptions yet." />
      ) : (
        <div className="space-y-3">
          {items.map((sub) => (
            <SubscriptionRow
              key={sub.id}
              sub={sub}
              canOverride={canOverride}
              onChanged={() =>
                queryClient.invalidateQueries({ queryKey: ["admin", "subscriptions"] })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionRow({
  sub,
  canOverride,
  onChanged,
}: {
  sub: AdminSubscription;
  canOverride: boolean;
  onChanged: () => void;
}) {
  const changePlan = useMutation({
    mutationFn: (planId: string) =>
      adminChangePlan(sub.tenantId, { planId, reason: "Admin change" }),
    onSuccess: () => {
      toast.success("Plan changed");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to change plan"),
  });
  const setState = useMutation({
    mutationFn: (vars: { state: AdminSubscription["state"]; reason: string }) =>
      adminSetState(sub.tenantId, vars),
    onSuccess: () => {
      toast.success("Subscription state updated");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to update state"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            Tenant <code className="text-xs">{sub.tenantId}</code>
          </span>
          <Badge variant={STATE_BADGE[sub.state]}>{STATE_LABELS[sub.state]}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-muted-foreground grid grid-cols-2 gap-x-4 text-sm md:grid-cols-4">
          <div>
            <div className="text-xs uppercase tracking-wide">Plan</div>
            <div className="font-medium">{sub.planId}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide">Period</div>
            <div className="font-medium">
              {date(sub.currentPeriodStart)} – {date(sub.currentPeriodEnd)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide">Trial ends</div>
            <div className="font-medium">{date(sub.trialEndsAt)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide">Grace</div>
            <div className="font-medium">{date(sub.graceEndsAt)}</div>
          </div>
        </div>
        {(sub.paymentProvider || sub.paymentReference) && (
          <div className="grid grid-cols-2 gap-x-4 rounded-md border p-2 text-sm md:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wide">Provider</div>
              <div className="font-medium">{sub.paymentProvider ?? "—"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground text-xs uppercase tracking-wide">
                Provider reference
              </div>
              <div className="font-mono text-xs">{sub.paymentReference ?? "—"}</div>
            </div>
          </div>
        )}
        {canOverride ? (
          <div className="flex flex-wrap gap-2 pt-1">
            <PlanPicker
              currentPlanId={sub.planId}
              onSelect={(planId) => changePlan.mutate(planId)}
              pending={changePlan.isPending}
            />
            <SetStateButton
              sub={sub}
              onSelect={(state, reason) => setState.mutate({ state, reason })}
              pending={setState.isPending}
            />
          </div>
        ) : null}
        <PaymentHistory tenantId={sub.tenantId} />
      </CardContent>
    </Card>
  );
}

function PaymentHistory({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const transactions = useQuery({
    queryKey: ["admin", "transactions", tenantId],
    queryFn: () => listTransactions(tenantId, { limit: 20 }),
    enabled: open,
  });
  const webhooks = useQuery({
    queryKey: ["admin", "webhooks", tenantId],
    queryFn: () => listWebhooks(tenantId, { limit: 20 }),
    enabled: open,
  });
  return (
    <div className="pt-1">
      <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide payment activity" : "Show payment activity"}
      </Button>
      {open && (
        <div className="mt-2 space-y-3 text-sm">
          {transactions.isLoading ? (
            <TableSkeleton rows={2} cols={3} />
          ) : (transactions.data ?? []).length === 0 ? (
            <p className="text-muted-foreground">No payment transactions.</p>
          ) : (
            <ul className="space-y-1">
              {(transactions.data ?? []).map((t) => (
                <li
                  key={t._id}
                  className="flex flex-wrap items-center gap-2 border-b py-1 last:border-b-0"
                >
                  <Badge
                    variant={
                      t.status === "captured"
                        ? "default"
                        : t.status === "pending"
                          ? "outline"
                          : "destructive"
                    }
                  >
                    {t.status}
                  </Badge>
                  <code className="text-xs">{t.providerOrderId}</code>
                  <span className="text-muted-foreground text-xs">
                    {(t.amountMinor / 100).toFixed(2)} {t.currency} · {t.planId}
                  </span>
                  {t.failureReason && (
                    <span className="text-xs text-destructive">{t.failureReason}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {webhooks.data && webhooks.data.length > 0 && (
            <ul className="space-y-1">
              {(webhooks.data ?? []).map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center gap-2 border-b py-1 text-xs last:border-b-0"
                >
                  <span className="font-mono">{w.eventType}</span>
                  {w.processed ? (
                    <Badge variant="secondary">processed</Badge>
                  ) : (
                    <Badge variant="destructive">unprocessed</Badge>
                  )}
                  {w.error && <span className="text-destructive">{w.error}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PlanPicker({
  currentPlanId,
  onSelect,
  pending,
}: {
  currentPlanId: string;
  onSelect: (planId: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(currentPlanId);
  const [reason, setReason] = useState("");
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          Change plan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change plan</AlertDialogTitle>
          <AlertDialogDescription>
            Select the new plan and provide a reason. The change is audit-logged and the new period
            starts immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="plan-id">Plan code</Label>
          <Input
            id="plan-id"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            placeholder="e.g. pro"
          />
          <Label htmlFor="plan-reason">Reason</Label>
          <Textarea
            id="plan-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!reason.trim() || !planId.trim()) return;
              onSelect(planId);
              setOpen(false);
            }}
          >
            Confirm change
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SetStateButton({
  sub,
  onSelect,
  pending,
}: {
  sub: AdminSubscription;
  onSelect: (state: AdminSubscription["state"], reason: string) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AdminSubscription["state"]>("restricted");
  const [reason, setReason] = useState("");
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          Set state
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Set subscription state</AlertDialogTitle>
          <AlertDialogDescription>
            Current state: <strong>{sub.state}</strong>. Administrative state changes are recorded
            with the reason you provide.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="set-state">New state</Label>
          <select
            id="set-state"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={state}
            onChange={(e) => setState(e.target.value as AdminSubscription["state"])}
          >
            {(["trialing", "active", "past_due", "canceled", "expired", "restricted"] as const).map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <Label htmlFor="set-state-reason">Reason</Label>
          <Textarea
            id="set-state-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (!reason.trim()) return;
              onSelect(state, reason);
              setOpen(false);
            }}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminOverridesView() {
  const { permissions } = useAdminSession();
  const canOverride = hasPermission(permissions, Permissions.BILLING_ENTITLEMENTS_OVERRIDE);
  const queryClient = useQueryClient();
  const [includeRevoked, setIncludeRevoked] = useState(false);

  const overrides = useQuery({
    queryKey: ["admin", "overrides", { includeRevoked }],
    queryFn: () => listAllOverrides({ includeRevoked, limit: 100 }),
    enabled: canOverride,
  });

  if (!canOverride) {
    return <ErrorState error={{ statusCode: 403 }} resource="Entitlement overrides" />;
  }
  if (overrides.isLoading) return <TableSkeleton rows={6} cols={3} />;
  if (overrides.isError) {
    return (
      <ErrorState
        error={overrides.error}
        onRetry={() => overrides.refetch()}
        resource="Overrides"
      />
    );
  }
  const items = overrides.data ?? [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeRevoked}
            onChange={(e) => setIncludeRevoked(e.target.checked)}
          />
          Include revoked overrides
        </label>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No overrides" description="No tenant has an override yet." />
      ) : (
        <div className="space-y-3">
          {items.map((o) => (
            <OverrideRow
              key={o.id}
              override={o}
              onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "overrides"] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OverrideRow({ override, onChanged }: { override: Override; onChanged: () => void }) {
  const revoke = useMutation({
    mutationFn: () => revokeOverride(override.id, { reason: "Admin revoke" }),
    onSuccess: () => {
      toast.success("Override revoked");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to revoke"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {override.kind} · {override.metric ?? "(global)"}
          </span>
          {override.revokedAt ? (
            <Badge variant="secondary">revoked</Badge>
          ) : (
            <Badge variant="default">active</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">Tenant: </span>
          <code>{override.tenantId}</code>
        </div>
        <div>
          <span className="text-muted-foreground">Reason: </span>
          {override.reason}
        </div>
        <div>
          <span className="text-muted-foreground">Value: </span>
          <code className="text-xs">{JSON.stringify(override.value)}</code>
        </div>
        <div>
          <span className="text-muted-foreground">Granted by: </span>
          {override.grantedBy}
        </div>
        {!override.revokedAt ? (
          <Button size="sm" variant="outline" onClick={() => revoke.mutate()}>
            Revoke
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminCreateOverrideView({ tenantId }: { tenantId: string }) {
  const { permissions } = useAdminSession();
  const canOverride = hasPermission(permissions, Permissions.BILLING_ENTITLEMENTS_OVERRIDE);
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"feature" | "limit">("feature");
  const [metric, setMetric] = useState("");
  const [value, setValue] = useState("true");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const create = useMutation({
    mutationFn: () => {
      const parsedValue =
        kind === "feature"
          ? value === "true"
          : (() => {
              try {
                return JSON.parse(value);
              } catch {
                throw new Error('Limit value must be a JSON object like {"max":5,"hard":true}');
              }
            })();
      return createOverride(tenantId, {
        kind,
        metric: metric || undefined,
        value: parsedValue,
        reason,
        expiresAt: expiresAt || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Override created");
      setMetric("");
      setValue("true");
      setReason("");
      setExpiresAt("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "overrides"] });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "overrides", tenantId],
      });
    },
    onError: (err: Error) => toast.error(err.message ?? "Failed to create"),
  });

  if (!canOverride) {
    return <ErrorState error={{ statusCode: 403 }} resource="Entitlement overrides" />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create override for tenant {tenantId}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="kind">Kind</Label>
          <select
            id="kind"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as "feature" | "limit")}
          >
            <option value="feature">feature</option>
            <option value="limit">limit</option>
          </select>
        </div>
        <div>
          <Label htmlFor="metric">Metric / feature</Label>
          <Input
            id="metric"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            placeholder="e.g. embed (feature) or connectors (limit)"
          />
        </div>
        <div>
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='true / false or {"max":25,"hard":true}'
          />
        </div>
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required"
          />
        </div>
        <div>
          <Label htmlFor="expires">Expires at (optional)</Label>
          <Input
            id="expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
        <Button onClick={() => create.mutate()} disabled={!reason.trim() || create.isPending}>
          {create.isPending ? "Creating…" : "Create override"}
        </Button>
      </CardContent>
    </Card>
  );
}
