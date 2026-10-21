/**
 * The alerts list only offers a manual evaluation (POST /alerts/:id/evaluate,
 * alerts.evaluate) to members who hold that permission, and reports the
 * evaluation outcome (triggered, suppressed by the cooldown, no data, ...).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const api = vi.hoisted(() => ({
  list: vi.fn(),
  evaluate: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/features/alerts/api", () => ({
  list: (...args: unknown[]) => api.list(...args),
  evaluate: (...args: unknown[]) => api.evaluate(...args),
  update: (...args: unknown[]) => api.update(...args),
  remove: (...args: unknown[]) => api.remove(...args),
}));
const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: () => session }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AlertsView } from "./AlertsView";

function renderList() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AlertsView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({
    data: [
      {
        _id: "a1",
        name: "Low stock",
        metric: "count",
        condition: "lt",
        threshold: 5,
        enabled: true,
        lastEvaluation: { outcome: "suppressed", value: 2 },
      },
    ],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
});

describe("alerts list actions", () => {
  it("evaluates an alert for a member with alerts.evaluate and reports the outcome", async () => {
    session.permissions = ["alerts.view", "alerts.evaluate"];
    api.evaluate.mockResolvedValue({
      triggered: false,
      suppressed: true,
      conditionMet: true,
      outcome: "suppressed",
      value: 2,
    });
    renderList();
    expect(await screen.findByText("Suppressed (cooldown)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Evaluate Low stock" }));
    await waitFor(() => expect(api.evaluate).toHaveBeenCalledWith("a1"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Condition met, notification suppressed (cooldown)",
      ),
    );
  });

  it("offers no evaluate button without alerts.evaluate", async () => {
    session.permissions = ["alerts.view"];
    renderList();
    expect(await screen.findByText("Low stock")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Evaluate / })).toBeNull();
  });
});
