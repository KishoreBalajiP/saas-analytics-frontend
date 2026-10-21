import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { Dashboard } from "@/lib/api/types";

const api = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/features/dashboards/api", () => ({
  update: (...args: unknown[]) => api.update(...args),
}));
vi.mock("@/features/datasets/api", () => ({ list: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DashboardSettings } from "./DashboardEditor";

const dashboard = {
  _id: "d1",
  name: "Revenue",
  status: "draft",
  filters: {
    dateRange: { field: "order_date", preset: "last_month" },
    filters: [{ field: "region", op: "eq", value: "EU" }],
  },
} as unknown as Dashboard;

function renderSettings(value: Dashboard = dashboard) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DashboardSettings dashboard={value} onSaved={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.update.mockResolvedValue(dashboard);
});

describe("DashboardSettings default filters", () => {
  it("edits the default date range with a date column and a relative preset", async () => {
    renderSettings();
    expect(screen.getByLabelText("Range")).toHaveValue("last_month");
    expect(screen.getByLabelText("Date field")).toHaveValue("order_date");
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "this_quarter" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[1]).toMatchObject({
      filters: {
        filters: [{ field: "region", op: "eq", value: "EU" }],
        dateRange: { field: "order_date", preset: "this_quarter" },
      },
    });
  });

  it("clears the default date range when 'No date filter' is chosen", async () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0]?.[1].filters).toEqual({
      filters: [{ field: "region", op: "eq", value: "EU" }],
    });
  });

  it("requires the date column before saving and shows server field errors", async () => {
    renderSettings({ ...dashboard, filters: {} } as Dashboard);
    fireEvent.change(screen.getByLabelText("Range"), { target: { value: "today" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    expect(await screen.findByText(/choose the date column/i)).toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();

    api.update.mockRejectedValue(
      new ApiError("Invalid analytics query", 400, "INVALID_QUERY", [
        { field: "filters.filters[0].op", message: "must be one of eq, neq" },
      ]),
    );
    fireEvent.change(screen.getByLabelText("Date field"), { target: { value: "order_date" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));
    expect(
      await screen.findByText(/filters\.filters\[0\]\.op: must be one of eq, neq/),
    ).toBeInTheDocument();
  });
});
