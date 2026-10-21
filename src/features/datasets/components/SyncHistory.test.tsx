import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ listSyncRuns: vi.fn() }));
vi.mock("@/features/datasets/api", () => ({
  listSyncRuns: (...args: unknown[]) => api.listSyncRuns(...args),
}));

import { SyncHistory, SyncStateSummary } from "./SyncHistory";

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.clearAllMocks());

describe("SyncHistory", () => {
  it("lists runs with status, trigger, rows and errors", async () => {
    api.listSyncRuns.mockResolvedValue({
      data: [
        {
          id: "r2",
          connectorId: "c1",
          trigger: "manual",
          status: "succeeded",
          attempts: 1,
          maxAttempts: 5,
          filename: "orders.csv",
          durationMs: 1500,
          rows: { received: 120, upserted: 100, matched: 20 },
          queuedAt: "2026-10-20T10:00:00.000Z",
        },
        {
          id: "r1",
          connectorId: "c1",
          trigger: "recovery",
          status: "abandoned",
          attempts: 1,
          error: { code: "LEASE_EXPIRED", message: "The sync was interrupted before it finished" },
          queuedAt: "2026-10-20T09:00:00.000Z",
        },
      ],
      meta: { page: 1, limit: 10, total: 2, pages: 1 },
    });

    renderWithClient(<SyncHistory connectorId="c1" />);

    expect(await screen.findByText("orders.csv")).toBeInTheDocument();
    expect(screen.getByText("Succeeded")).toBeInTheDocument();
    expect(screen.getByText("Interrupted")).toBeInTheDocument();
    expect(screen.getByText("Automatic recovery")).toBeInTheDocument();
    expect(screen.getByText("120 read · 100 new · 20 updated")).toBeInTheDocument();
    expect(screen.getByText("1 / 5")).toBeInTheDocument();
    expect(screen.getByText("1.5 s")).toBeInTheDocument();
    expect(screen.getByText("The sync was interrupted before it finished")).toBeInTheDocument();
    expect(api.listSyncRuns).toHaveBeenCalledWith("c1", { page: 1, limit: 10 });
  });

  it("shows an empty message when the dataset has never synced", async () => {
    api.listSyncRuns.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, pages: 0 },
    });
    renderWithClient(<SyncHistory connectorId="c1" />);
    expect(await screen.findByText(/No syncs yet/)).toBeInTheDocument();
  });

  it("shows the permission error state on 403", async () => {
    api.listSyncRuns.mockRejectedValue(new ApiError("Forbidden", 403, "FORBIDDEN"));
    renderWithClient(<SyncHistory connectorId="c1" />);
    expect(await screen.findByText("Permission required")).toBeInTheDocument();
  });

  it("does not fetch while disabled", async () => {
    renderWithClient(<SyncHistory connectorId="c1" enabled={false} />);
    await waitFor(() => expect(api.listSyncRuns).not.toHaveBeenCalled());
  });
});

describe("SyncStateSummary", () => {
  it("shows the live state and the auto-refresh note while a sync runs", () => {
    render(
      <dl>
        <SyncStateSummary
          connector={{
            _id: "c1",
            type: "csv",
            name: "Orders",
            status: "active",
            syncStatus: "running",
            syncRequestedAt: "2026-10-20T10:00:00.000Z",
          }}
        />
      </dl>,
    );
    expect(screen.getByTestId("sync-state")).toHaveTextContent("Running");
    expect(screen.getByText(/refreshes automatically/)).toBeInTheDocument();
  });

  it("shows Never synced for an idle connector", () => {
    render(
      <dl>
        <SyncStateSummary
          connector={{ _id: "c1", type: "csv", name: "Orders", status: "active" }}
        />
      </dl>,
    );
    expect(screen.getByTestId("sync-state")).toHaveTextContent("Never synced");
    expect(screen.queryByText(/refreshes automatically/)).not.toBeInTheDocument();
  });
});
