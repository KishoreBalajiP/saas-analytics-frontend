import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout for /reports: the list (reports.index), detail and edit pages render
// here. Without the Outlet the detail routes matched but never rendered.
export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [{ title: "Reports — Analytics Console" }],
  }),
  component: Outlet,
});
