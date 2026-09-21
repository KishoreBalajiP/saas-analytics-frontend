import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { SupportLookup } from "@/features/admin/components/AdminViews";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Support"
        description="Impersonate users, recover accounts, and send broadcasts."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Support" }]}
      />
      <SupportLookup />
    </AdminPortal>
  ),
});
