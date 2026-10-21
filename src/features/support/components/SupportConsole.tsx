import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Search, ShieldAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as adminApi from "@/features/admin/api";
import { DiagnosticsPanel } from "@/features/support/components/DiagnosticsPanel";
import { ReasonDialog } from "@/features/support/components/ReasonDialog";
import {
  formatDateTime,
  grantStatusLabel,
  supportErrorMessage,
} from "@/features/support/lib/labels";
import type {
  ImpersonationStart,
  SupportGrant,
  SupportSessionRecord,
} from "@/features/support/types";
import { useAdminSession } from "@/lib/auth/session";
import { beginSupportSession } from "@/lib/auth/supportSession";
import { Permissions, hasAnyPermission, hasPermission } from "@/lib/permissions";

const keys = {
  grants: (tenantId: string) => ["admin", "support", "grants", tenantId] as const,
  pending: ["admin", "support", "grants", "pending"] as const,
  mySessions: ["admin", "support", "sessions", "mine"] as const,
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/**
 * Admin support console (roadmap 2.3). Diagnostics come first; a read-only
 * support session needs the workspace's consent (or an approved break-glass
 * grant) and a reason, is capped per day, and ends on its own.
 */
export function SupportConsole() {
  const { me, permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.SUPPORT_VIEW);
  const canConfigure = hasPermission(permissions, Permissions.SUPPORT_CONFIGURE);
  const canApprove = hasPermission(permissions, Permissions.SUPPORT_APPROVE);
  const [tenantInput, setTenantInput] = useState("");
  const [tenantId, setTenantId] = useState("");

  if (!hasAnyPermission(permissions, Permissions.SUPPORT_VIEW, Permissions.SUPPORT_CONFIGURE)) {
    return <ErrorState error={{ statusCode: 403 }} resource="Support" />;
  }

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setTenantId(tenantInput.trim());
        }}
      >
        <Input
          className="max-w-sm"
          placeholder="Workspace (tenant) ID"
          aria-label="Workspace ID"
          value={tenantInput}
          onChange={(event) => setTenantInput(event.target.value)}
        />
        <Button type="submit" disabled={!tenantInput.trim()}>
          <Search className="mr-1 h-4 w-4" /> Open workspace diagnostics
        </Button>
      </form>

      {tenantId && canView ? <DiagnosticsPanel tenantId={tenantId} /> : null}
      {tenantId ? (
        <TenantAccessPanel tenantId={tenantId} canView={canView} canConfigure={canConfigure} />
      ) : null}
      {canConfigure ? <StartSessionPanel operatorEmail={me?.email ?? null} /> : null}
      {canView ? <MySessionsPanel canStop={canConfigure} /> : null}
      {canApprove && canView ? <ApprovalsPanel myId={me?.id ?? null} /> : null}
      {canConfigure ? <AccountToolsPanel defaultTenantId={tenantId} /> : null}
    </div>
  );
}

/* --------------------------- support access ----------------------------- */

function TenantAccessPanel({
  tenantId,
  canView,
  canConfigure,
}: {
  tenantId: string;
  canView: boolean;
  canConfigure: boolean;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const [revoking, setRevoking] = useState<SupportGrant | null>(null);
  const grants = useQuery({
    queryKey: keys.grants(tenantId),
    queryFn: () => adminApi.listSupportGrants({ tenantId, limit: 20 }),
    enabled: canView,
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
  };
  const request = useMutation({
    mutationFn: () =>
      adminApi.requestBreakGlass(tenantId, reason.trim(), ticket.trim() || undefined),
    onSuccess: () => {
      setReason("");
      setTicket("");
      invalidate();
      toast.success("Break-glass access requested. A different super admin must approve it.");
    },
    onError: (error) => toast.error(supportErrorMessage(error)),
  });
  const revoke = useMutation({
    mutationFn: ({ grant, why }: { grant: SupportGrant; why: string }) =>
      adminApi.revokeSupportGrant(grant.id, why),
    onSuccess: () => {
      setRevoking(null);
      invalidate();
      toast.success("Support access revoked.");
    },
    onError: (error) => toast.error(supportErrorMessage(error)),
  });

  return (
    <Section
      title="Workspace support access"
      description="Consent is granted by the workspace's Owner or Admin. For an incident without consent, request break-glass access; a different super admin must approve it."
    >
      {canView ? (
        grants.isLoading ? (
          <TableSkeleton rows={2} cols={3} />
        ) : grants.isError ? (
          <ErrorState
            error={grants.error}
            onRetry={() => grants.refetch()}
            resource="Support access"
          />
        ) : (grants.data?.data.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            This workspace has never granted support access.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {grants.data?.data.map((grant) => (
              <li
                key={grant.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              >
                <Badge variant={grant.breakGlass ? "destructive" : "secondary"}>
                  {grant.breakGlass ? "Break-glass" : "Consent"}
                </Badge>
                <span>{grantStatusLabel(grant)}</span>
                <span className="text-muted-foreground">
                  {grant.expiresAt
                    ? `until ${formatDateTime(grant.expiresAt)}`
                    : formatDateTime(grant.createdAt)}
                  {grant.reason ? ` · ${grant.reason}` : ""}
                </span>
                {canConfigure && (grant.status === "active" || grant.status === "pending") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setRevoking(grant)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : null}

      {canConfigure ? (
        <form
          className="space-y-2 rounded-md border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length >= 10) request.mutate();
          }}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldAlert className="h-4 w-4 text-warning" /> Request break-glass access
          </div>
          <Label htmlFor="break-glass-reason">Incident reason</Label>
          <Textarea
            id="break-glass-reason"
            rows={2}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="At least 10 characters, e.g. INC-42: dashboards empty for all users"
          />
          <Label htmlFor="break-glass-ticket">Ticket (optional)</Label>
          <Input
            id="break-glass-ticket"
            maxLength={120}
            value={ticket}
            onChange={(event) => setTicket(event.target.value)}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={request.isPending || reason.trim().length < 10}
          >
            {request.isPending ? "Requesting…" : "Request break-glass access"}
          </Button>
        </form>
      ) : null}

      <ReasonDialog
        open={Boolean(revoking)}
        onOpenChange={(open) => !open && setRevoking(null)}
        title="Revoke support access"
        description="Open support sessions under this grant end immediately."
        confirmLabel="Revoke access"
        destructive
        pending={revoke.isPending}
        onConfirm={(why) => revoking && revoke.mutate({ grant: revoking, why })}
      />
    </Section>
  );
}

/* --------------------------- start a session ---------------------------- */

function StartSessionPanel({ operatorEmail }: { operatorEmail: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [targetUserId, setTargetUserId] = useState("");
  const [reason, setReason] = useState("");
  const [ticket, setTicket] = useState("");
  const [started, setStarted] = useState<ImpersonationStart | null>(null);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const start = useMutation({
    mutationFn: () =>
      adminApi.impersonate(targetUserId.trim(), reason.trim(), ticket.trim() || undefined),
    onSuccess: (data) => {
      setError(null);
      setStarted(data);
      void queryClient.invalidateQueries({ queryKey: keys.mySessions });
    },
    onError: setError,
  });
  const stop = useMutation({
    mutationFn: ({ sessionId, why }: { sessionId: string; why: string }) =>
      adminApi.stopImpersonation(sessionId, why),
    onSuccess: () => {
      setStopping(false);
      setStarted(null);
      void queryClient.invalidateQueries({ queryKey: keys.mySessions });
      toast.success("Support session stopped.");
    },
    onError: (err) => toast.error(supportErrorMessage(err)),
  });

  const openWorkspace = () => {
    if (!started) return;
    beginSupportSession(started, operatorEmail);
    // Cached data belongs to another identity.
    queryClient.clear();
    void navigate({ to: "/dashboard" });
  };

  return (
    <Section
      title="Start a read-only support session"
      description="Requires the workspace's consent or your own approved break-glass grant. Sessions are read-only, end on their own (at most 60 minutes) and are listed in the workspace's settings."
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (targetUserId.trim() && reason.trim().length >= 3) start.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="support-target-user">User ID</Label>
          <Input
            id="support-target-user"
            value={targetUserId}
            maxLength={64}
            onChange={(event) => setTargetUserId(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-ticket">Ticket (optional)</Label>
          <Input
            id="support-ticket"
            value={ticket}
            maxLength={120}
            onChange={(event) => setTicket(event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="support-session-reason">Reason</Label>
          <Textarea
            id="support-session-reason"
            rows={2}
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="submit"
            disabled={start.isPending || !targetUserId.trim() || reason.trim().length < 3}
          >
            {start.isPending ? "Starting…" : "Start support session"}
          </Button>
        </div>
      </form>
      {error ? (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          <p>{supportErrorMessage(error)}</p>
          <InlineFieldErrors error={error} />
        </div>
      ) : null}

      {started ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
          <span>
            Session ready for <span className="font-medium">{started.user.email}</span> until{" "}
            {formatDateTime(started.expiresAt)}.
          </span>
          <Badge variant="outline">Read-only</Badge>
          {started.breakGlass ? <Badge variant="destructive">Break-glass</Badge> : null}
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={openWorkspace}>
              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open workspace as {started.user.email}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStopping(true)}>
              Stop session
            </Button>
          </div>
        </div>
      ) : null}

      <ReasonDialog
        open={stopping}
        onOpenChange={setStopping}
        title="Stop the support session"
        confirmLabel="Stop session"
        pending={stop.isPending}
        onConfirm={(why) => started && stop.mutate({ sessionId: started.sessionId, why })}
      />
    </Section>
  );
}

/* --------------------------- open sessions ------------------------------ */

function MySessionsPanel({ canStop }: { canStop: boolean }) {
  const queryClient = useQueryClient();
  const [stopping, setStopping] = useState<SupportSessionRecord | null>(null);
  const sessions = useQuery({
    queryKey: keys.mySessions,
    queryFn: () => adminApi.listSupportSessions({ mine: true, status: "active", limit: 20 }),
  });
  const stop = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => adminApi.stopImpersonation(id, why),
    onSuccess: () => {
      setStopping(null);
      void queryClient.invalidateQueries({ queryKey: keys.mySessions });
      toast.success("Support session stopped.");
    },
    onError: (err) => toast.error(supportErrorMessage(err)),
  });

  return (
    <Section title="Your open support sessions">
      {sessions.isLoading ? (
        <TableSkeleton rows={2} cols={3} />
      ) : sessions.isError ? (
        <ErrorState
          error={sessions.error}
          onRetry={() => sessions.refetch()}
          resource="Support sessions"
        />
      ) : (sessions.data?.data.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No open support sessions.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {sessions.data?.data.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
            >
              <span className="font-medium">{session.user.display ?? session.user.id}</span>
              <span className="text-muted-foreground">
                workspace {session.tenantId} · ends {formatDateTime(session.expiresAt)} ·{" "}
                {session.reason}
              </span>
              {session.breakGlass ? <Badge variant="destructive">Break-glass</Badge> : null}
              {canStop ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setStopping(session)}
                >
                  Stop
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={Boolean(stopping)}
        onOpenChange={(open) => !open && setStopping(null)}
        title="Stop the support session"
        confirmLabel="Stop session"
        pending={stop.isPending}
        onConfirm={(why) => stopping && stop.mutate({ id: stopping.id, why })}
      />
    </Section>
  );
}

/* --------------------------- approvals ---------------------------------- */

function ApprovalsPanel({ myId }: { myId: string | null }) {
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<{ grant: SupportGrant; approve: boolean } | null>(null);
  const pending = useQuery({
    queryKey: keys.pending,
    queryFn: () =>
      adminApi.listSupportGrants({ status: "pending", kind: "break_glass", limit: 50 }),
  });
  const decide = useMutation({
    mutationFn: ({
      grant,
      approve,
      why,
    }: {
      grant: SupportGrant;
      approve: boolean;
      why: string;
    }) =>
      approve ? adminApi.approveBreakGlass(grant.id, why) : adminApi.denyBreakGlass(grant.id, why),
    onSuccess: (_data, vars) => {
      setDeciding(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "support"] });
      toast.success(vars.approve ? "Break-glass access approved." : "Break-glass request denied.");
    },
    onError: (err) => toast.error(supportErrorMessage(err)),
  });

  return (
    <Section
      title="Break-glass approvals"
      description="Approve only for a confirmed incident. You cannot approve your own request."
    >
      {pending.isLoading ? (
        <TableSkeleton rows={2} cols={3} />
      ) : pending.isError ? (
        <ErrorState
          error={pending.error}
          onRetry={() => pending.refetch()}
          resource="Break-glass requests"
        />
      ) : (pending.data?.data.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No break-glass requests are waiting.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {pending.data?.data.map((grant) => {
            const own = Boolean(myId) && grant.requestedBy?.id === myId;
            return (
              <li
                key={grant.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-2"
              >
                <span className="font-medium">workspace {grant.tenantId}</span>
                <span className="text-muted-foreground">
                  by {grant.requestedBy?.display ?? grant.requestedBy?.id} · {grant.reason}
                  {grant.ticket ? ` (${grant.ticket})` : ""} · {formatDateTime(grant.createdAt)}
                </span>
                <div className="ml-auto flex gap-2">
                  <Button
                    size="sm"
                    disabled={own}
                    title={own ? "A different super admin must approve your request" : undefined}
                    onClick={() => setDeciding({ grant, approve: true })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeciding({ grant, approve: false })}
                  >
                    Deny
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ReasonDialog
        open={Boolean(deciding)}
        onOpenChange={(open) => !open && setDeciding(null)}
        title={deciding?.approve ? "Approve break-glass access" : "Deny break-glass access"}
        confirmLabel={deciding?.approve ? "Approve" : "Deny"}
        destructive={deciding?.approve === false}
        pending={decide.isPending}
        onConfirm={(why) => deciding && decide.mutate({ ...deciding, why })}
      />
    </Section>
  );
}

/* --------------------------- account tools ------------------------------ */

type AccountAction = "recover" | "revoke" | "broadcast";

function AccountToolsPanel({ defaultTenantId }: { defaultTenantId: string }) {
  const [userId, setUserId] = useState("");
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [action, setAction] = useState<AccountAction | null>(null);
  useEffect(() => {
    if (defaultTenantId) setTenantId(defaultTenantId);
  }, [defaultTenantId]);
  const run = useMutation({
    mutationFn: ({ kind, why }: { kind: AccountAction; why: string }) => {
      if (kind === "recover") return adminApi.recoverAccount(userId.trim(), why);
      if (kind === "revoke") return adminApi.revokeUserSessions(userId.trim(), why);
      return adminApi.broadcast({
        tenantId: tenantId.trim(),
        title: title.trim(),
        body: body.trim(),
        reason: why,
      });
    },
    onSuccess: (_data, vars) => {
      setAction(null);
      if (vars.kind === "broadcast") {
        setTitle("");
        setBody("");
      }
      toast.success(
        vars.kind === "recover"
          ? "Password reset email requested."
          : vars.kind === "revoke"
            ? "All of the user's sessions were revoked."
            : "Broadcast sent.",
      );
    },
    onError: (err) => toast.error(supportErrorMessage(err)),
  });

  return (
    <Section title="Account tools" description="Every action needs a reason and is audited.">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="support-account-user">User ID</Label>
          <Input
            id="support-account-user"
            value={userId}
            maxLength={64}
            onChange={(event) => setUserId(event.target.value)}
          />
        </div>
        <Button variant="outline" disabled={!userId.trim()} onClick={() => setAction("recover")}>
          Send password reset
        </Button>
        <Button variant="outline" disabled={!userId.trim()} onClick={() => setAction("revoke")}>
          Revoke all sessions
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="support-broadcast-tenant">Broadcast to workspace ID</Label>
          <Input
            id="support-broadcast-tenant"
            value={tenantId}
            maxLength={64}
            onChange={(event) => setTenantId(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-broadcast-title">Title</Label>
          <Input
            id="support-broadcast-title"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="support-broadcast-body">Message</Label>
          <Textarea
            id="support-broadcast-body"
            rows={2}
            value={body}
            maxLength={2000}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div>
          <Button
            variant="outline"
            disabled={!tenantId.trim() || !title.trim()}
            onClick={() => setAction("broadcast")}
          >
            Send broadcast
          </Button>
        </div>
      </div>
      <ReasonDialog
        open={Boolean(action)}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action === "recover"
            ? "Send a password reset"
            : action === "revoke"
              ? "Revoke all sessions"
              : "Send a broadcast"
        }
        confirmLabel="Confirm"
        destructive={action === "revoke"}
        pending={run.isPending}
        onConfirm={(why) => action && run.mutate({ kind: action, why })}
      />
    </Section>
  );
}
