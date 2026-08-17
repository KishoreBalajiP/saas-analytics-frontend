import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Support"
        description="Impersonate users, recover accounts, and send broadcasts."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Support" }]}
      />
      <ComingSoon
        title="Support Tools"
        description="User impersonation, account recovery, session revocation, tenant lookups, and notification broadcasts."
      />
    </AdminPortal>
  ),
});
