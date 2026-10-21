/**
 * ConnectorDetailView: sync state, polling, Sync now gating, the History tab
 * and sync-request errors. (Upload errors and the webhook tab:
 * ConnectorDetailView.uploads.test.tsx.)
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  listRows: vi.fn(),
  listSyncRuns: vi.fn(),
  syncMongoDB: vi.fn(),
  syncFile: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  previewFile: vi.fn(),
  validate: vi.fn(),
}));
vi.mock("@/features/datasets/api", () => api);

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/lib/auth/session", () => ({
  useTenantSession: () => ({ permissions: session.permissions }),
}));

import { ConnectorDetailView } from "./ConnectorDetailView";

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConnectorDetailView connectorId="c1" />
    </QueryClientProvider>,
  );
}

const mongoConnector = {
  _id: "c1",
  type: "mongodb",
  name: "Events",
  status: "active",
  configSummary: { host: "db.example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = ["connectors.view", "connectors.sync"];
  api.listSyncRuns.mockResolvedValue({
    data: [],
    meta: { page: 1, limit: 10, total: 0, pages: 0 },
  });
});

describe("ConnectorDetailView sync state", () => {
  it("shows the current sync state and the sync history tab", async () => {
    api.get.mockResolvedValue({ ...mongoConnector, syncStatus: "succeeded" });
    api.listSyncRuns.mockResolvedValue({
      data: [{ id: "r1", connectorId: "c1", trigger: "manual", status: "succeeded", attempts: 1 }],
      meta: { page: 1, limit: 10, total: 1, pages: 1 },
    });
    renderView();
    expect(await screen.findByTestId("sync-state")).toHaveTextContent("Succeeded");

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "History" }));
    expect(await screen.findByText("Sync history")).toBeInTheDocument();
    await waitFor(() =>
      expect(api.listSyncRuns).toHaveBeenCalledWith("c1", { page: 1, limit: 10 }),
    );
    expect(await screen.findByText("Manual")).toBeInTheDocument();
  });

  it("disables Sync now while a sync is running", async () => {
    api.get.mockResolvedValue({ ...mongoConnector, syncStatus: "running" });
    renderView();
    expect(await screen.findByTestId("sync-state")).toHaveTextContent("Running");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Sync" }));
    expect(await screen.findByRole("button", { name: /Sync now/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/A sync is in progress/);
  });

  it("lets a new sync start once the running sync's lease has expired", async () => {
    api.get.mockResolvedValue({
      ...mongoConnector,
      syncStatus: "running",
      syncLeaseUntil: new Date(Date.now() - 60_000).toISOString(),
    });
    renderView();
    expect(await screen.findByTestId("sync-state")).toHaveTextContent("Running");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Sync" }));
    expect(await screen.findByRole("button", { name: /Sync now/ })).toBeEnabled();
    expect(screen.queryByText(/A sync is in progress/)).not.toBeInTheDocument();
  });

  it("explains a 409 SYNC_IN_PROGRESS instead of claiming success", async () => {
    api.get.mockResolvedValue({ ...mongoConnector, syncStatus: "failed" });
    api.syncMongoDB.mockRejectedValue(new ApiError("busy", 409, "SYNC_IN_PROGRESS"));
    renderView();
    await screen.findByTestId("sync-state");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Sync" }));
    fireEvent.click(await screen.findByRole("button", { name: /Sync now/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already running/)),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("explains a queue outage (503)", async () => {
    api.get.mockResolvedValue({ ...mongoConnector, syncStatus: "idle" });
    api.syncMongoDB.mockRejectedValue(new ApiError("timeout", 503, "QUEUE_TIMEOUT"));
    renderView();
    await screen.findByTestId("sync-state");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Sync" }));
    fireEvent.click(await screen.findByRole("button", { name: /Sync now/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/temporarily unavailable/)),
    );
  });

  it("does not call a paused connector's 409 a running sync", async () => {
    api.get.mockResolvedValue({ ...mongoConnector, syncStatus: "idle" });
    api.syncMongoDB.mockRejectedValue(
      new ApiError("This connector is paused. Resume it to sync.", 409, "CONNECTOR_PAUSED"),
    );
    renderView();
    await screen.findByTestId("sync-state");
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Sync" }));
    fireEvent.click(await screen.findByRole("button", { name: /Sync now/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("This connector is paused. Resume it to sync."),
    );
  });

  it("denies the page without connectors.view", async () => {
    session.permissions = ["dashboards.view"];
    renderView();
    expect(await screen.findByText("Permission required")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.listSyncRuns).not.toHaveBeenCalled();
  });
});
