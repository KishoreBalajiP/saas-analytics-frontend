import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { RoleList } from "@/features/admin/components/AdminViews";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Roles — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Roles & Permissions"
        description="Define roles and assign fine-grained permissions."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Roles" }]}
      />
      <RoleList />
    </AdminPortal>
  ),
});
