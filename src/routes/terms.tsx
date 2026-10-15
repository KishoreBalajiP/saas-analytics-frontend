import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/common/PolicyPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service - Analivo" }] }),
  component: () => (
    <PolicyPage
      title="Terms of Service"
      summary="The baseline terms for using Analivo workspaces and analytics features."
      sections={[
        {
          heading: "Using Analivo",
          body: "Workspace owners are responsible for their account, invitations, permissions, and the data they connect or upload. Users must use the service lawfully and must not attempt to bypass authentication, authorization, tenant isolation, rate limits, or security controls.",
        },
        {
          heading: "Your content",
          body: "You retain responsibility for the datasets, credentials, and other content submitted to a workspace. Do not upload information that your organization is not authorized to process.",
        },
        {
          heading: "Availability and changes",
          body: "Features may depend on the configuration of the deployment and enabled connectors. Confirm the final service-level, suspension, termination, warranty, and limitation language with qualified counsel.",
        },
        {
          heading: "Commercial terms",
          body: "Any paid plans, prices, taxes, renewal terms, refunds, and payment-provider terms must be confirmed by the operator before this page is treated as final.",
        },
      ]}
    />
  ),
});
