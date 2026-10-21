import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { errorMessage } from "@/features/admin/security/errors";
import {
  getWorkspaceSecurity,
  updateWorkspaceSecurity,
  workspaceSecurityKey,
} from "@/features/auth/api/tenantSecurity";
import { useTenantSession } from "@/lib/auth/session";
import { hasPermission, Permissions } from "@/lib/permissions";

/** mfa-tenant: the workspace "MFA required" policy (Owner configures). */
export function WorkspaceSecurityCard() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.SECURITY_VIEW);
  const canConfigure = hasPermission(permissions, Permissions.SECURITY_CONFIGURE);
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
      toast.success(data.mfaRequired ? "MFA is now required" : "MFA is no longer required");
    },
    onError: (error) => toast.error(errorMessage(error, "Could not change the policy")),
  });
  if (!canView || !policy.data) return null;
  const { mfaRequired, members } = policy.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workspace security</CardTitle>
        <CardDescription>
          {members.mfaEnabled} of {members.total} members use MFA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>Require MFA for every member: {mfaRequired ? "On" : "Off"}</p>
        {canConfigure ? (
          <Button
            variant="outline"
            disabled={toggle.isPending}
            onClick={() => toggle.mutate(!mfaRequired)}
          >
            {mfaRequired ? "Stop requiring MFA" : "Require MFA"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
