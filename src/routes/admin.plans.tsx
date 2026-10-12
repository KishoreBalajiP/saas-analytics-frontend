import { createFileRoute } from "@tanstack/react-router";
import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPlansView } from "@/features/admin/components/BillingViews";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({
    meta: [
      { title: "Plans - Analivo Admin" },
      { name: "description", content: "Manage the plan catalogue." },
    ],
  }),
  component: AdminPlansPage,
});

function AdminPlansPage() {
  return (
    <AdminPortal>
      <PageHeader
        title="Plans"
        description="Configure the plan catalogue that drives tenant subscriptions and quotas."
      />
      <AdminPlansView />
    </AdminPortal>
  );
}
