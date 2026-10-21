import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { SupportConsole } from "@/features/support/components/SupportConsole";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Support"
        description="Diagnostics first. Consented, read-only, time-boxed support sessions, break-glass approvals and account tools."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Support" }]}
      />
      <SupportConsole />
    </AdminPortal>
  ),
});
