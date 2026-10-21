import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as adminApi from "@/features/admin/api";
import { adminScopeOf } from "@/features/admin/roles";
import type { ComplianceRequest, ComplianceRequestType, PaginationMeta } from "@/lib/api/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

const REQUEST_TYPES: { value: ComplianceRequestType; label: string }[] = [
  { value: "export", label: "Export" },
  { value: "delete", label: "Delete" },
  { value: "restrict", label: "Restrict processing" },
  { value: "consent.withdraw", label: "Withdraw consent" },
];

/** Requests can only be cancelled before work starts. */
const CANCELLABLE = new Set(["received"]);

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/**
 * Data-subject requests (GDPR/CCPA): list for `compliance.view`, file for
 * `compliance.create`, cancel for `compliance.update`. Tenant-scoped admins
 * only see and file requests for their own tenant (enforced by the API).
 */
export function ComplianceView() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.COMPLIANCE_VIEW);
  const canCreate = hasPermission(permissions, Permissions.COMPLIANCE_CREATE);
  const canCancel = hasPermission(permissions, Permissions.COMPLIANCE_UPDATE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({
    queryKey: ["admin", "compliance", page],
    queryFn: () => adminApi.listComplianceRequests({ page, limit: 20 }),
    enabled: canView,
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Compliance requests" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={5} />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        onRetry={() => query.refetch()}
        resource="Compliance requests"
      />
    );

  const rows = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  const columns: Column<ComplianceRequest & Record<string, unknown>>[] = [
    {
      key: "requestId",
      header: "Request",
      render: (row) => <code className="text-xs">{row.requestId}</code>,
    },
    { key: "type", header: "Type", render: (row) => <span>{row.type}</span> },
    {
      key: "subject",
      header: "Subject",
      render: (row) => (
        <span className="text-sm">
          {row.subjectType}: {row.subjectEmail || row.subjectId}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge
          variant={row.status === "completed" ? "default" : "secondary"}
          className="capitalize"
        >
          {String(row.status).replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Filed",
      render: (row) => <span className="text-xs text-muted-foreground">{date(row.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (row) =>
        canCancel && CANCELLABLE.has(String(row.status)) ? (
          <CancelRequestButton requestId={row.requestId} />
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen((open) => !open)}>
            <Plus className="mr-1 h-4 w-4" /> File request
          </Button>
        </div>
      )}
      {createOpen && canCreate && <ComplianceRequestForm onClose={() => setCreateOpen(false)} />}
      {rows.length ? (
        <DataTable
          columns={columns}
          data={rows as Array<ComplianceRequest & Record<string, unknown>>}
          {...(meta ? { meta } : {})}
          onPageChange={setPage}
          getRowId={(row) => String(row["requestId"])}
        />
      ) : (
        <EmptyState
          title="No compliance requests"
          description="Data-subject requests filed by administrators or subjects appear here."
        />
      )}
    </div>
  );
}

function CancelRequestButton({ requestId }: { requestId: string }) {
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: (why: string) => adminApi.cancelComplianceRequest(requestId, why || undefined),
    onSuccess: () => {
      toast.success("Compliance request cancelled");
      void client.invalidateQueries({ queryKey: ["admin", "compliance"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to cancel request"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={mutation.isPending}>
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
          <AlertDialogDescription>
            Request {requestId} will not be processed. This is recorded in the audit log.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`cancel-${requestId}`}>Reason</Label>
          <Textarea
            id={`cancel-${requestId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep request</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate(reason.trim())}>
            Cancel request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ComplianceRequestForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const { me } = useAdminSession();
  const scope = adminScopeOf(me);
  const [subjectType, setSubjectType] = useState<"user" | "tenant">("user");
  const [subjectId, setSubjectId] = useState("");
  const [subjectEmail, setSubjectEmail] = useState("");
  const [type, setType] = useState<ComplianceRequestType>("export");
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createComplianceRequest({
        subjectId: subjectId.trim(),
        subjectType,
        type,
        reason: reason.trim(),
        ...(subjectEmail.trim() ? { subjectEmail: subjectEmail.trim() } : {}),
        ...(scope.type === "tenant" && scope.tenantId ? { tenantScope: [scope.tenantId] } : {}),
      }),
    onSuccess: (result) => {
      toast.success(`Request ${result.requestId} filed`);
      void client.invalidateQueries({ queryKey: ["admin", "compliance"] });
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to file the request"),
  });
  const valid = subjectId.trim().length > 0 && reason.trim().length >= 3;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">File a data-subject request</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="dsr-subject-type">Subject type</Label>
            <select
              id="dsr-subject-type"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={subjectType}
              onChange={(event) => setSubjectType(event.target.value as "user" | "tenant")}
            >
              <option value="user">User</option>
              <option value="tenant">Tenant</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dsr-subject-id">Subject ID</Label>
            <Input
              id="dsr-subject-id"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              placeholder={subjectType === "user" ? "User ID" : "Tenant ID"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dsr-subject-email">Subject email (optional)</Label>
            <Input
              id="dsr-subject-email"
              type="email"
              value={subjectEmail}
              onChange={(event) => setSubjectEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dsr-type">Request type</Label>
            <select
              id="dsr-type"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={type}
              onChange={(event) => setType(event.target.value as ComplianceRequestType)}
            >
              {REQUEST_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="dsr-reason">Reason (recorded in the audit log)</Label>
            <Textarea
              id="dsr-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
            />
          </div>
          <div className="sm:col-span-2">
            <InlineFieldErrors error={mutation.error} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending ? "Filing…" : "File request"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
