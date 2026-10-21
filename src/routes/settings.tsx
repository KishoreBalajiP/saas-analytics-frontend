import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceFeaturesCard } from "@/features/feature-flags/components/WorkspaceFeaturesCard";
// backups: workspace data export (roadmap 2.9).
import { DataExportCard } from "@/features/data-export/components/DataExportCard";
import { WorkspaceSecurityCard } from "@/features/auth/mfa/WorkspaceSecurityCard";
import { WorkspaceTimezoneCard } from "@/features/workspace-settings/components/WorkspaceTimezoneCard";
// support: tenant consent for read-only support sessions (roadmap 2.3).
import { SupportAccessCard } from "@/features/support/components/SupportAccessCard";
// members: members, roles and ownership entry points (roadmap 2.10).
import { WorkspaceAdminLinks } from "@/features/members/components/WorkspaceAdminLinks";

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
      <div className="space-y-6">
        <WorkspaceTimezoneCard />
        <SupportAccessCard />
        {/* members: members, roles and ownership entry points (roadmap 2.10). */}
        <WorkspaceAdminLinks />
        <WorkspaceFeaturesCard />
        {/* backups: workspace data export (roadmap 2.9). */}
        <DataExportCard />
        <WorkspaceSecurityCard />
      </div>
    </TenantPortal>
  );
}
