/**
 * The reports list only offers "run" (POST /reports/:id/run, which needs
 * reports.export) to members who hold that permission.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ to, children, ...props }: { to: string; children?: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
const api = vi.hoisted(() => ({ list: vi.fn(), run: vi.fn(), remove: vi.fn() }));
vi.mock("@/features/reports/api", () => ({
  list: (...args: unknown[]) => api.list(...args),
  run: (...args: unknown[]) => api.run(...args),
  remove: (...args: unknown[]) => api.remove(...args),
}));
const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: () => session }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportsView } from "./ReportsView";

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ReportsView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({
    data: [{ _id: "r1", name: "Weekly sales", source: "query", format: "csv", status: "active" }],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
  api.run.mockResolvedValue({ accepted: true, runId: "run-1" });
});

describe("reports list actions", () => {
  it("runs a report for a member with reports.export", async () => {
    session.permissions = ["reports.view", "reports.export"];
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "Run Weekly sales" }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith("r1"));
  });

  it("offers no run button without reports.export", async () => {
    session.permissions = ["reports.view"];
    renderList();
    expect(await screen.findByText("Weekly sales")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Run / })).toBeNull();
  });
});
