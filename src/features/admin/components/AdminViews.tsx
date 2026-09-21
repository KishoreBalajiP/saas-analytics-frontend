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
import type {
  AccessLog,
  AuditLog,
  PaginationMeta,
  PlatformAdmin,
  Role,
  Tenant,
} from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useAdminSession } from "@/lib/auth/session";

function date(value?: string) {
  return value ? new Date(value).toLocaleString() : "—";
}
export function AdminOverview() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.MONITORING_VIEW);
  const query = useQuery({
    queryKey: ["admin", "health", "aggregate"],
    queryFn: adminApi.healthAggregate,
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Admin overview" />;
  if (query.isLoading) return <TableSkeleton rows={4} cols={2} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="System health" />
    );
  const data = query.data ?? {};
  const entries = Object.entries(data);
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>
      {entries.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">{key.replace(/[-_]/g, " ")}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {typeof value === "object" ? "Available" : String(value ?? "—")}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No health data"
          description="The monitoring service returned no aggregate metrics."
        />
      )}
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
  const client = useQueryClient();
  const { permissions } = useAdminSession();
  const canSuspend = hasPermission(permissions, Permissions.IAM_TENANTS_SUSPEND);
  const canRestore = hasPermission(permissions, Permissions.IAM_TENANTS_RESTORE);
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "restore" }) =>
      action === "suspend"
        ? adminApi.suspendTenant(id, "Administrative action")
        : adminApi.restoreTenant(id),
    onSuccess: () => {
      toast.success("Tenant status updated");
      void client.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to update tenant"),
  });
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
      render: (tenant) =>
        tenant.status === "active" && canSuspend ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => mutation.mutate({ id: tenant._id, action: "suspend" })}
            disabled={mutation.isPending}
          >
            Suspend
          </Button>
        ) : canRestore ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => mutation.mutate({ id: tenant._id, action: "restore" })}
            disabled={mutation.isPending}
          >
            Restore
          </Button>
        ) : null,
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
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      if (!slug.trim() || !name.trim() || !email.trim() || !ownerName.trim())
        throw new Error("Tenant and owner fields are required.");
      return adminApi.createTenant({
        slug: slug.trim(),
        name: name.trim(),
        owner: { email: email.trim(), name: ownerName.trim() },
      });
    },
    onSuccess: () => {
      toast.success("Tenant created");
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
            Slug
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} />
          </Label>
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
    </div>
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
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_ADMINS_VIEW);
  const query = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: () => adminApi.listAdmins({ page: 1, limit: 50 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Platform admins" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Platform admins" />
    );
  const rows = query.data?.data ?? [];
  return rows.length ? (
    <div className="space-y-2">
      {rows.map((admin) => (
        <Card key={admin._id}>
          <CardContent className="flex flex-wrap justify-between gap-2 p-4">
            <span className="font-medium">{admin.name || admin.email}</span>
            <span className="text-sm text-muted-foreground">
              {admin.email} · {admin.adminType}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <EmptyState title="No platform admins" />
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
  return roles.length ? (
    <div className="space-y-2">
      {roles.map((role) => (
        <Card key={role._id}>
          <CardContent className="flex flex-wrap justify-between gap-2 p-4">
            <span className="font-medium">{role.name}</span>
            <span className="text-sm text-muted-foreground">
              {role.scope} · {role.permissions?.length ?? 0} permissions
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <EmptyState title="No roles" />
  );
}

export function AuditLogList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.AUDIT_LOGS_VIEW);
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => adminApi.listAuditLogs({ page, limit: 25 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Audit logs" />;
  if (query.isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Audit logs" />;
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  const columns: Column<AuditLog & Record<string, unknown>>[] = [
    { key: "actor", header: "Actor", render: (log) => <span>{log.actor?.id ?? "system"}</span> },
    {
      key: "action",
      header: "Action",
      render: (log) => <code className="text-xs">{log.action}</code>,
    },
    { key: "module", header: "Module", render: (log) => <span>{log.module}</span> },
    {
      key: "resource",
      header: "Resource",
      render: (log) => <span>{log.resource?.type ?? "—"}</span>,
    },
    {
      key: "createdAt",
      header: "Timestamp",
      render: (log) => <span className="text-xs text-muted-foreground">{date(log.createdAt)}</span>,
    },
  ];
  const tableRows = rows as Array<AuditLog & Record<string, unknown>>;
  return tableRows.length ? (
    <DataTable
      columns={columns}
      data={tableRows}
      {...(meta ? { meta } : {})}
      onPageChange={setPage}
      getRowId={(log) => String(log["_id"])}
    />
  ) : (
    <EmptyState title="No audit events" />
  );
}

export function AccessLogList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.ACCESS_LOGS_VIEW);
  const query = useQuery({
    queryKey: ["admin", "access-logs"],
    queryFn: () => adminApi.listAccessLogs({ page: 1, limit: 50 }),
    enabled: canView,
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Access logs" />;
  if (query.isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Access logs" />
    );
  const rows = query.data?.data ?? [];
  return rows.length ? (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-3">Method</th>
            <th className="p-3">Path</th>
            <th className="p-3">Status</th>
            <th className="p-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((log: AccessLog) => (
            <tr key={log._id} className="border-b">
              <td className="p-3">{log.method}</td>
              <td className="p-3 font-mono text-xs">{log.path}</td>
              <td className="p-3">{log.status}</td>
              <td className="p-3 text-muted-foreground">{date(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title="No access events" />
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
  if (query.isLoading) return <TableSkeleton rows={4} cols={2} />;
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Monitoring" />;
  return (
    <AdminRecordCard title="Aggregate health" value={query.data} loading={false} error={null} />
  );
}

export function SupportLookup() {
  const { permissions } = useAdminSession();
  const canLookup = hasPermission(permissions, Permissions.SUPPORT_LOOKUP);
  const [tenantId, setTenantId] = useState("");
  const [submitted, setSubmitted] = useState("");
  const query = useQuery({
    queryKey: ["admin", "support", submitted],
    queryFn: () => adminApi.tenantLookups(submitted),
    enabled: canLookup && Boolean(submitted),
  });
  if (!canLookup) return <ErrorState error={{ statusCode: 403 }} resource="Support lookup" />;
  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(tenantId.trim());
        }}
      >
        <Input
          placeholder="Tenant ID"
          value={tenantId}
          onChange={(event) => setTenantId(event.target.value)}
          aria-label="Tenant ID"
        />
        <Button type="submit">
          <Search className="mr-1 h-4 w-4" /> Lookup
        </Button>
      </form>
      {submitted && query.isLoading && <TableSkeleton rows={3} cols={2} />}
      {submitted && query.isError && (
        <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Tenant lookup" />
      )}
      {submitted && query.data && (
        <AdminRecordCard title="Tenant lookup" value={query.data} loading={false} error={null} />
      )}
    </div>
  );
}
