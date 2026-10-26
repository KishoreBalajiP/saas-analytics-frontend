import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout for /dashboards/$dashboardId: the detail (dashboards.$dashboardId.index) and edit pages render here.
export const Route = createFileRoute("/dashboards/$dashboardId")({
  component: Outlet,
});
