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
});
