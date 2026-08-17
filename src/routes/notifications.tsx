import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [{ title: "Notifications — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Notifications"
        description="View alerts, report completions, and system messages."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Notifications" }]}
      />
      <ComingSoon
        title="Notification Inbox"
        description="View, filter, and manage notifications including alert triggers, report completions, and broadcasts."
      />
    </TenantPortal>
  ),
});
