import { createFileRoute } from "@tanstack/react-router";

import { ConnectorDetailView } from "@/features/datasets/components/ConnectorDetailView";

export const Route = createFileRoute("/datasets/$connectorId")({
  head: () => ({
    meta: [{ title: "Dataset — Analytics Console" }],
  }),
  component: ConnectorDetailPage,
});

function ConnectorDetailPage() {
  const { connectorId } = Route.useParams();
  return <ConnectorDetailView connectorId={connectorId} />;
}
