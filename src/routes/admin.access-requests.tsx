import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as adminApi from "@/features/admin/api";

export const Route = createFileRoute("/admin/access-requests")({ component: AccessRequestsPage });

function AccessRequestsPage() {
  const client = useQueryClient();
  const requests = useQuery({
    queryKey: ["admin", "access-requests"],
    queryFn: () => adminApi.listAccessRequests(),
  });
  const [tenantIds, setTenantIds] = useState<Record<string, string>>({});
  const decide = useMutation<Record<string, unknown>, Error, { id: string; approve: boolean }>({
    mutationFn: ({ id, approve }) =>
      approve
        ? adminApi.approveAccessRequest(id, tenantIds[id] ?? "")
        : adminApi
            .rejectAccessRequest(id)
            .then((value) => value as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success("Access request updated");
      void client.invalidateQueries({ queryKey: ["admin", "access-requests"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to update request"),
  });
  return (
    <AdminPortal>
      <PageHeader
        title="Access requests"
        description="Review requests before sending workspace invitations."
      />
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {requests.data?.data.map((item) => (
              <div key={item.id} className="space-y-3 p-5">
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
                {item.status === "pending" ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      aria-label={`Tenant ID for ${item.reference}`}
                      placeholder="Existing workspace ID"
                      value={tenantIds[item.id] ?? ""}
                      onChange={(event) =>
                        setTenantIds((current) => ({ ...current, [item.id]: event.target.value }))
                      }
                    />
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
            {requests.data?.data.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No pending requests.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </AdminPortal>
  );
}
