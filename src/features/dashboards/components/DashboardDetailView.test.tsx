import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({
    children,
    to,
    ...props
  }: {
    children?: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth/session", () => ({
  useTenantSession: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("@/features/dashboards/api", () => ({
  get: vi.fn(),
  listWidgets: vi.fn(),
  executeWidget: vi.fn(),
  publish: vi.fn(),
  duplicate: vi.fn(),
  remove: vi.fn(),
}));

import { useQuery } from "@tanstack/react-query";
import { useTenantSession } from "@/lib/auth/session";
import { DashboardDetailView } from "./DashboardDetailView";

const mockedUseTenantSession = vi.mocked(useTenantSession);
const mockedUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DashboardDetailView", () => {
  it("renders permission error when the user cannot view dashboards", () => {
    mockedUseTenantSession.mockReturnValue({
      status: "authenticated",
      me: { id: "u1", email: "t@t.com", permissions: [] },
      tenantSlug: "acme",
      permissions: [],
      hasPermission: () => false,
      refetch: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });

    render(<DashboardDetailView dashboardId="dash_123" />);
    expect(screen.getByRole("heading", { name: /Permission required/i })).toBeInTheDocument();
  });

  it("renders a dashboard title and widget names when data loads", () => {
    mockedUseTenantSession.mockReturnValue({
      status: "authenticated",
      me: { id: "u1", email: "t@t.com", permissions: ["dashboards.view", "analytics.view"] },
      tenantSlug: "acme",
      permissions: ["dashboards.view", "analytics.view"],
      hasPermission: (permission: string) =>
        ["dashboards.view", "analytics.view"].includes(permission),
      refetch: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });

    mockedUseQuery.mockImplementation((options) => {
      const key = options.queryKey as string[] | undefined;
      const fixture = {
        isLoading: false,
        isError: false,
        refetch: async () => undefined,
      };
      if (key?.[0] === "dashboards" && key?.[1] === "detail") {
        return {
          data: {
            _id: "dash_123",
            name: "Sales Dashboard",
            status: "draft",
            widgets: [{ _id: "w1", name: "Revenue", type: "kpi", datasetId: "d1" }],
          },
          isLoading: false,
          isError: false,
          refetch: async () => undefined,
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === "dashboards" && key?.[2] === "widgets") {
        return {
          data: {
            data: [{ _id: "w1", name: "Revenue", type: "kpi", datasetId: "d1" }],
            meta: { page: 1, limit: 25, total: 1, pages: 1 },
          },
          isLoading: false,
          isError: false,
          refetch: async () => undefined,
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === "dashboards" && key?.[1] === "execution") {
        return {
          data: [
            { widgetId: "w1", name: "Revenue", type: "kpi", result: { rows: [{ revenue: 123 }] } },
          ],
          isLoading: false,
          isFetching: false,
          isError: false,
          refetch: async () => undefined,
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === "dashboards" && key?.[1] === "list") {
        return {
          data: {
            data: [{ _id: "dash_123", name: "Sales Dashboard" }],
            meta: { page: 1, limit: 25, total: 1, pages: 1 },
          },
          isLoading: false,
          isError: false,
          refetch: async () => undefined,
        } as unknown as ReturnType<typeof useQuery>;
      }
      return fixture as unknown as ReturnType<typeof useQuery>;
    });

    render(<DashboardDetailView dashboardId="dash_123" />);
    expect(screen.getByRole("heading", { name: "Sales Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("lists the field errors of a widget whose query the API rejected", () => {
    const permissions = ["dashboards.view", "analytics.view"];
    mockedUseTenantSession.mockReturnValue({
      status: "authenticated",
      me: { id: "u1", email: "t@t.com", permissions },
      tenantSlug: "acme",
      permissions,
      hasPermission: (permission: string) => permissions.includes(permission),
      refetch: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });
    const widget = { _id: "w1", name: "Revenue", type: "kpi", datasetId: "d1" };
    mockedUseQuery.mockImplementation((options) => {
      const key = options.queryKey as string[] | undefined;
      const base = {
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: async () => undefined,
      };
      if (key?.[1] === "detail") {
        return {
          ...base,
          data: { _id: "dash_123", name: "Sales", status: "draft", widgets: [widget] },
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[2] === "widgets") {
        return {
          ...base,
          data: { data: [widget], meta: { page: 1, limit: 25, total: 1, pages: 1 } },
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[1] === "execution") {
        return {
          ...base,
          data: [
            {
              widgetId: "w1",
              name: "Revenue",
              type: "kpi",
              status: "error",
              error: {
                message: "Invalid analytics query",
                code: "INVALID_QUERY",
                errors: [{ field: "dateRange.field", message: "is required" }],
              },
            },
          ],
        } as unknown as ReturnType<typeof useQuery>;
      }
      return base as unknown as ReturnType<typeof useQuery>;
    });

    render(<DashboardDetailView dashboardId="dash_123" />);
    expect(screen.getByText("dateRange.field")).toBeInTheDocument();
    expect(screen.getByText(/is required/)).toBeInTheDocument();
  });

  it("tells viewers which default date range the dashboard applies", () => {
    const permissions = ["dashboards.view", "analytics.view"];
    mockedUseTenantSession.mockReturnValue({
      status: "authenticated",
      me: { id: "u1", email: "t@t.com", permissions },
      tenantSlug: "acme",
      permissions,
      hasPermission: (permission: string) => permissions.includes(permission),
      refetch: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });
    mockedUseQuery.mockImplementation((options) => {
      const key = options.queryKey as string[] | undefined;
      const base = {
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: async () => undefined,
      };
      if (key?.[1] === "detail") {
        return {
          ...base,
          data: {
            _id: "dash_123",
            name: "Sales",
            status: "draft",
            widgets: [],
            filters: { dateRange: { field: "order_date", preset: "last_month" } },
          },
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[2] === "widgets") {
        return {
          ...base,
          data: { data: [], meta: { page: 1, limit: 25, total: 0, pages: 0 } },
        } as unknown as ReturnType<typeof useQuery>;
      }
      return { ...base, data: [] } as unknown as ReturnType<typeof useQuery>;
    });

    render(<DashboardDetailView dashboardId="dash_123" />);
    expect(screen.getByText("Default date range: Last month on order_date")).toBeInTheDocument();
  });

  it("shows a broken state for a widget whose dataset was deleted", () => {
    const permissions = ["dashboards.view", "analytics.view"];
    mockedUseTenantSession.mockReturnValue({
      status: "authenticated",
      me: { id: "u1", email: "t@t.com", permissions },
      tenantSlug: "acme",
      permissions,
      hasPermission: (permission: string) => permissions.includes(permission),
      refetch: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    });
    const widgets = [
      {
        _id: "w1",
        name: "Revenue",
        type: "kpi",
        datasetId: "d1",
        brokenAt: "2026-10-20T00:00:00.000Z",
        brokenReason: "CONNECTOR_DELETED",
      },
      { _id: "w2", name: "Orders", type: "kpi", datasetId: "d2", brokenAt: null },
    ];
    mockedUseQuery.mockImplementation((options) => {
      const key = options.queryKey as string[] | undefined;
      const base = {
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: async () => undefined,
      };
      if (key?.[0] === "dashboards" && key?.[1] === "detail") {
        return {
          ...base,
          data: { _id: "dash_1", name: "Ops", status: "draft" },
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === "dashboards" && key?.[2] === "widgets") {
        return {
          ...base,
          data: { data: widgets, meta: { page: 1, limit: 25, total: 2, pages: 1 } },
        } as unknown as ReturnType<typeof useQuery>;
      }
      if (key?.[0] === "dashboards" && key?.[1] === "execution") {
        return {
          ...base,
          data: [
            {
              widgetId: "w1",
              name: "Revenue",
              type: "kpi",
              status: "error",
              error: { message: "widget dataset must be a connector owned by the tenant" },
            },
            { widgetId: "w2", name: "Orders", type: "kpi", result: { rows: [{ n: 3 }] } },
          ],
        } as unknown as ReturnType<typeof useQuery>;
      }
      return base as unknown as ReturnType<typeof useQuery>;
    });

    render(<DashboardDetailView dashboardId="dash_1" />);
    expect(screen.getByText("Broken")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("This widget is broken");
    expect(screen.getByText(/dataset it reads from was deleted/)).toBeInTheDocument();
    // The raw execution error is replaced by the broken state.
    expect(screen.queryByText(/must be a connector owned by the tenant/)).toBeNull();
  });
});
