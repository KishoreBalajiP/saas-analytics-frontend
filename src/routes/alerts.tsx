import { createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/common/states";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [{ title: "Alerts — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PageHeader
        title="Alerts"
        description="Monitor conditions and get notified when thresholds are breached."
        crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Alerts" }]}
      />
      <ComingSoon
        title="Alert Rules"
        description="Define conditions on your datasets, set schedules and cooldowns, and receive email or in-app notifications."
      />
    </TenantPortal>
  ),
});
