import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTenantSession } from "@/lib/auth/session";
import { DashboardPage } from "@/routes/dashboard";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const setupApi = vi.hoisted(() => ({ connectorsList: vi.fn(), dashboardsList: vi.fn() }));

vi.mock("@/features/datasets/api", () => ({
  list: (...args: unknown[]) => setupApi.connectorsList(...args),
}));
vi.mock("@/features/dashboards/api", () => ({
  list: (...args: unknown[]) => setupApi.dashboardsList(...args),
}));

const refreshTenant = vi.fn();
const tenantMe = vi.fn();
const logoutTenant = vi.fn();

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, description }: { title: string; description: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("@/components/layout/TenantShell", () => ({
  TenantShell: ({ children }: { children: React.ReactNode }) => {
    const { status } = useTenantSession();
    return status === "anonymous" ? (
      <div data-testid="tenant-shell-status">{status}</div>
    ) : (
      <>{children}</>
    );
  },
}));

vi.mock("@/features/auth/api", () => ({
  refreshTenant: (...args: unknown[]) => refreshTenant(...args),
  tenantMe: (...args: unknown[]) => tenantMe(...args),
  logoutTenant: (...args: unknown[]) => logoutTenant(...args),
}));

describe("DashboardPage provider composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApi.connectorsList.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, pages: 0 },
    });
    setupApi.dashboardsList.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 100, total: 0, pages: 0 },
    });
    refreshTenant.mockResolvedValue({ accessToken: "token" });
    tenantMe.mockResolvedValue({
      id: "user-1",
      email: "user@example.test",
      tenantId: "tenant-a",
      permissions: ["dashboards.view"],
    });
    logoutTenant.mockResolvedValue(undefined);
  });

  it("renders session-dependent dashboard content under TenantPortal", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Welcome, user@example.test" }),
    ).toBeVisible();
    expect(screen.getByText("Tenant: tenant-a")).toBeVisible();
    expect(await screen.findByText("Finish your workspace setup")).toBeVisible();
  });

  it("distinguishes a completed setup using tenant connector and dashboard records", async () => {
    setupApi.connectorsList.mockResolvedValueOnce({
      data: [
        {
          _id: "connector-1",
          type: "csv",
          name: "Orders",
          status: "active",
          lastSyncedAt: "2026-10-11T12:00:00.000Z",
        },
      ],
      meta: { page: 1, limit: 100, total: 1, pages: 1 },
    });
    setupApi.dashboardsList.mockResolvedValueOnce({
      data: [{ _id: "dashboard-1", name: "Overview", status: "draft" }],
      meta: { page: 1, limit: 100, total: 1, pages: 1 },
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Workspace setup complete")).toBeVisible();
    expect(screen.getByRole("link", { name: /review setup/i })).toBeVisible();
  });

  it("keeps unauthenticated state available to the existing tenant shell guard", async () => {
    refreshTenant.mockRejectedValueOnce(new Error("not authenticated"));

    render(
      <QueryClientProvider client={new QueryClient()}>
        <DashboardPage />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(refreshTenant).toHaveBeenCalled());
    expect(await screen.findByTestId("tenant-shell-status")).toHaveTextContent("anonymous");
  });
});
