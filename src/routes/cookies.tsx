import { createFileRoute } from "@tanstack/react-router";

import source from "@/content/legal/cookies.md?raw";
import { LegalPage } from "@/features/legal/LegalPage";

// onboarding: rendered from the bundled Markdown draft.
export const Route = createFileRoute("/cookies")({
  head: () => ({ meta: [{ title: "Cookie Policy - Analivo" }] }),
  component: () => <LegalPage source={source} />,
});
