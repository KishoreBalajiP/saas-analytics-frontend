import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, RefreshCw, ShieldCheck, UserMinus, UserX } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import {
  EmptyState,
  ErrorState,
  InlineFieldErrors,
  TableSkeleton,
} from "@/components/common/states";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as membersApi from "@/features/members/api";
import {
  roleLabel,
  type InvitationStatus,
  type Member,
  type WorkspaceInvitation,
  type WorkspaceRole,
} from "@/features/members/types";
import type { PaginationMeta } from "@/lib/api/types";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  suspended: "destructive",
  locked: "destructive",
  unverified: "outline",
  invited: "secondary",
};

/**
 * Workspace members: who is in the workspace, with which roles, and the
 * actions the current user may take on them (role change, deactivate,
 * reactivate, remove), plus invitations with resend / revoke.
 *
 * The UI only hides what the user cannot do; the backend enforces the role
 * ceiling, the last-owner rule and "no changes to your own membership".
 */
export function MembersView() {
  const { permissions, me } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.USERS_VIEW);
  const canInvite = hasPermission(permissions, Permissions.USERS_CREATE);
  const canViewRoles = hasPermission(permissions, Permissions.ROLES_VIEW);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const rolesQuery = useQuery({
    queryKey: [...membersApi.membersKeys.roles],
    queryFn: () => membersApi.listRoles(),
    enabled: canView && canViewRoles,
  });
  const membersQuery = useQuery({
    queryKey: [...membersApi.membersKeys.members({ page, search })],
    queryFn: () => membersApi.listMembers({ page, limit: 20, ...(search ? { search } : {}) }),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Members" />;
  if (membersQuery.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (membersQuery.isError)
    return (
      <ErrorState
        error={membersQuery.error}
        onRetry={() => membersQuery.refetch()}
        resource="Members"
      />
    );

  const members = membersQuery.data?.data ?? [];
  const meta = membersQuery.data?.meta as PaginationMeta | undefined;
  const roles = rolesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          className="flex items-end gap-2"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setPage(1);
            setSearch(String(data.get("q") ?? "").trim());
          }}
        >
          <Label className="space-y-1">
            <span className="text-sm">Search members</span>
            <Input name="q" defaultValue={search} placeholder="Name or email" maxLength={128} />
          </Label>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        {canInvite ? (
          <Button onClick={() => setInviteOpen(true)}>
            <MailPlus className="mr-1 h-4 w-4" /> Invite member
          </Button>
        ) : null}
      </div>

      {inviteOpen ? <InviteForm roles={roles} onClose={() => setInviteOpen(false)} /> : null}

      {members.length ? (
        <MembersTable
          members={members}
          roles={roles}
          currentUserId={me?.id ?? null}
          {...(meta ? { meta } : {})}
          setPage={setPage}
        />
      ) : (
        <EmptyState
          title={search ? "No matching members" : "No members yet"}
          description={search ? "Try another name or email." : "Invite people to your workspace."}
        />
      )}

      {canInvite ? <InvitationsPanel /> : null}
    </div>
  );
}

function MembersTable({
  members,
  roles,
  currentUserId,
  meta,
  setPage,
}: {
  members: Member[];
  roles: WorkspaceRole[];
  currentUserId: string | null;
  meta?: PaginationMeta;
  setPage: (page: number) => void;
}) {
  const { permissions } = useTenantSession();
  const canAssign = hasPermission(permissions, Permissions.ROLES_ASSIGN) && roles.length > 0;
  const canUpdate = hasPermission(permissions, Permissions.USERS_UPDATE);
  const canDelete = hasPermission(permissions, Permissions.USERS_DELETE);
  const [editing, setEditing] = useState<Member | null>(null);
  const client = useQueryClient();
  const refresh = () =>
    void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });

  const deactivate = useMutation({
    mutationFn: (id: string) => membersApi.deactivateMember(id),
    onSuccess: (result) => {
      toast.success(`${result.member.name || "Member"} was deactivated and signed out`);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to deactivate the member")),
  });
  const reactivate = useMutation({
    mutationFn: (id: string) => membersApi.reactivateMember(id),
    onSuccess: (result) => {
      toast.success(`${result.member.name || "Member"} can sign in again`);
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to reactivate the member")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => membersApi.removeMember(id),
    onSuccess: () => {
      toast.success("Member removed from the workspace");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to remove the member")),
  });

  const columns: Column<Member & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Member",
      render: (member) => (
        <div>
          <div className="font-medium">
            {member.name || "—"}
            {member.id === currentUserId ? (
              <span className="ml-1 text-xs text-muted-foreground">(you)</span>
            ) : null}
          </div>
          {member.email ? (
            <div className="text-xs text-muted-foreground">{member.email}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: "roles",
      header: "Roles",
      render: (member) => (
        <div className="flex flex-wrap gap-1">
          {member.roles.map((role) => (
            <Badge key={role.id} variant={role.name === "Owner" ? "default" : "outline"}>
              {role.name === "Owner" ? <ShieldCheck className="mr-1 h-3 w-3" /> : null}
              {roleLabel(role.name)}
            </Badge>
          ))}
          {member.isPrimaryOwner ? <Badge variant="secondary">Primary owner</Badge> : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (member) => (
        <Badge variant={STATUS_VARIANT[member.status] ?? "outline"} className="capitalize">
          {member.status === "suspended" ? "deactivated" : member.status}
        </Badge>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Last sign-in",
      render: (member) => (
        <span className="text-xs text-muted-foreground">{date(member.lastLoginAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (member) => {
        if (member.id === currentUserId) return null;
        const label = member.name || member.email || "this member";
        return (
          <div className="flex justify-end gap-1">
            {canAssign ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing(member)}>
                Change roles
              </Button>
            ) : null}
            {canUpdate && member.status === "active" ? (
              <ConfirmButton
                label={`Deactivate ${label}`}
                icon={<UserX className="h-3.5 w-3.5" />}
                title="Deactivate member?"
                description={`${label} is signed out everywhere and cannot sign in until reactivated. Their seat stays reserved.`}
                confirm="Deactivate"
                onConfirm={() => deactivate.mutate(member.id)}
                pending={deactivate.isPending}
              />
            ) : null}
            {canUpdate && member.status === "suspended" ? (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Reactivate ${label}`}
                disabled={reactivate.isPending}
                onClick={() => reactivate.mutate(member.id)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            {canDelete ? (
              <ConfirmButton
                label={`Remove ${label}`}
                icon={<UserMinus className="h-3.5 w-3.5 text-destructive" />}
                title="Remove member?"
                description={`${label} loses access to this workspace immediately and their seat is freed. Content they created stays in the workspace. You can invite them again later.`}
                confirm="Remove"
                onConfirm={() => remove.mutate(member.id)}
                pending={remove.isPending}
              />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {editing ? (
        <RoleEditor member={editing} roles={roles} onClose={() => setEditing(null)} />
      ) : null}
      <DataTable
        columns={columns}
        data={members as Array<Member & Record<string, unknown>>}
        {...(meta ? { meta } : {})}
        onPageChange={setPage}
        getRowId={(member) => String(member["id"])}
      />
    </div>
  );
}

function ConfirmButton({
  label,
  icon,
  title,
  description,
  confirm,
  onConfirm,
  pending,
}: {
  label: string;
  icon: ReactNode;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={label}>
          {icon}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RoleEditor({
  member,
  roles,
  onClose,
}: {
  member: Member;
  roles: WorkspaceRole[];
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>(member.roles.map((r) => r.id));
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: () => membersApi.setMemberRoles(member.id, selected),
    onSuccess: (updated) => {
      toast.success(`Roles updated for ${updated.name || "the member"}`);
      void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });
      onClose();
    },
    onError: setError,
  });
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change roles: {member.name || member.email}</CardTitle>
        <CardDescription>
          You can grant roles below your own access. Only an Owner grants or removes the Owner role,
          and a workspace always keeps one active Owner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selected.length) {
              setError(new Error("Choose at least one role."));
              return;
            }
            mutation.mutate();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Roles</legend>
            {roles.map((role) => (
              <label key={role.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(role.id)}
                  onChange={() => toggle(role.id)}
                />
                <span>
                  <span className="font-medium">{roleLabel(role.name)}</span>
                  {role.description ? (
                    <span className="block text-xs text-muted-foreground">{role.description}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>
          <InlineFieldErrors error={error} />
          {error instanceof Error && !(error as { errors?: unknown[] }).errors?.length ? (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save roles"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function InviteForm({ roles, onClose }: { roles: WorkspaceRole[]; onClose: () => void }) {
  const client = useQueryClient();
  const roleNames = roles.length ? roles.map((r) => r.name) : ["Viewer"];
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleName, setRoleName] = useState<string>(
    roleNames.includes("Viewer") ? "Viewer" : (roleNames[0] ?? "Viewer"),
  );
  const [error, setError] = useState<unknown>(null);
  const mutation = useMutation({
    mutationFn: () =>
      membersApi.invite({
        email: email.trim(),
        roleName,
        ...(name.trim() ? { name: name.trim() } : {}),
      }),
    onSuccess: (result) => {
      if (result.alreadyPending) toast.success("An invitation is already pending for this address");
      else if (result.delivered)
        toast.success(`Invitation sent to ${result.invitation.invitedEmail}`);
      else toast.error("Invitation created, but the email could not be sent. Resend it later.");
      void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });
      onClose();
    },
    onError: setError,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
        <CardDescription>
          They receive a link to join. You can only invite with roles you hold.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.trim()) {
              setError(new Error("Enter an email address."));
              return;
            }
            mutation.mutate();
          }}
        >
          <Label className="space-y-1">
            <span>Email</span>
            <Input
              type="email"
              value={email}
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Label>
          <Label className="space-y-1">
            <span>Name (optional)</span>
            <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
          </Label>
          <Label className="space-y-1">
            <span>Role</span>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
            >
              {roleNames.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </Label>
          <div className="space-y-2 sm:col-span-3">
            <InlineFieldErrors error={error} />
            {error instanceof Error && !(error as { errors?: unknown[] }).errors?.length ? (
              <p role="alert" className="text-sm text-destructive">
                {error.message}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Sending…" : "Send invitation"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

const INVITATION_FILTERS: Array<{ value: InvitationStatus | ""; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "accepted", label: "Accepted" },
  { value: "revoked", label: "Revoked" },
  { value: "", label: "All" },
];

function InvitationsPanel() {
  const { permissions } = useTenantSession();
  const canResend = hasPermission(permissions, Permissions.USERS_CREATE);
  const canRevoke = hasPermission(permissions, Permissions.USERS_UPDATE);
  const [status, setStatus] = useState<InvitationStatus | "">("pending");
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...membersApi.membersKeys.invitations({ status, page })],
    queryFn: () => membersApi.listInvitations({ page, limit: 20, ...(status ? { status } : {}) }),
  });
  const refresh = () =>
    void client.invalidateQueries({ queryKey: [...membersApi.membersKeys.all] });
  const resend = useMutation({
    mutationFn: (id: string) => membersApi.resendInvitation(id),
    onSuccess: (result) => {
      if (result.delivered)
        toast.success(`Invitation re-sent to ${result.invitation.invitedEmail}`);
      else toast.error("The link was renewed, but the email could not be sent.");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to resend the invitation")),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => membersApi.revokeInvitation(id),
    onSuccess: () => {
      toast.success("Invitation revoked");
      refresh();
    },
    onError: (e) => toast.error(errorMessage(e, "Unable to revoke the invitation")),
  });

  const columns: Column<WorkspaceInvitation & Record<string, unknown>>[] = [
    { key: "invitedEmail", header: "Email" },
    {
      key: "roleName",
      header: "Role",
      render: (row) => <Badge variant="outline">{roleLabel(row.roleName)}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.status === "pending" ? "default" : "secondary"} className="capitalize">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (row) => <span className="text-xs text-muted-foreground">{date(row.expiresAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          {canResend && (row.status === "pending" || row.status === "expired") ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={resend.isPending}
              onClick={() => resend.mutate(row._id)}
            >
              Resend
            </Button>
          ) : null}
          {canRevoke && row.status === "pending" ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate(row._id)}
            >
              Revoke
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            Pending links can be re-sent or revoked. Expired, accepted and revoked invitations stay
            here as history.
          </CardDescription>
        </div>
        <Label className="space-y-1">
          <span className="text-sm">Show</span>
          <select
            aria-label="Invitation status"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as InvitationStatus | "");
            }}
          >
            {INVITATION_FILTERS.map((filter) => (
              <option key={filter.label} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </Label>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Invitations" />
        ) : (
          <DataTable
            columns={columns}
            data={(query.data?.data ?? []) as Array<WorkspaceInvitation & Record<string, unknown>>}
            {...(query.data?.meta ? { meta: query.data.meta as PaginationMeta } : {})}
            onPageChange={setPage}
            emptyMessage="No invitations in this view"
            getRowId={(row) => String(row["_id"])}
          />
        )}
      </CardContent>
    </Card>
  );
}
