import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { FeatureFlagsView } from "@/features/platform-config/components/FeatureFlagsView";

export const Route = createFileRoute("/admin/feature-flags")({
  head: () => ({
    meta: [
      { title: "Feature flags — Admin Portal" },
      { name: "description", content: "Roll features out to workspaces." },
    ],
  }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Feature flags"
        description="Roll features out to every workspace, an allow-list, or a stable percentage of workspaces."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Feature flags" }]}
      />
      <FeatureFlagsView />
    </AdminPortal>
  ),
});
