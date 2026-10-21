import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Headphones, ShieldCheck, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import * as supportApi from "@/features/support/api";
import {
  formatDateTime,
  grantStatusLabel,
  sessionStatusLabel,
  supportActionLabel,
  supportErrorMessage,
} from "@/features/support/lib/labels";
import type { SupportGrant, WorkspaceSupportAccess } from "@/features/support/types";
import { useTenantSession } from "@/lib/auth/session";
import { useSupportSession } from "@/lib/auth/supportSession";
import { hasPermission, perm } from "@/lib/permissions";

const SETTINGS_VIEW = perm("settings", "view");
const SETTINGS_CONFIGURE = perm("settings", "configure");

/** Offered consent windows (hours); the server's `maxHours` caps the list. */
const DURATIONS = [1, 4, 24, 72];

function durationLabel(hours: number) {
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = hours / 24;
  return days === 1 ? "24 hours" : `${days} days`;
}

/**
 * Workspace settings: whether platform support may open read-only support
 * sessions in this workspace, for how long, and the record of every grant,
 * support session and support action.
 */
export function SupportAccessCard() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, SETTINGS_VIEW);
  const canConfigure = hasPermission(permissions, SETTINGS_CONFIGURE);
  const inSupportSession = Boolean(useSupportSession());

  const query = useQuery({
    queryKey: [...supportApi.supportAccessKeys.all],
    queryFn: supportApi.getWorkspaceSupportAccess,
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Support access" />;
  if (query.isLoading) return <TableSkeleton rows={3} cols={3} />;
  if (query.isError || !query.data)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Support access" />
    );

  // A support session is read-only: it can see this card but never change it.
  const mayChange = canConfigure && !inSupportSession;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Headphones className="h-4 w-4" /> Support access
        </CardTitle>
        <CardDescription>
          Platform support can open a read-only session in this workspace only while you allow it.
          Every support session and action is listed here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AccessStatus data={query.data} mayChange={mayChange} />
        {mayChange ? (
          <GrantForm maxHours={query.data.maxHours} hasActive={Boolean(query.data.active)} />
        ) : null}
        {!canConfigure ? (
          <p className="text-xs text-muted-foreground">
            Ask a workspace Owner or Admin to grant or revoke support access.
          </p>
        ) : null}
        {inSupportSession ? (
          <p className="text-xs text-muted-foreground">
            Support sessions cannot change support access.
          </p>
        ) : null}
        <SessionsTable data={query.data} mayChange={mayChange} />
        <GrantHistory grants={query.data.grants} />
        <SupportActivity />
      </CardContent>
    </Card>
  );
}

function AccessStatus({ data, mayChange }: { data: WorkspaceSupportAccess; mayChange: boolean }) {
  const queryClient = useQueryClient();
  const active = data.active;
  const revoke = useMutation({
    mutationFn: (grant: SupportGrant) => supportApi.revokeSupportAccess(grant.id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [...supportApi.supportAccessKeys.all] });
      const ended = result.endedSessions?.length ?? 0;
      toast.success(
        ended > 0
          ? `Support access revoked. ${ended} open support session${ended === 1 ? "" : "s"} ended.`
          : "Support access revoked.",
      );
    },
    onError: (error) => toast.error(supportErrorMessage(error)),
  });

  if (!active) {
    return (
      <div
        className="flex items-start gap-3 rounded-md border p-3"
        data-testid="support-access-status"
      >
        <ShieldOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium">Support access is off</p>
          <p className="text-sm text-muted-foreground">
            Support can still see operational diagnostics (statuses, counts and errors), but no
            customer data and no sessions.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div
      className="flex flex-wrap items-start gap-3 rounded-md border p-3"
      data-testid="support-access-status"
    >
      <ShieldCheck className="mt-0.5 h-4 w-4 text-success" />
      <div className="flex-1">
        <p className="font-medium">
          {active.breakGlass ? "Break-glass access is active" : "Support access is on"}{" "}
          <span className="font-normal text-muted-foreground">
            until {formatDateTime(active.expiresAt)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {active.breakGlass
            ? `Approved for an incident by platform staff${active.reason ? `: ${active.reason}` : ""}.`
            : `Granted by ${active.grantedBy?.display ?? "a workspace admin"}${active.reason ? ` — ${active.reason}` : ""}.`}{" "}
          Support sessions are read-only and end automatically.
        </p>
      </div>
      {mayChange && !active.breakGlass ? (
        <Button
          size="sm"
          variant="outline"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(active)}
        >
          {revoke.isPending ? "Revoking…" : "Revoke access"}
        </Button>
      ) : null}
    </div>
  );
}

function GrantForm({ maxHours, hasActive }: { maxHours: number; hasActive: boolean }) {
  const queryClient = useQueryClient();
  const options = DURATIONS.filter((h) => h <= maxHours);
  const [hours, setHours] = useState(() => options[1] ?? options[0] ?? 1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<unknown>(null);
  const grant = useMutation({
    mutationFn: () =>
      supportApi.grantSupportAccess(
        note.trim() ? { durationHours: hours, note: note.trim() } : { durationHours: hours },
      ),
    onSuccess: (granted) => {
      setError(null);
      setNote("");
      void queryClient.invalidateQueries({ queryKey: [...supportApi.supportAccessKeys.all] });
      toast.success(`Support access granted until ${formatDateTime(granted.expiresAt)}.`);
    },
    onError: setError,
  });

  return (
    <form
      className="space-y-3 rounded-md border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        grant.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="support-access-duration">Allow support for</Label>
          <select
            id="support-access-duration"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          >
            {options.map((h) => (
              <option key={h} value={h}>
                {durationLabel(h)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="support-access-note">Note for support (optional)</Label>
          <Textarea
            id="support-access-note"
            value={note}
            maxLength={500}
            rows={2}
            placeholder="e.g. Ticket 4711: dashboard shows no data"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
      {error ? <InlineFieldErrors error={error} /> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {supportErrorMessage(error)}
        </p>
      ) : null}
      <Button type="submit" disabled={grant.isPending}>
        {grant.isPending
          ? "Granting…"
          : hasActive
            ? "Replace support access"
            : "Grant support access"}
      </Button>
    </form>
  );
}

function SessionsTable({ data, mayChange }: { data: WorkspaceSupportAccess; mayChange: boolean }) {
  const queryClient = useQueryClient();
  const end = useMutation({
    mutationFn: (sessionId: string) => supportApi.endSupportSessionAsWorkspace(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...supportApi.supportAccessKeys.all] });
      toast.success("Support session ended.");
    },
    onError: (error) => toast.error(supportErrorMessage(error)),
  });

  return (
    <section className="space-y-2" aria-label="Support sessions">
      <h3 className="text-sm font-semibold">Support sessions</h3>
      {data.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No support sessions yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Viewed as</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="sr-only">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(session.startedAt)}
                </TableCell>
                <TableCell>{session.operator.display ?? session.operator.id}</TableCell>
                <TableCell>{session.user.display ?? session.user.id}</TableCell>
                <TableCell>
                  {session.reason}
                  {session.ticket ? (
                    <span className="ml-1 text-xs text-muted-foreground">({session.ticket})</span>
                  ) : null}
                </TableCell>
                <TableCell className="space-x-1 whitespace-nowrap">
                  <Badge variant={session.status === "active" ? "default" : "secondary"}>
                    {sessionStatusLabel(session)}
                  </Badge>
                  {session.breakGlass ? <Badge variant="destructive">Break-glass</Badge> : null}
                  <Badge variant="outline">Read-only</Badge>
                </TableCell>
                <TableCell>
                  {mayChange && session.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={end.isPending}
                      onClick={() => end.mutate(session.id)}
                    >
                      End session
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function GrantHistory({ grants }: { grants: SupportGrant[] }) {
  if (grants.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Support access history">
      <h3 className="text-sm font-semibold">Access history</h3>
      <ul className="space-y-1 text-sm">
        {grants.map((grant) => (
          <li key={grant.id} className="flex flex-wrap items-center gap-2">
            <Badge variant={grant.breakGlass ? "destructive" : "secondary"}>
              {grant.breakGlass ? "Break-glass" : "Consent"}
            </Badge>
            <span>{grantStatusLabel(grant)}</span>
            <span className="text-muted-foreground">
              {grant.breakGlass
                ? `requested by ${grant.requestedBy?.display ?? "platform support"}${
                    grant.decidedBy
                      ? `, decided by ${grant.decidedBy.display ?? grant.decidedBy.id}`
                      : ""
                  }`
                : `granted by ${grant.grantedBy?.display ?? "a workspace admin"}`}
              {" · "}
              {formatDateTime(grant.createdAt)}
              {grant.expiresAt ? ` → ${formatDateTime(grant.expiresAt)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SupportActivity() {
  const query = useQuery({
    queryKey: [...supportApi.supportAccessKeys.activity({ limit: 20 })],
    queryFn: () => supportApi.listSupportActivity({ limit: 20 }),
  });
  return (
    <section className="space-y-2" aria-label="Support activity">
      <h3 className="text-sm font-semibold">Support activity</h3>
      {query.isLoading ? (
        <TableSkeleton rows={2} cols={2} />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => query.refetch()}
          resource="Support activity"
        />
      ) : (query.data?.data.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No support activity yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {query.data?.data.map((row) => (
            <li key={row.id} className="flex flex-wrap gap-2">
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(row.occurredAt)}
              </span>
              <span>{supportActionLabel(row.action)}</span>
              <span className="text-muted-foreground">
                by {row.actor.type === "admin" ? "platform support" : "workspace"}{" "}
                {row.actor.display ?? row.actor.id ?? ""}
              </span>
              {row.result === "failure" ? <Badge variant="outline">Refused</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
