import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Analytics Console" },
      { name: "description", content: "Manage your profile and security settings." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { me } = useTenantSession();

  return (
    <TenantPortal>
      <PageHeader
        title="Profile & Security"
        description="Manage your account settings, password, and multi-factor authentication."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Profile" }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium">{me?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Roles:</span>{" "}
              <span className="font-medium">{me?.roles?.join(", ") ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">MFA:</span>{" "}
              <span className="font-medium">{me?.mfaEnabled ? "Enabled" : "Not enabled"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Password & MFA</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Profile editing, password change, and MFA enrollment will be available in a future
            release.
          </CardContent>
        </Card>
      </div>
    </TenantPortal>
  );
}
