import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/common/PolicyPage";

export const Route = createFileRoute("/acceptable-use")({
  head: () => ({ meta: [{ title: "Acceptable Use Policy - Analivo" }] }),
  component: () => (
    <PolicyPage
      title="Acceptable Use Policy"
      summary="Safe and responsible use of Analivo data, connectors, and workspaces."
      sections={[
        {
          heading: "Do not misuse the service",
          body: "Do not use Analivo to access another workspace, probe or defeat security controls, distribute malware, abuse connectors, overload the service, or process data unlawfully.",
        },
        {
          heading: "Credentials and third-party data",
          body: "Keep passwords, connector credentials, API keys, and uploaded files secure. Use only data and third-party systems for which your organization has authorization.",
        },
        {
          heading: "Reporting concerns",
          body: "Report suspected unauthorized access or security issues through the approved support or security contact. Add the verified contact details before publication.",
        },
      ]}
    />
  ),
});
