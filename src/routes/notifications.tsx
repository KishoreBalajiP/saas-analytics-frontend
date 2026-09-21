import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  NotificationsView,
  NotificationPreferences,
} from "@/features/notifications/components/NotificationsView";

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
      <div className="space-y-6">
        <NotificationsView />
        <NotificationPreferences />
      </div>
    </TenantPortal>
  ),
});
