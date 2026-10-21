import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { MembersView } from "@/features/members/components/MembersView";

export const Route = createFileRoute("/settings_/members")({
  head: () => ({
    meta: [
      { title: "Members — Analytics Console" },
      { name: "description", content: "Workspace members, roles and invitations." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  return (
    <TenantPortal>
      <PageHeader
        title="Members"
        description="People in this workspace, their roles and status, and invitations."
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Settings", to: "/settings" },
          { label: "Members" },
        ]}
      />
      <MembersView />
    </TenantPortal>
  );
}
