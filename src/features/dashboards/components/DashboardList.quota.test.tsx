/**
 * Create-action quota UX: a plan-limit refusal shows the shared quota
 * message (metric, limit and current use) inline in the create dialog.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children?: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/lib/auth/session", () => ({
  useTenantSession: vi.fn(),
}));

vi.mock("@/features/dashboards/api", () => ({
  list: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));

import * as dashboardsApi from "@/features/dashboards/api";
import { ApiError } from "@/lib/api/client";
import type { FieldError } from "@/lib/api/types";
import { useTenantSession } from "@/lib/auth/session";
import { DashboardList } from "./DashboardList";

const permissions = ["dashboards.view", "dashboards.create"];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useTenantSession).mockReturnValue({
    status: "authenticated",
    me: { id: "u1", email: "o@example.com", permissions },
    tenantSlug: "acme",
    permissions,
    hasPermission: (p: string) => permissions.includes(p),
    refetch: vi.fn(),
    setSession: vi.fn(),
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useTenantSession>);
  vi.mocked(dashboardsApi.list).mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 20, total: 0, pages: 1 },
  } as unknown as Awaited<ReturnType<typeof dashboardsApi.list>>);
});

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardList />
    </QueryClientProvider>,
  );
}

describe("DashboardList create dialog", () => {
  it("shows the plan-limit message with the metric when the create is refused", async () => {
    vi.mocked(dashboardsApi.create).mockRejectedValue(
      new ApiError("Plan limit reached for dashboards (max 5)", 409, "QUOTA_EXCEEDED", [
        {
          field: "dashboards",
          message: "Plan limit reached for dashboards (max 5)",
          metric: "dashboards",
          limit: 5,
          current: 5,
          period: "current",
        } as FieldError,
      ]),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole("button", { name: /Create dashboard/i }));
    await user.type(screen.getByLabelText("Name"), "Q4 revenue");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Plan limit reached: your plan allows 5 dashboards and 5 are in use.",
      ),
    );
  });

  it("keeps the server message for other errors", async () => {
    vi.mocked(dashboardsApi.create).mockRejectedValue(
      new ApiError("A dashboard with that name already exists", 409, "CONFLICT"),
    );
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole("button", { name: /Create dashboard/i }));
    await user.type(screen.getByLabelText("Name"), "Dup");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "A dashboard with that name already exists",
      ),
    );
  });
});
