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
          body: "This page does not claim that non-essential analytics, preference, or embedded-provider cookies are enabled. Their presence depends on the deployed configuration.",
        },
        {
          heading: "Managing cookies",
          body: "Blocking essential cookies may prevent sign-in, session refresh, or other protected features from working. No jurisdiction-specific contact or choices are published on this page.",
        },
      ]}
    />
  ),
});
