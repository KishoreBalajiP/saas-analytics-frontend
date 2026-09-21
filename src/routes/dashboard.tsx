import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, Database, FileText, ShieldAlert } from "lucide-react";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantSession } from "@/lib/auth/session";
import { AppLink } from "@/components/common/AppLink";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Analytics Console" },
      { name: "description", content: "Tenant analytics overview." },
    ],
  }),
  component: DashboardPage,
});

export function DashboardPage() {
  return (
    <TenantPortal>
      <DashboardContent />
    </TenantPortal>
  );
}

function DashboardContent() {
  const { me, tenantSlug } = useTenantSession();

  const quickLinks = [
    { to: "/datasets", label: "Datasets", icon: Database, desc: "Connect and manage data sources" },
    { to: "/analytics", label: "Analytics", icon: BarChart3, desc: "Query and explore your data" },
    {
      to: "/dashboards",
      label: "Dashboards",
      icon: BarChart3,
      desc: "Visualize metrics in real time",
    },
    { to: "/reports", label: "Reports", icon: FileText, desc: "Schedule and export reports" },
    {
      to: "/alerts",
      label: "Alerts",
      icon: ShieldAlert,
      desc: "Monitor conditions and get notified",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${me?.profile?.name ?? me?.email ?? "user"}`}
        description={`Tenant: ${tenantSlug ?? me?.tenantId ?? "—"}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <AppLink key={link.to} to={link.to}>
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <link.icon className="h-4 w-4 text-primary" />
                  {link.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{link.desc}</p>
              </CardContent>
            </Card>
          </AppLink>
        ))}
      </div>
    </>
  );
}
