import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as adminApi from "@/features/admin/api";
import type { Tenant } from "@/lib/api/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

type LifecycleAction = "suspend" | "restore" | "disable" | "archive";

interface ActionSpec {
  action: LifecycleAction;
  label: string;
  /** Permission the backend route requires. */
  permission: string;
  /** Tenant statuses the backend accepts this transition from. */
  from: readonly string[];
  title: string;
  description: string;
  destructive?: boolean;
}

/** Mirrors backend tenantLifecycle.service transitions and tenant.routes gates. */
const ACTIONS: readonly ActionSpec[] = [
  {
    action: "suspend",
    label: "Suspend",
    permission: Permissions.IAM_TENANTS_SUSPEND,
    from: ["active"],
    title: "Suspend this tenant?",
    description: "Members are signed out and cannot sign in until the tenant is restored.",
  },
  {
    action: "disable",
    label: "Disable",
    permission: Permissions.IAM_TENANTS_SUSPEND,
    from: ["active", "suspended"],
    title: "Disable this tenant?",
    description: "A longer-term block: members are signed out until the tenant is restored.",
  },
  {
    action: "restore",
    label: "Restore",
    permission: Permissions.IAM_TENANTS_RESTORE,
    from: ["suspended", "disabled"],
    title: "Restore this tenant?",
    description: "Members can sign in again.",
  },
  {
    action: "archive",
    label: "Archive",
    permission: Permissions.IAM_TENANTS_DELETE,
    from: ["pending", "active", "suspended", "disabled"],
    title: "Archive this tenant?",
    description:
      "Archiving is permanent: the tenant becomes read-only and cannot be restored. Members are signed out.",
    destructive: true,
  },
];

function runAction(action: LifecycleAction, tenantId: string, reason: string) {
  switch (action) {
    case "suspend":
      return adminApi.suspendTenant(tenantId, reason);
    case "restore":
      return adminApi.restoreTenant(tenantId, reason);
    case "disable":
      return adminApi.disableTenant(tenantId, reason);
    case "archive":
      return adminApi.archiveTenant(tenantId, reason);
  }
}

/**
 * Tenant lifecycle buttons with a confirmation step and an audited reason.
 * Only the transitions the tenant's status allows and the admin's
 * permissions grant are shown.
 */
export function TenantLifecycleActions({
  tenant,
  size = "default",
}: {
  tenant: Pick<Tenant, "_id" | "name" | "status">;
  size?: "default" | "sm";
}) {
  const { permissions } = useAdminSession();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    // The reason travels with the call: the dialog clears its state on close.
    mutationFn: ({ action, reason: why }: { action: LifecycleAction; reason: string }) =>
      runAction(action, tenant._id, why),
    onSuccess: () => {
      toast.success("Tenant status updated");
      setReason("");
      void client.invalidateQueries({ queryKey: ["admin", "tenants"] });
      void client.invalidateQueries({ queryKey: ["admin", "tenant", tenant._id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Unable to update tenant"),
  });

  const available = ACTIONS.filter(
    (spec) => spec.from.includes(tenant.status) && hasPermission(permissions, spec.permission),
  );
  if (available.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((spec) => (
        <AlertDialog key={spec.action} onOpenChange={(open) => !open && setReason("")}>
          <AlertDialogTrigger asChild>
            <Button
              size={size === "sm" ? "sm" : "default"}
              variant={spec.destructive ? "destructive" : "outline"}
              disabled={mutation.isPending}
            >
              {spec.label}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{spec.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {tenant.name}: {spec.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`tenant-${spec.action}-reason`}>
                Reason (recorded in the audit log)
              </Label>
              <Textarea
                id={`tenant-${spec.action}-reason`}
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={!reason.trim()}
                onClick={() => mutation.mutate({ action: spec.action, reason: reason.trim() })}
              >
                {spec.label}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ))}
    </div>
  );
}
