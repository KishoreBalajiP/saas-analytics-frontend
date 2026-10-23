import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppLink } from "@/components/common/AppLink";
import {
  getWorkspaceSecurity,
  updateWorkspaceSecurity,
  workspaceSecurityKey,
} from "@/features/auth/api/tenantSecurity";
import { useTenantSession } from "@/lib/auth/session";
import { hasPermission, Permissions } from "@/lib/permissions";

/** Personal MFA enrollment and the separately governed workspace policy. */
export function WorkspaceSecurityCard() {
  const { me, permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.SECURITY_VIEW);
  const canConfigure = hasPermission(permissions, Permissions.SECURITY_CONFIGURE);
  const [confirmEnable, setConfirmEnable] = useState(false);
  const client = useQueryClient();
  const policy = useQuery({
    queryKey: [...workspaceSecurityKey],
    queryFn: getWorkspaceSecurity,
    enabled: canView,
  });
  const toggle = useMutation({
    mutationFn: (next: boolean) => updateWorkspaceSecurity(next),
    onSuccess: (data) => {
      client.setQueryData([...workspaceSecurityKey], data);
      setConfirmEnable(false);
      toast.success(
        data.mfaRequired
          ? "Workspace MFA requirement enabled"
          : "Workspace MFA requirement disabled",
      );
    },
    onError: () => toast.error("Could not change the workspace security setting. Please retry."),
  });
  const mfa = me?.mfa;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace Security</CardTitle>
        <CardDescription>Two-factor authentication (MFA)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canView ? (
          <div className="space-y-3 border-t pt-4">
            {policy.isPending ? <p role="status">Loading workspace security settings...</p> : null}
            {policy.isError ? (
              <div role="alert" className="space-y-2 text-destructive">
                <p>Could not load workspace security settings.</p>
                <Button type="button" variant="outline" onClick={() => void policy.refetch()}>
                  Retry
                </Button>
              </div>
            ) : null}
            {policy.data ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-medium">Workspace MFA requirement</h3>
                    <p className="mt-1 text-muted-foreground">
                      {policy.data.mfaRequired
                        ? "Members without MFA must enroll before they can use protected workspace features."
                        : "MFA is currently optional for workspace members."}
                    </p>
                  </div>
                  <Badge variant={policy.data.mfaRequired ? "default" : "secondary"}>
                    {policy.data.mfaRequired ? "Required" : "Optional"}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {policy.data.members.mfaEnabled} of {policy.data.members.total} members have MFA
                  enabled.
                </p>
                {!mfa?.enabled && canConfigure ? (
                  <div className="space-y-3 rounded-md border p-3">
                    <p>
                      The workspace owner must set up MFA on their account before requiring it for
                      everyone.
                    </p>
                    <Button asChild>
                      <AppLink to="/profile">Set up MFA</AppLink>
                    </Button>
                  </div>
                ) : mfa?.enabled && canConfigure ? (
                  <>
                    {toggle.isError && !policy.data.mfaRequired ? (
                      <p role="alert" className="text-destructive">
                        Could not enable the workspace requirement. Retry when ready.
                      </p>
                    ) : null}
                    {toggle.isError && policy.data.mfaRequired ? (
                      <p role="alert" className="text-destructive">
                        Could not update the workspace requirement. Please retry.
                      </p>
                    ) : null}
                    <Button
                      variant={policy.data.mfaRequired ? "outline" : "default"}
                      disabled={toggle.isPending}
                      onClick={() =>
                        policy.data?.mfaRequired ? toggle.mutate(false) : setConfirmEnable(true)
                      }
                    >
                      {toggle.isPending
                        ? "Saving..."
                        : policy.data.mfaRequired
                          ? "Stop requiring MFA"
                          : "Require MFA for all workspace members"}
                    </Button>
                  </>
                ) : null}
              </>
            ) : null}
            {canConfigure && mfa?.enabled ? (
              <AlertDialog open={confirmEnable} onOpenChange={setConfirmEnable}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Require MFA for everyone?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Members who have not set up MFA will need to enroll before accessing protected
                      workspace features. Your own account already has MFA enabled.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {toggle.isError ? (
                    <p role="alert" className="text-sm text-destructive">
                      Could not enable the requirement. Please retry.
                    </p>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={toggle.isPending}>Cancel</AlertDialogCancel>
                    <Button onClick={() => toggle.mutate(true)} disabled={toggle.isPending}>
                      {toggle.isPending ? "Enabling..." : "Confirm"}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
