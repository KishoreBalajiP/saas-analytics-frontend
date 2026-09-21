import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as dashboardsApi from "@/features/dashboards/api";
import type { Dashboard, PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

type DashboardRow = Dashboard & Record<string, unknown>;

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function DashboardList() {
  const { permissions } = useTenantSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DashboardRow | null>(null);
  const canView = hasPermission(permissions, Permissions.DASHBOARDS_VIEW);
  const canCreate = hasPermission(permissions, Permissions.DASHBOARDS_CREATE);
  const canDelete = hasPermission(permissions, Permissions.DASHBOARDS_DELETE);

  const query = useQuery({
    queryKey: ["dashboards", "list", { page, limit: 20 }],
    queryFn: () => dashboardsApi.list({ page, limit: 20 }),
    enabled: canView,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dashboardsApi.remove(id),
    onSuccess: () => {
      toast.success("Dashboard deleted");
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to delete dashboard"),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Dashboards" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;
  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Dashboards" />;
  }

  const rows = (query.data?.data ?? []) as DashboardRow[];
  const meta = query.data?.meta as PaginationMeta | undefined;

  if (!rows.length) {
    return (
      <>
        <EmptyState
          title="No dashboards yet"
          description="Create a dashboard to arrange live analytics widgets for your team."
          action={
            canCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Create dashboard
              </Button>
            ) : undefined
          }
        />
        <DashboardFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      </>
    );
  }

  const columns: Column<DashboardRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <AppLink to={`/dashboards/${row._id}` as string} className="font-medium hover:underline">
          {row.name}
        </AppLink>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.description || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge
          variant={row.status === "published" ? "default" : "secondary"}
          className="capitalize"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <AppLink to={`/dashboards/${row._id}` as string}>Open</AppLink>
          </Button>
          {canDelete && (
            <AlertDialog
              open={pendingDelete?._id === row._id}
              onOpenChange={(open) => !open && setPendingDelete(null)}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(row)}
                  aria-label={`Delete ${row.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete dashboard?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes {row.name} and its widgets.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate(row._id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {canCreate && (
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create dashboard
        </Button>
      )}
      <DataTable
        columns={columns}
        data={rows}
        meta={meta}
        onPageChange={setPage}
        getRowId={(row) => row._id}
      />
      <DashboardFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function DashboardFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      dashboardsApi.create({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Dashboard created");
      setName("");
      setDescription("");
      setError("");
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
    onError: (cause) =>
      setError(cause instanceof Error ? cause.message : "Unable to create dashboard"),
  });

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create dashboard"
      description="Give your dashboard a clear name and optional description."
      submitLabel="Create"
      pending={mutation.isPending}
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          setError("Name is required.");
          return;
        }
        if (name.trim().length > 120) {
          setError("Name must be 120 characters or fewer.");
          return;
        }
        if (description.trim().length > 500) {
          setError("Description must be 500 characters or fewer.");
          return;
        }
        setError("");
        mutation.mutate();
      }}
    >
      <label className="space-y-1 text-sm">
        <span className="font-medium">Name</span>
        <input
          className="h-9 w-full rounded-md border border-input bg-background px-3"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Description</span>
        <textarea
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
    </DashboardDialog>
  );
}

export function DashboardDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  pending,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  pending: boolean;
  error: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
