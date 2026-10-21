import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Crown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as membersApi from "@/features/members/api";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

function FormError({ error }: { error: unknown }) {
  return (
    <>
      <InlineFieldErrors error={error} />
      {error instanceof Error && !(error as { errors?: unknown[] }).errors?.length ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}
    </>
  );
}

/**
 * Owner-only workspace actions: transfer ownership, and delete the
 * workspace (typed slug + password, grace period, then a verified purge).
 */
export function DangerZone() {
  const { permissions } = useTenantSession();
  const canTransfer = hasPermission(permissions, Permissions.WORKSPACE_TRANSFER);
  const canDelete = hasPermission(permissions, Permissions.WORKSPACE_DELETE);
  if (!canTransfer && !canDelete) {
    return <ErrorState error={{ statusCode: 403 }} resource="Workspace ownership" />;
  }
  return (
    <div className="space-y-6">
      {canTransfer ? <TransferOwnershipCard /> : null}
      {canDelete ? <DeleteWorkspaceCard /> : null}
    </div>
  );
}

function TransferOwnershipCard() {
  const { me, refetch } = useTenantSession();
  const client = useQueryClient();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const members = useQuery({
    queryKey: [...membersApi.membersKeys.members({ status: "active", purpose: "transfer" })],
    queryFn: () => membersApi.listMembers({ status: "active", limit: 100 }),
  });
  const candidates = (members.data?.data ?? []).filter((m) => m.id !== me?.id);
  const mutation = useMutation({
    mutationFn: () => membersApi.transferOwnership(userId, password),
    onSuccess: async () => {
      const target = candidates.find((m) => m.id === userId);
      toast.success(
        `${target?.name || "The member"} is now the workspace owner. You are an Admin.`,
      );
      setPassword("");
      void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });
      await refetch();
    },
    onError: setError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-4 w-4" /> Transfer ownership
        </CardTitle>
        <CardDescription>
          The new owner must be an active member. They receive the Owner role and you become an
          Admin; the change applies immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {members.isLoading ? (
          <TableSkeleton rows={2} cols={2} />
        ) : members.isError ? (
          <ErrorState error={members.error} onRetry={() => members.refetch()} resource="Members" />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!userId) {
                setError(new Error("Choose the new owner."));
                return;
              }
              if (!password) {
                setError(new Error("Enter your password to confirm."));
                return;
              }
              mutation.mutate();
            }}
          >
            <Label className="space-y-1">
              <span>New owner</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
              >
                <option value="">
                  {candidates.length ? "Choose an active member" : "No other active members"}
                </option>
                {candidates.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email || member.id}
                    {member.email && member.name ? ` (${member.email})` : ""}
                  </option>
                ))}
              </select>
            </Label>
            <Label className="space-y-1">
              <span>Your password</span>
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Label>
            <FormError error={error} />
            <Button type="submit" disabled={mutation.isPending || !candidates.length}>
              {mutation.isPending ? "Transferring…" : "Transfer ownership"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteWorkspaceCard() {
  const { signOut } = useTenantSession();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const context = useQuery({
    queryKey: [...membersApi.membersKeys.deletion],
    queryFn: () => membersApi.getDeletionContext(),
  });
  const slug = context.data?.workspace.slug ?? "";
  const mutation = useMutation({
    mutationFn: () =>
      membersApi.requestDeletion({
        confirm: confirm.trim(),
        password,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: async (deletion) => {
      const when = deletion.purgeAfter ? new Date(deletion.purgeAfter).toLocaleDateString() : "";
      toast.success(
        `The workspace is closed and will be permanently deleted${when ? ` on ${when}` : ""}. Contact support before then to cancel.`,
      );
      // Every session of the workspace was revoked server-side.
      await signOut().catch(() => undefined);
      void navigate({ to: "/login" });
    },
    onError: setError,
  });

  if (context.isLoading) return <TableSkeleton rows={2} cols={2} />;
  if (context.isError)
    return (
      <ErrorState
        error={context.error}
        onRetry={() => context.refetch()}
        resource="Workspace deletion"
      />
    );

  const matches = confirm.trim().toLowerCase() === slug.toLowerCase() && slug.length > 0;
  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Delete workspace
        </CardTitle>
        <CardDescription>
          Everyone is signed out and the workspace closes at once. After {context.data?.graceDays}{" "}
          days every dataset, dashboard, report, alert, key, member and setting is permanently
          deleted. Support can cancel the deletion during that time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!matches) {
              setError(new Error(`Type ${slug} to confirm.`));
              return;
            }
            if (!password) {
              setError(new Error("Enter your password to confirm."));
              return;
            }
            mutation.mutate();
          }}
        >
          <Label className="space-y-1">
            <span>
              Type <code className="rounded bg-muted px-1">{slug}</code> to confirm
            </span>
            <Input
              aria-label="Workspace slug confirmation"
              value={confirm}
              autoComplete="off"
              onChange={(event) => setConfirm(event.target.value)}
            />
          </Label>
          <Label className="space-y-1">
            <span>Your password</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Label>
          <Label className="space-y-1">
            <span>Reason (optional)</span>
            <Input
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </Label>
          <FormError error={error} />
          <Button type="submit" variant="destructive" disabled={mutation.isPending || !matches}>
            {mutation.isPending ? "Scheduling deletion…" : "Delete this workspace"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
