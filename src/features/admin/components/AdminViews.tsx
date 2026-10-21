import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as adminApi from "@/features/admin/api";
import { JobsMonitoring } from "@/features/admin/components/JobsMonitoring";
import { AdminAccessActions } from "@/features/admin/security/AdminAccessActions";
import { MailMonitoring } from "@/features/admin/components/MailMonitoring";
import { RetentionMonitoring } from "@/features/admin/components/RetentionMonitoring";
import { TenantLifecycleActions } from "@/features/admin/components/TenantLifecycleActions";
import {
  BUILT_IN_PLATFORM_ROLES,
  adminScopeOf,
  adminTypeLabel,
  builtInPlatformRole,
  describeScope,
} from "@/features/admin/roles";
import type { PaginationMeta, Role, Tenant } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useAdminSession } from "@/lib/auth/session";

function date(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}
export function AdminOverview() {
  const { permissions, me } = useAdminSession();
  // GET /admin/dashboard/summary requires iam.tenants.view.
  const canView = hasPermission(permissions, Permissions.IAM_TENANTS_VIEW);
  const scope = adminScopeOf(me);
  const query = useQuery({
    queryKey: ["admin", "dashboard", "summary"],
    queryFn: () => adminApi.dashboardSummary({ limit: 10 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Admin overview" />;
  if (query.isLoading) return <TableSkeleton rows={4} cols={2} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Admin overview" />
    );
  const data = query.data;
  if (!data) {
    return <EmptyState title="No overview data" description="No data available yet." />;
  }
  const counts = data.counts ?? {};
  const countCards = [
    { label: "Total tenants", value: counts["total"] ?? 0 },
    { label: "Active", value: counts["active"] ?? 0 },
    { label: "Pending", value: counts["pending"] ?? 0 },
    { label: "Suspended", value: counts["suspended"] ?? 0 },
    { label: "Disabled", value: counts["disabled"] ?? 0 },
    { label: "Archived", value: counts["archived"] ?? 0 },
  ];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Last updated {date(data.generatedAt)}
          {scope.type === "tenant" ? ` · ${describeScope(scope)} only` : ""}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {countCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{card.value}</CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent tenant registrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentTenants && data.recentTenants.length > 0 ? (
              data.recentTenants.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between border-b py-1 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-muted-foreground text-xs">/{t.slug}</div>
                  </div>
                  <Badge variant={t.status === "active" ? "default" : "secondary"}>
                    {t.status}
                  </Badge>
                </div>
              ))
            ) : (
              <EmptyState title="No tenants yet" description="No recent registrations." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent platform admin actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentActions && data.recentActions.length > 0 ? (
              data.recentActions.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b py-1 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">
                      {a.module}.{a.action}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {a.actor?.type ?? "system"} · {date(a.occurredAt)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="No recent actions" description="No audit events to show." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function TenantList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_TENANTS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.IAM_TENANTS_CREATE);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const query = useQuery({
    queryKey: ["admin", "tenants", page, submittedSearch],
    queryFn: () =>
      adminApi.listTenants({
        page,
        limit: 20,
        ...(submittedSearch ? { search: submittedSearch } : {}),
      }),
    enabled: canView,
  });
  const [createOpen, setCreateOpen] = useState(false);
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Tenants" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Tenants" />;
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setSubmittedSearch(search.trim());
        }}
      >
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tenants"
          aria-label="Search tenants"
        />
        <Button type="submit" variant="outline">
          <Search className="mr-1 h-4 w-4" /> Search
        </Button>
        {canCreate && (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create
          </Button>
        )}
      </form>
      {rows.length ? (
        <TenantTable rows={rows} {...(meta ? { meta } : {})} setPage={setPage} />
      ) : (
        <EmptyState
          title="No tenants"
          description="No tenant workspaces match the current search."
        />
      )}
      {createOpen && <TenantForm onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function TenantTable({
  rows,
  meta,
  setPage,
}: {
  rows: Tenant[];
  meta?: PaginationMeta;
  setPage: (page: number) => void;
}) {
  const columns: Column<Tenant & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Tenant",
      render: (tenant) => (
        <a className="font-medium hover:underline" href={`/admin/tenants/${tenant._id}`}>
          {tenant.name}
        </a>
      ),
    },
    {
      key: "slug",
      header: "Slug",
      render: (tenant) => <code className="text-xs">{tenant.slug}</code>,
    },
    {
      key: "status",
      header: "Status",
      render: (tenant) => (
        <Badge
          variant={tenant.status === "active" ? "default" : "secondary"}
          className="capitalize"
        >
          {tenant.status}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (tenant) => (
        <span className="text-xs text-muted-foreground">{date(tenant.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      // Confirmed, reasoned lifecycle actions the admin's permissions allow.
      render: (tenant) => <TenantLifecycleActions tenant={tenant} size="sm" />,
    },
  ];
  const tableRows = rows as Array<Tenant & Record<string, unknown>>;
  return (
    <DataTable
      columns={columns}
      data={tableRows}
      {...(meta ? { meta } : {})}
      onPageChange={setPage}
      getRowId={(tenant) => String(tenant["_id"])}
    />
  );
}

function TenantForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      if (!name.trim() || !email.trim() || !ownerName.trim())
        throw new Error("Tenant and owner fields are required.");
      return adminApi.createTenant({
        name: name.trim(),
        owner: { email: email.trim(), name: ownerName.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Tenant created and invitation sent");
      void client.invalidateQueries({ queryKey: ["admin", "tenants"] });
      onClose();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Unable to create tenant"),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create tenant</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <Label>
            Name
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Label>
          <Label>
            Owner name
            <Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
          </Label>
          <Label>
            Owner email
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Label>
          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create tenant"}
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

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_TENANTS_VIEW);
  const canManageInvitations = hasPermission(permissions, Permissions.IAM_TENANTS_UPDATE);
  const query = useQuery({
    queryKey: ["admin", "tenant", tenantId],
    queryFn: () => adminApi.getTenant(tenantId),
    enabled: canView,
  });
  const stats = useQuery({
    queryKey: ["admin", "tenant", tenantId, "stats"],
    queryFn: () => adminApi.tenantStats(tenantId),
    enabled: canView,
  });
  const billing = useQuery({
    queryKey: ["admin", "tenant", tenantId, "billing"],
    queryFn: () => adminApi.tenantBilling(tenantId),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Tenant" />;
  if (query.isLoading) return <TableSkeleton rows={3} cols={2} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Tenant" />;
  const tenant = query.data;
  if (!tenant) return null;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>{tenant.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Slug: <code>{tenant.slug}</code>
          </p>
          <p>
            Status: <Badge className="capitalize">{tenant.status}</Badge>
          </p>
          <p>Created: {date(tenant.createdAt)}</p>
          <div className="pt-2">
            <TenantLifecycleActions tenant={tenant} size="sm" />
          </div>
        </CardContent>
      </Card>
      <AdminRecordCard
        title="Usage"
        value={stats.data}
        loading={stats.isLoading}
        error={stats.error}
      />
      <AdminRecordCard
        title="Billing"
        value={billing.data}
        loading={billing.isLoading}
        error={billing.error}
      />
      <InvitationPanel tenantId={tenantId} canManage={canManageInvitations} />
    </div>
  );
}

function InvitationPanel({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const client = useQueryClient();
  // Listing needs iam.tenants.view (checked by TenantDetail); resend/revoke
  // need iam.tenants.update (`canManage`).
  const query = useQuery({
    queryKey: ["admin", "tenant", tenantId, "invitations"],
    queryFn: () => adminApi.listTenantInvitations(tenantId, { page: 1, limit: 20 }),
  });
  const resend = useMutation({
    mutationFn: (invitationId: string) => adminApi.resendTenantInvitation(tenantId, invitationId),
    onSuccess: () => {
      toast.success("Invitation resent");
      void client.invalidateQueries({ queryKey: ["admin", "tenant", tenantId, "invitations"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to resend invitation"),
  });
  const revoke = useMutation({
    mutationFn: (invitationId: string) => adminApi.revokeTenantInvitation(tenantId, invitationId),
    onSuccess: () => {
      toast.success("Invitation revoked");
      void client.invalidateQueries({ queryKey: ["admin", "tenant", tenantId, "invitations"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to revoke invitation"),
  });
  const rows = query.data?.data ?? [];
  return (
    <Card className="md:col-span-3">
      <CardHeader>
        <CardTitle>Invitations</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Invitations" />
        ) : rows.length ? (
          <div className="space-y-3">
            {rows.map((invitation) => (
              <div
                key={invitation._id}
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="text-sm">
                  <p className="font-medium">{invitation.invitedEmail}</p>
                  <p className="text-muted-foreground">
                    {invitation.roleName} · <span className="capitalize">{invitation.status}</span>
                    {invitation.expiresAt ? ` · expires ${date(invitation.expiresAt)}` : ""}
                  </p>
                </div>
                {invitation.status === "pending" && canManage && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resend.mutate(invitation._id)}
                      disabled={resend.isPending}
                    >
                      Resend
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revoke.mutate(invitation._id)}
                      disabled={revoke.isPending}
                    >
                      Revoke
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No invitations.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AdminRecordCard({
  title,
  value,
  loading,
  error,
}: {
  title: string;
  value: Record<string, unknown> | undefined;
  loading: boolean;
  error: unknown;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={2} cols={1} />
        ) : error ? (
          <ErrorState error={error} resource={title} />
        ) : value && Object.keys(value).length ? (
          <dl className="space-y-2 text-sm">
            {Object.entries(value).map(([key, item]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="font-medium">
                  {typeof item === "object" ? "Available" : String(item ?? "—")}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">No data.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminList() {
  const { permissions, me } = useAdminSession();
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, Permissions.IAM_ADMINS_VIEW);
  const canSuspend = hasPermission(permissions, Permissions.IAM_ADMINS_SUSPEND);
  const canRestore = hasPermission(permissions, Permissions.IAM_ADMINS_RESTORE);
  const [pendingAction, setPendingAction] = useState<{
    kind: "suspend" | "restore";
    id: string;
    reason: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: () => adminApi.listAdmins({ page: 1, limit: 50 }),
    enabled: canView,
  });
  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminApi.suspendAdmin(id, reason),
    onSuccess: () => {
      toast.success("Admin suspended");
      void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
    },
    onError: (err: Error) => {
      const message = (err as { json?: { message?: string } }).json?.message ?? err.message;
      toast.error(`Failed to suspend admin: ${message}`);
    },
  });
  const restoreMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => adminApi.restoreAdmin(id),
    onSuccess: () => {
      toast.success("Admin restored");
      void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
    },
    onError: (err: Error) => {
      const message = (err as { json?: { message?: string } }).json?.message ?? err.message;
      toast.error(`Failed to restore admin: ${message}`);
    },
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Platform admins" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Platform admins" />
    );
  const rows = query.data?.data ?? [];
  return (
    <>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((adminRow) => {
            const isSelf = me?._id === adminRow._id || me?.id === adminRow._id;
            const isSuspended = adminRow.status === "suspended";
            return (
              <Card key={adminRow._id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <div className="font-medium">
                      {adminRow.name || adminRow.profile?.name || adminRow.email}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {adminRow.email} · {adminTypeLabel(adminRow.adminType)}
                      {adminRow.status ? ` · ${adminRow.status}` : ""}
                      {` · ${describeScope(adminScopeOf(adminRow))}`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* adminauth: invitation + credential reset actions */}
                    <AdminAccessActions admin={adminRow} isSelf={isSelf} />
                    {canSuspend && !isSuspended && !isSelf ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPendingAction({
                                kind: "suspend",
                                id: adminRow._id,
                                reason: "",
                              })
                            }
                            disabled={suspendMutation.isPending}
                          >
                            Suspend
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Suspend platform admin?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The admin will be signed out and cannot log in until restored. Provide
                              a reason for the audit log.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-2">
                            <Label htmlFor="suspend-reason">Reason</Label>
                            <Textarea
                              id="suspend-reason"
                              value={pendingAction?.reason ?? ""}
                              onChange={(e) =>
                                setPendingAction((p) =>
                                  p && p.id === adminRow._id ? { ...p, reason: e.target.value } : p,
                                )
                              }
                              rows={3}
                              required
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                if (!pendingAction || !pendingAction.reason.trim()) {
                                  toast.error("Reason is required");
                                  return;
                                }
                                suspendMutation.mutate({
                                  id: pendingAction.id,
                                  reason: pendingAction.reason.trim(),
                                });
                                setPendingAction(null);
                              }}
                            >
                              Suspend
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                    {canRestore && isSuspended ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreMutation.mutate({ id: adminRow._id })}
                        disabled={restoreMutation.isPending}
                      >
                        Restore
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No platform admins" />
      )}
    </>
  );
}

export function RoleList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_ROLES_VIEW);
  const query = useQuery({
    queryKey: ["admin", "roles"],
    queryFn: () => adminApi.listRoles({ page: 1, limit: 50 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Roles" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={3} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Roles" />;
  const roles = query.data?.data ?? [];
  const builtIn = BUILT_IN_PLATFORM_ROLES.map((definition) => ({
    definition,
    role: roles.find((role) => role.name === definition.name && role.builtIn !== false),
  }));
  const custom = roles.filter((role) => !builtInPlatformRole(role.name) || role.builtIn === false);
  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="built-in-roles">
        <h2 id="built-in-roles" className="text-sm font-semibold">
          Built-in platform roles
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          {builtIn.map(({ definition, role }) => (
            <Card key={definition.name} data-testid={`built-in-role-${definition.name}`}>
              <CardContent className="space-y-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{definition.label}</span>
                  <Badge variant="secondary">{adminTypeLabel(definition.adminType)} type</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{definition.summary}</p>
                <p className="text-xs text-muted-foreground">
                  <code>{definition.name}</code> ·{" "}
                  {role
                    ? `${role.permissionCount ?? role.permissions?.length ?? 0} permissions`
                    : "not provisioned yet (run the permission catalogue migration)"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="space-y-2" aria-labelledby="custom-roles">
        <h2 id="custom-roles" className="text-sm font-semibold">
          Other roles
        </h2>
        {custom.length ? (
          custom.map((role: Role) => (
            <Card key={role._id}>
              <CardContent className="flex flex-wrap justify-between gap-2 p-4">
                <span className="font-medium">{role.label ?? role.name}</span>
                <span className="text-sm text-muted-foreground">
                  {role.scope} · {role.permissionCount ?? role.permissions?.length ?? 0} permissions
                </span>
              </CardContent>
            </Card>
          ))
        ) : (
          <EmptyState title="No custom roles" />
        )}
      </section>
    </div>
  );
}

export function MonitoringView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.MONITORING_VIEW);
  const query = useQuery({
    queryKey: ["admin", "monitoring", "aggregate"],
    queryFn: adminApi.healthAggregate,
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Monitoring" />;
  return (
    <div className="space-y-6">
      {query.isLoading ? (
        <TableSkeleton rows={4} cols={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Monitoring" />
      ) : (
        <AdminRecordCard title="Aggregate health" value={query.data} loading={false} error={null} />
      )}
      <JobsMonitoring />
      {/* retention: email outbox and data retention panels. */}
      <MailMonitoring />
      <RetentionMonitoring />
    </div>
  );
}
