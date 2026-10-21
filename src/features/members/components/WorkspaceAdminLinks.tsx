import { ChevronRight, KeyRound, ShieldAlert, Users } from "lucide-react";

import { AppLink } from "@/components/common/AppLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasAnyPermission, hasPermission } from "@/lib/permissions";

/** Settings entry points for members, roles and the Owner's danger zone. */
export function WorkspaceAdminLinks() {
  const { permissions } = useTenantSession();
  const links = [
    {
      to: "/settings/members",
      label: "Members",
      description: "People in this workspace, their roles, and invitations",
      icon: Users,
      visible: hasPermission(permissions, Permissions.USERS_VIEW),
    },
    {
      to: "/settings/roles",
      label: "Roles",
      description: "Built-in roles and your custom roles",
      icon: KeyRound,
      visible: hasPermission(permissions, Permissions.ROLES_VIEW),
    },
    {
      to: "/settings/workspace",
      label: "Ownership and deletion",
      description: "Transfer ownership or delete the workspace (Owners only)",
      icon: ShieldAlert,
      visible: hasAnyPermission(
        permissions,
        Permissions.WORKSPACE_TRANSFER,
        Permissions.WORKSPACE_DELETE,
      ),
    },
  ].filter((link) => link.visible);
  if (!links.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members and access</CardTitle>
        <CardDescription>Manage who can use this workspace and what they can do.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {links.map((link) => (
          <AppLink
            key={link.to}
            to={link.to}
            className="flex items-center gap-3 py-3 text-sm hover:text-primary"
          >
            <link.icon className="h-4 w-4" />
            <span className="flex-1">
              <span className="block font-medium">{link.label}</span>
              <span className="block text-xs text-muted-foreground">{link.description}</span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </AppLink>
        ))}
      </CardContent>
    </Card>
  );
}
