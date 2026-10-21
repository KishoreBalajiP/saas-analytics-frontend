import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { SharedDashboard } from "@/features/embed/share/SharedDashboard";

function SharePage() {
  // The secret is in the fragment (`/share#<secret>`) so it never reaches
  // server or proxy access logs.
  const [secret, setSecret] = useState<string | null>(null);
  useEffect(() => setSecret(window.location.hash.replace(/^#/, "")), []);
  if (secret === null) return null;
  return <SharedDashboard secret={secret} />;
}

export const Route = createFileRoute("/share")({
  head: () => ({
    meta: [{ title: "Shared dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: SharePage,
});
