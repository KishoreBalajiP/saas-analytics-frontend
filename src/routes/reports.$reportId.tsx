import { createFileRoute } from "@tanstack/react-router";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReportDetail } from "@/features/reports/components/ReportsView";

export const Route = createFileRoute("/reports/$reportId")({
  head: () => ({ meta: [{ title: "Report — Analytics Console" }] }),
  component: ReportPage,
});

function ReportPage() {
  const { reportId } = Route.useParams();
  return (
    <TenantPortal>
      <PageHeader
        title="Report"
        crumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Reports", to: "/reports" },
          { label: "Detail" },
        ]}
      />
      <ReportDetail reportId={reportId} />
    </TenantPortal>
  );
}
