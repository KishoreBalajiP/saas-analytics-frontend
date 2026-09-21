import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTenantSession } from "@/lib/auth/session";
import { DashboardPage } from "@/routes/dashboard";

const refreshTenant = vi.fn();
const tenantMe = vi.fn();
const logoutTenant = vi.fn();

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    render(<DashboardPage />);

    expect(
      await screen.findByRole("heading", { name: "Welcome, user@example.test" }),
    ).toBeVisible();
    expect(screen.getByText("Tenant: tenant-a")).toBeVisible();
  });

  it("keeps unauthenticated state available to the existing tenant shell guard", async () => {
    refreshTenant.mockRejectedValueOnce(new Error("not authenticated"));

    render(<DashboardPage />);

    await waitFor(() => expect(refreshTenant).toHaveBeenCalled());
    expect(await screen.findByTestId("tenant-shell-status")).toHaveTextContent("anonymous");
  });
});
