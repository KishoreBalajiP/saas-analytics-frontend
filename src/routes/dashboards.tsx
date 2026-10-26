import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout for /dashboards: the list (dashboards.index), detail and edit pages render
// here. Without the Outlet the detail routes matched but never rendered.
export const Route = createFileRoute("/dashboards")({
  head: () => ({
    meta: [{ title: "Dashboards — Analytics Console" }],
  }),
  component: Outlet,
});
