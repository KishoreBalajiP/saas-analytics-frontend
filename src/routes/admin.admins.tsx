import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminList } from "@/features/admin/components/AdminViews";
import { AdminInviteButton } from "@/features/admin/security/AdminInviteDialog";

export const Route = createFileRoute("/admin/admins")({
  head: () => ({ meta: [{ title: "Admins — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Platform Admins"
        description="Manage administrator accounts and roles."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Admins" }]}
        actions={<AdminInviteButton />}
      />
      <AdminList />
    </AdminPortal>
  ),
});
