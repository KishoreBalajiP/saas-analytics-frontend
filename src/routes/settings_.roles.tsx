import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { RolesView } from "@/features/members/components/RolesView";

export const Route = createFileRoute("/settings_/roles")({
  head: () => ({
    meta: [
      { title: "Roles — Analytics Console" },
      { name: "description", content: "Workspace roles and permissions." },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  return (
    <TenantPortal>
      <PageHeader
        title="Roles"
        description="Built-in roles and custom roles, with the permissions they grant."
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Settings", to: "/settings" },
          { label: "Roles" },
        ]}
      />
      <RolesView />
    </TenantPortal>
  );
}
