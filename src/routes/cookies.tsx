import { createFileRoute } from "@tanstack/react-router";
import { PolicyPage } from "@/components/common/PolicyPage";

export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Cookie Policy - Analivo" }] }),
  component: () => (
    <PolicyPage
      title="Cookie Policy"
      summary="The application uses cookies to support authenticated sessions."
      sections={[
        {
          heading: "Essential session cookies",
          body: "Analivo uses an HttpOnly session refresh cookie to help maintain a signed-in session. The frontend does not read this cookie from JavaScript. Cookie security attributes are controlled by the backend deployment configuration.",
        },
        {
          heading: "Preferences and measurement",
          body: "Confirm whether any non-essential analytics, preference, or embedded-provider cookies are enabled in the production deployment. Do not publish a consent claim until the deployed configuration has been verified.",
        },
        {
          heading: "Managing cookies",
          body: "Blocking essential cookies may prevent sign-in, session refresh, or other protected features from working. Add the approved contact and jurisdiction-specific choices before publication.",
        },
      ]}
    />
  ),
});
