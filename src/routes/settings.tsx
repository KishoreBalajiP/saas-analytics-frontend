import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Analytics Console" },
      { name: "description", content: "Tenant workspace settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <TenantPortal>
      <PageHeader
        title="Settings"
        description="Configure your workspace preferences and integrations."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Settings" }]}
      />
      <ComingSoon
        title="Workspace Settings"
        description="Tenant configuration, feature flags, and workspace preferences are under development."
      />
    </TenantPortal>
  );
}
