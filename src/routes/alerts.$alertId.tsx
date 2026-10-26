import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout for /alerts/$alertId: the detail (alerts.$alertId.index) and edit pages render here.
export const Route = createFileRoute("/alerts/$alertId")({
  component: Outlet,
});
