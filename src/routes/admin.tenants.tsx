import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Tenants"
        description="Create, configure, and manage tenant workspaces."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Tenants" }]}
      />
      <ComingSoon
        title="Tenant Management"
        description="Full tenant CRUD, lifecycle management (suspend/restore/disable/archive), onboarding, members, settings, and billing."
      />
    </AdminPortal>
  ),
});
