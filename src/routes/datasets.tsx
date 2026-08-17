import { Outlet, createFileRoute } from "@tanstack/react-router";

import { TenantPortal } from "@/components/layout/TenantPortal";

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [{ title: "Datasets — Analytics Console" }],
  }),
  component: () => (
    <TenantPortal>
      <Outlet />
    </TenantPortal>
  ),
});
