import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Database, FileText, ShieldAlert, Sparkles } from "lucide-react";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantSession } from "@/lib/auth/session";
import { AppLink } from "@/components/common/AppLink";
import * as connectorsApi from "@/features/datasets/api";
import * as dashboardsApi from "@/features/dashboards/api";
import { ErrorState } from "@/components/common/states";

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
  const connectorsQuery = useQuery({
    queryKey: ["connectors", "onboarding-status"],
    queryFn: () => connectorsApi.list({ page: 1, limit: 100 }),
  });
  const dashboardsQuery = useQuery({
    queryKey: ["dashboards", "onboarding-status"],
    queryFn: () => dashboardsApi.list({ page: 1, limit: 100 }),
  });
  const hasSyncedSource = (connectorsQuery.data?.data ?? []).some(
    (connector) =>
      (connector.type === "csv" || connector.type === "xlsx") && Boolean(connector.lastSyncedAt),
  );
  const hasDashboard = (dashboardsQuery.data?.data.length ?? 0) > 0;
  const setupComplete = hasSyncedSource && hasDashboard;
  const setupUnavailable = connectorsQuery.isError || dashboardsQuery.isError;

  // Helper to check if skeleton should be shown
  const isLoading = connectorsQuery.isLoading || dashboardsQuery.isLoading;

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

      {!isLoading && (
        <Card
          className={`mb-6 ${setupComplete ? "border-emerald-600/30 bg-emerald-600/5" : "border-primary/20 bg-primary/5"}`}
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles
                className={`h-4 w-4 ${setupComplete ? "text-emerald-700" : "text-primary"}`}
              />
              {setupUnavailable
                ? "Workspace setup status unavailable"
                : setupComplete
                  ? "Workspace setup complete"
                  : "Finish your workspace setup"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              {setupUnavailable
                ? "We could not confirm setup progress from the server."
                : setupComplete
                  ? "Your first file source has synced and your workspace has a dashboard."
                  : "Connect and sync a file source, then create your first dashboard. You can leave and resume later."}
            </p>
            <Button asChild variant="default" className="w-fit">
              <AppLink to="/onboarding">
                {setupUnavailable
                  ? "Check setup"
                  : setupComplete
                    ? "Review setup"
                    : "Continue setup"}
              </AppLink>
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? <Skeleton className="h-6 w-6 rounded-md my-8" /> : null}

      <ErrorState
        error={setupUnavailable ? connectorsQuery.error : dashboardsQuery.error}
        resource="Dashboard"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <AppLink key={link.to} to={link.to}>
            <Card className="transition-colors hover:bg-primary/5">
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
