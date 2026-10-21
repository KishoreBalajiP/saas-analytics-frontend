import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { DangerZone } from "@/features/members/components/DangerZone";

export const Route = createFileRoute("/settings_/workspace")({
  head: () => ({
    meta: [
      { title: "Ownership and deletion — Analytics Console" },
      { name: "description", content: "Transfer ownership or delete the workspace." },
    ],
  }),
  component: WorkspaceDangerPage,
});

function WorkspaceDangerPage() {
  return (
    <TenantPortal>
      <PageHeader
        title="Ownership and deletion"
        description="Owner-only actions: transfer ownership or delete this workspace."
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Settings", to: "/settings" },
          { label: "Ownership and deletion" },
        ]}
      />
      <DangerZone />
    </TenantPortal>
  );
}
