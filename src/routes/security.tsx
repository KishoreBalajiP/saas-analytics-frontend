import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/common/PolicyPage";

export const Route = createFileRoute("/security")({
  head: () => ({ meta: [{ title: "Security - Analivo" }] }),
  component: () => (
    <PolicyPage
      title="Security"
      summary="Security controls currently reflected in the Analivo application architecture."
      sections={[
        {
          heading: "Access control",
          body: "The backend remains authoritative for authentication, tenant resolution, role-based permissions, and platform-administrator authorization. Frontend navigation is only a usability aid and is not a security boundary.",
        },
        {
          heading: "Sessions and sensitive values",
          body: "Access tokens are kept in memory in the frontend, while refresh tokens are handled through HttpOnly cookies. Administrative credentials and password hashes are not returned as normal API data.",
        },
        {
          heading: "Tenant isolation and auditability",
          body: "Tenant-scoped routes apply server-side tenant boundaries, and the backend includes audit and access-log capabilities for supported administrative operations. Verify the deployed environment and retention settings before making compliance claims.",
        },
        {
          heading: "Disclosure",
          body: "A public security-reporting email or support channel is not published on this page. Analivo does not claim SOC 2, ISO 27001, GDPR certification, or an SLA.",
        },
      ]}
    />
  ),
});
