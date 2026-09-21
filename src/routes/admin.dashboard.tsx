import { createFileRoute } from "@tanstack/react-router";
import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminOverview } from "@/features/admin/components/AdminViews";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Analytics Console" },
      { name: "description", content: "Platform administration overview." },
    ],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  return (
    <AdminPortal>
      <PageHeader title="Admin Dashboard" description="Platform administration overview." />

      <AdminOverview />
    </AdminPortal>
  );
}
