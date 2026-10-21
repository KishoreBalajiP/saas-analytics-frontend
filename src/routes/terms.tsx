import { createFileRoute } from "@tanstack/react-router";

import source from "@/content/legal/terms.md?raw";
import { LegalPage } from "@/features/legal/LegalPage";

// onboarding: rendered from the bundled Markdown draft.
export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service (draft) - Analivo" }] }),
  component: () => <LegalPage source={source} />,
});
