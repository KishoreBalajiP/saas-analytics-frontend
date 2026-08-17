import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FileSpreadsheet, Globe, Plus, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { CreateConnectorDialog } from "@/components/connectors/CreateConnectorDialog";
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
import { ApiError } from "@/lib/api/client";
import * as connectorsApi from "@/lib/api/connectors";
import type { ConnectorType, PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  ConnectorType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  csv: { label: "CSV", icon: FileSpreadsheet },
  xlsx: { label: "XLSX", icon: FileSpreadsheet },
  mongodb: { label: "MongoDB", icon: Database },
  webhook: { label: "Webhook", icon: Webhook },
};

function statusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "paused") return "secondary" as const;
  return "destructive" as const;
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

interface ConnectorRow extends Record<string, unknown> {
  _id: string;
  name: string;
  type: ConnectorType;
  status: string;
  lastSyncedAt?: string | null;
}

export function ConnectorList() {
  const { permissions } = useTenantSession();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [pendingDelete, setPendingDelete] = useState<ConnectorRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const canView = hasPermission(permissions, Permissions.CONNECTORS_VIEW);
  const canDelete = hasPermission(permissions, Permissions.CONNECTORS_DELETE);

  const query = useQuery({
    queryKey: ["connectors", "list", { page, search, type: typeFilter }],
    queryFn: () =>
      connectorsApi.list({
        page,
        limit: 25,
        ...(search ? { search } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
      }),
    enabled: canView,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => connectorsApi.remove(id),
    onSuccess: () => {
      toast.success("Connector deleted");
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
      setPendingDelete(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete connector");
    },
  });

  if (!canView) {
    return <ErrorState error={new ApiError("Permission required", 403)} resource="Connectors" />;
  }

  const columns: Column<ConnectorRow>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <AppLink to={`/datasets/${row._id}` as string} className="font-medium hover:underline">
          {row.name}
        </AppLink>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (row) => {
        const meta = TYPE_META[row.type];
        const Icon = meta.icon;
        return (
          <Badge variant="outline" className="gap-1 font-normal">
            <Icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={statusVariant(row.status)} className="capitalize">
          {row.status}
        </Badge>
      ),
    },
    {
      key: "lastSyncedAt",
      header: "Last synced",
      render: (row) => (
        <span className={cn("text-xs text-muted-foreground")}>{formatDate(row.lastSyncedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <AppLink to={`/datasets/${row._id}` as string}>View</AppLink>
          </Button>
          {canDelete ? (
            <AlertDialog
              open={pendingDelete?._id === row._id}
              onOpenChange={(open) => {
                if (!open) setPendingDelete(null);
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(row)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete connector?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete <strong>{row.name}</strong>. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMutation.mutate(row._id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting…" : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      ),
    },
  ];

  if (query.isLoading) return <TableSkeleton rows={5} cols={4} />;

  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Connectors" />;

  const rows = (query.data?.data ?? []) as ConnectorRow[];
  const meta = query.data?.meta as PaginationMeta | undefined;

  if (!rows.length) {
    return (
      <>
        <EmptyState
          title="No connectors yet"
          description="Create your first connector to start ingesting data from CSV, XLSX, MongoDB, or a webhook."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create connector
            </Button>
          }
        />
        <CreateConnectorDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["connectors"] });
            setCreateOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New connector
        </Button>
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Search connectors…"
          className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Search connectors"
        />
        <select
          value={typeFilter}
          onChange={(event) => {
            setPage(1);
            setTypeFilter(event.target.value);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Filter by connector type"
        >
          <option value="">All types</option>
          <option value="csv">CSV</option>
          <option value="xlsx">XLSX</option>
          <option value="mongodb">MongoDB</option>
          <option value="webhook">Webhook</option>
        </select>
      </div>

      <DataTable<ConnectorRow>
        columns={columns}
        data={rows}
        meta={meta}
        onPageChange={setPage}
        getRowId={(row) => row._id}
      />

      <CreateConnectorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["connectors"] });
          setCreateOpen(false);
        }}
      />
    </div>
  );
}
