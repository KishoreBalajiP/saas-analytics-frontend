import { createFileRoute } from "@tanstack/react-router";
import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminSubscriptionsView } from "@/features/admin/components/BillingViews";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions - Analivo Admin" },
      { name: "description", content: "Inspect and manage tenant subscriptions." },
    ],
  }),
  component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
  return (
    <AdminPortal>
      <PageHeader
        title="Subscriptions"
        description="List tenant subscriptions, change plans, and record administrative state changes."
      />
      <AdminSubscriptionsView />
    </AdminPortal>
  );
}
