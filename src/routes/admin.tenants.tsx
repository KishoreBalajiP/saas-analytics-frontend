import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { TenantList } from "@/features/admin/components/AdminViews";

export const Route = createFileRoute("/admin/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Tenants"
        description="Create, configure, and manage tenant workspaces."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Tenants" }]}
      />
      <TenantList />
    </AdminPortal>
  ),
});
