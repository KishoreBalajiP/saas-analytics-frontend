import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Roles — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Roles & Permissions"
        description="Define roles and assign fine-grained permissions."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Roles" }]}
      />
      <ComingSoon
        title="Role Management"
        description="Create and manage platform and tenant-scoped roles, grant and revoke permissions, and view the module catalogue."
      />
    </AdminPortal>
  ),
});
