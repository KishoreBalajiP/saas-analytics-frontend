import { Outlet, createFileRoute } from "@tanstack/react-router";

// Layout for /reports/$reportId: the detail (reports.$reportId.index) and edit pages render here.
export const Route = createFileRoute("/reports/$reportId")({
  component: Outlet,
});
