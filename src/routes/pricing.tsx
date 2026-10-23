import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/layout/PageHeader";
import { TenantPortal } from "@/components/layout/TenantPortal";
import { TableSkeleton } from "@/components/common/states";
import * as billingApi from "@/features/billing/api";
import { PricingPlans } from "@/features/billing/components/PricingPlans";
import { SubscriptionBanner } from "@/features/billing/components/SubscriptionBanner";
import { useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [{ title: "Plans & pricing — Workspace Console" }],
  }),
  component: () => (
    <TenantPortal>
      <PricingRoute />
    </TenantPortal>
  ),
});

function PricingRoute() {
  const { me } = useTenantSession();
  const tenantId = me?.tenantId;
  const subscription = useQuery({
    queryKey: ["billing", "subscription", tenantId],
    queryFn: () => billingApi.getSubscription(tenantId as string),
    enabled: Boolean(tenantId),
  });
  if (!tenantId) {
    return <TableSkeleton rows={4} cols={2} />;
  }
  return (
    <>
      <PageHeader
        title="Plans & pricing"
        description="Buy a prepaid monthly or annual term. Terms never renew or charge automatically."
        crumbs={[
          { label: "Workspace", to: "/dashboard" },
          { label: "Subscription", to: "/billing" },
          { label: "Plans" },
        ]}
      />
      <div className="space-y-4">
        {subscription.data && <SubscriptionBanner subscription={subscription.data} />}
        <PricingPlans tenantId={tenantId} currentPlanId={subscription.data?.planId ?? null} />
      </div>
    </>
  );
}
