import { createFileRoute } from "@tanstack/react-router";

import { AdminPortal } from "@/components/layout/AdminPortal";
import { PageHeader } from "@/components/layout/PageHeader";
import { MasterDataManager } from "@/features/master-data/components/MasterDataManager";

export const Route = createFileRoute("/admin/master-data")({
  head: () => ({ meta: [{ title: "Master data — Admin Portal" }] }),
  component: MasterDataPage,
});

function MasterDataPage() {
  return (
    <AdminPortal>
      <PageHeader
        title="Master data"
        description="Shared reference catalogues used by every workspace."
      />
      <MasterDataManager />
    </AdminPortal>
  );
}
