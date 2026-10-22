import { createFileRoute } from "@tanstack/react-router";

import source from "@/content/legal/privacy.md?raw";
import { LegalPage } from "@/features/legal/LegalPage";

// onboarding: rendered from the bundled Markdown draft.
export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy - Analivo" }] }),
  component: () => <LegalPage source={source} />,
});
