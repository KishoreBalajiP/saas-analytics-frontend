import { createFileRoute } from "@tanstack/react-router";

import { EmbedFrame } from "@/features/embed/frame/EmbedFrame";

/**
 * Chrome-less embed page loaded in an iframe by public/embed-sdk.js. The
 * signed token arrives by postMessage, never in the URL.
 */
export const Route = createFileRoute("/embedded")({
  head: () => ({
    meta: [{ title: "Analivo embed" }, { name: "robots", content: "noindex" }],
  }),
  component: () => <EmbedFrame />,
});
