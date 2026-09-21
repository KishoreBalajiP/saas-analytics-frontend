import { createFileRoute } from "@tanstack/react-router";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportDetail } from "@/features/reports/components/ReportsView";

export const Route = createFileRoute("/reports/$reportId/edit")({
  head: () => ({ meta: [{ title: "Edit Report — Analytics Console" }] }),
  component: EditReportPage,
});

function EditReportPage() {
  const { reportId } = Route.useParams();
  return (
    <TenantPortal>
      <PageHeader
        title="Edit report"
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Reports", to: "/reports" },
          { label: "Edit" },
        ]}
      />
      <ReportDetail reportId={reportId} edit />
    </TenantPortal>
  );
}
