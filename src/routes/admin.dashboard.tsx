import { createFileRoute } from "@tanstack/react-router";
import { Activity, Building2, Shield, Users } from "lucide-react";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminSession } from "@/lib/auth/session";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Analytics Console" },
      { name: "description", content: "Platform administration overview." },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { me } = useAdminSession();

  return (
    <AdminPortal>
      <PageHeader
        title="Admin Dashboard"
        description={`Signed in as ${me?.email} (${me?.adminType ?? "admin"})`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: "Tenants",
            icon: Building2,
            desc: "Manage tenant workspaces",
            to: "/admin/tenants",
          },
          {
            title: "Admins",
            icon: Shield,
            desc: "Manage platform administrators",
            to: "/admin/admins",
          },
          { title: "Users", icon: Users, desc: "Tenant user management", to: "/admin/tenants" },
          {
            title: "Activity",
            icon: Activity,
            desc: "Audit and access logs",
            to: "/admin/audit-logs",
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon className="h-4 w-4 text-primary" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <ComingSoon
          title="System Overview"
          description="Real-time system health, tenant statistics, and recent audit events will be displayed here."
        />
      </div>
    </AdminPortal>
  );
}
