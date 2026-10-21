import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { PlatformSettingsView } from "@/features/platform-config/components/PlatformSettingsView";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform settings — Admin Portal" },
      { name: "description", content: "Platform defaults inherited by every workspace." },
    ],
  }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Platform settings"
        description="Platform defaults that every workspace inherits unless it overrides them. Changes are validated, versioned and audited."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Settings" }]}
      />
      <PlatformSettingsView />
    </AdminPortal>
  ),
});
