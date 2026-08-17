import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/admins")({
  head: () => ({ meta: [{ title: "Admins — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Platform Admins"
        description="Manage administrator accounts and roles."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Admins" }]}
      />
      <ComingSoon
        title="Admin Management"
        description="CRUD operations for platform administrators, MFA enforcement, role assignment, and suspension."
      />
    </AdminPortal>
  ),
});
