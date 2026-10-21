import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as adminApi from "@/features/admin/api";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

/**
 * Access-request review queue. Viewing needs `iam.access_requests.view`;
 * approving or rejecting needs `iam.access_requests.approve`, and approval
 * only invites as Viewer or Manager (backend allow-list).
 */
export function AccessRequestList() {
  const { permissions } = useAdminSession();
  const canView = hasPermission(permissions, Permissions.IAM_ACCESS_REQUESTS_VIEW);
  const canDecide = hasPermission(permissions, Permissions.IAM_ACCESS_REQUESTS_APPROVE);
  const client = useQueryClient();
  const requests = useQuery({
    queryKey: ["admin", "access-requests"],
    queryFn: () => adminApi.listAccessRequests(),
    enabled: canView,
  });
  const [tenantIds, setTenantIds] = useState<Record<string, string>>({});
  const [roles, setRoles] = useState<Record<string, adminApi.ApprovableRole>>({});
  const decide = useMutation<unknown, Error, { id: string; approve: boolean }>({
    mutationFn: ({ id, approve }) =>
      approve
        ? adminApi.approveAccessRequest(id, tenantIds[id] ?? "", roles[id] ?? "Viewer")
        : adminApi.rejectAccessRequest(id),
    onSuccess: () => {
      toast.success("Access request updated");
      void client.invalidateQueries({ queryKey: ["admin", "access-requests"] });
    },
    onError: (error) => toast.error(error.message || "Unable to update request"),
  });

  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Access requests" />;
  if (requests.isLoading) return <TableSkeleton rows={4} cols={3} />;
  if (requests.isError)
    return (
      <ErrorState
        error={requests.error}
        onRetry={() => requests.refetch()}
        resource="Access requests"
      />
    );
  const rows = requests.data?.data ?? [];
  if (!rows.length) return <EmptyState title="No pending requests" />;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map((item) => (
            <div key={item.id} className="space-y-3 p-5" data-testid={`access-request-${item.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {item.name} · {item.email}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.workspaceName} · {item.reference}
                  </p>
                  {item.reason ? <p className="mt-2 text-sm">{item.reason}</p> : null}
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize">
                  {item.status}
                </span>
              </div>
              {item.status === "pending" && canDecide ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    aria-label={`Tenant ID for ${item.reference}`}
                    placeholder="Existing workspace ID"
                    value={tenantIds[item.id] ?? ""}
                    onChange={(event) =>
                      setTenantIds((current) => ({ ...current, [item.id]: event.target.value }))
                    }
                  />
                  <select
                    aria-label={`Role for ${item.reference}`}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={roles[item.id] ?? "Viewer"}
                    onChange={(event) =>
                      setRoles((current) => ({
                        ...current,
                        [item.id]: event.target.value as adminApi.ApprovableRole,
                      }))
                    }
                  >
                    {adminApi.APPROVABLE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => decide.mutate({ id: item.id, approve: true })}
                    disabled={decide.isPending || !(tenantIds[item.id] ?? "")}
                  >
                    Approve & invite
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => decide.mutate({ id: item.id, approve: false })}
                    disabled={decide.isPending}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
