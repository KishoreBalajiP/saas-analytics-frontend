import { createFileRoute } from "@tanstack/react-router";
import { AccessPage } from "@/routes/register";

export const Route = createFileRoute("/request-access")({
  head: () => ({ meta: [{ title: "Request workspace access - Analivo" }] }),
  component: () => (
    <AccessPage
      title="Request workspace access"
      description="Access is provisioned by each workspace administrator so tenant membership and permissions stay controlled."
      message="Ask your workspace owner to send you a single-use invitation. If you are creating a new workspace, register instead."
    />
  ),
});
