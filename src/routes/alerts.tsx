import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout for /alerts: the list (alerts.index), detail and edit pages render
// here. Without the Outlet the detail routes matched but never rendered.
export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [{ title: "Alerts — Analytics Console" }],
  }),
  component: Outlet,
});
