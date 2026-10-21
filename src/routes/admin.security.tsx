import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminSecurityPanel } from "@/features/admin/security/AdminSecurityPanel";

export const Route = createFileRoute("/admin/security")({
  head: () => ({ meta: [{ title: "Account security - Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Account security"
        description="Multi-factor authentication, recovery codes and password."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Account security" }]}
      />
      <AdminSecurityPanel />
    </AdminPortal>
  ),
});
