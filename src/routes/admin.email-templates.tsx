import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmailTemplatesView } from "@/features/platform-config/components/EmailTemplatesView";

export const Route = createFileRoute("/admin/email-templates")({
  head: () => ({
    meta: [
      { title: "Email templates — Admin Portal" },
      { name: "description", content: "Edit transactional email templates." },
    ],
  }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Email templates"
        description="Customise the transactional emails the platform sends. Previews are never sent."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Email templates" }]}
      />
      <EmailTemplatesView />
    </AdminPortal>
  ),
});
