import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { BillingPanel } from "@/features/billing/components/BillingPanel";
import { useTenantSession } from "@/lib/auth/session";
import { TableSkeleton } from "@/components/common/states";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [{ title: "Billing — Workspace Console" }],
  }),
  component: () => (
    <TenantPortal>
      <BillingRoute />
    </TenantPortal>
  ),
});

function BillingRoute() {
  const { me } = useTenantSession();
  const tenantId = me?.tenantId;
  // TenantShell owns the signed-out redirect; a missing tenant id here only
  // means the profile is still loading, never a reason to show "sign in".
  if (!tenantId) return <TableSkeleton rows={4} cols={2} />;
  return (
    <>
      <PageHeader
        title="Subscription"
        description="Current plan, usage, and recent subscription activity."
        crumbs={[{ label: "Workspace", to: "/dashboard" }, { label: "Subscription" }]}
      />
      <BillingPanel tenantId={tenantId} />
    </>
  );
}
