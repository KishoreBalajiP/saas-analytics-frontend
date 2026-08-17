import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/admin/compliance")({
  head: () => ({ meta: [{ title: "Compliance — Admin Portal" }] }),
  component: () => (
    <AdminPortal>
      <PageHeader
        title="Compliance"
        description="Handle data subject requests (export, delete, restrict)."
        crumbs={[{ label: "Admin", to: "/admin/dashboard" }, { label: "Compliance" }]}
      />
      <ComingSoon
        title="Compliance Requests"
        description="Create, view, and cancel compliance requests for data export, deletion, and restriction."
      />
    </AdminPortal>
  ),
});
