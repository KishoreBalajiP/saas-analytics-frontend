import { QueryClient } from "@tanstack/react-query";
import { Outlet, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route as Alerts } from "@/routes/alerts";
import { Route as AlertDetail } from "@/routes/alerts.$alertId";
import { Route as Dashboards } from "@/routes/dashboards";
import { Route as DashboardDetail } from "@/routes/dashboards.$dashboardId";
import { Route as Reports } from "@/routes/reports";
import { Route as ReportDetail } from "@/routes/reports.$reportId";
import { routeTree } from "@/routeTree.gen";

describe("list / detail / edit routes", () => {
  // Regression: these parents rendered the list without an <Outlet />, so
  // /dashboards/:id (and reports, alerts) showed the list again and a new
  // draft dashboard could never be opened.
  it("parent routes render an Outlet so detail and edit pages display", () => {
    for (const route of [Dashboards, DashboardDetail, Reports, ReportDetail, Alerts, AlertDetail]) {
      expect(route.options.component).toBe(Outlet);
    }
  });

  it("the generated tree has index routes for the list and detail pages", () => {
    // Route ids are resolved when a router is built from the tree.
    const ids = Object.keys(
      createRouter({ routeTree, context: { queryClient: new QueryClient() } }).routesById,
    );
    for (const id of [
      "/dashboards/",
      "/dashboards/$dashboardId/",
      "/dashboards/$dashboardId/edit",
      "/reports/",
      "/reports/$reportId/",
      "/reports/$reportId/edit",
      "/alerts/",
      "/alerts/$alertId/",
      "/alerts/$alertId/edit",
    ]) {
      expect(ids).toContain(id);
    }
  });
});
