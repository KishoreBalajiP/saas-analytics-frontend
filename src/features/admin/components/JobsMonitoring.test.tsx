import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({
  schedulerHealth: vi.fn(),
  queueHealth: vi.fn(),
  listJobRuns: vi.fn(),
}));
vi.mock("@/features/admin/api", () => api);

import { JobsMonitoring } from "./JobsMonitoring";

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <JobsMonitoring />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.schedulerHealth.mockResolvedValue({
    status: "degraded",
    enabled: true,
    lastTickAt: "2026-10-20T10:00:00.000Z",
    jobs: [
      {
        name: "report-schedule",
        cronExpression: "* * * * *",
        enabled: true,
        intervalMs: 60000,
        overdue: true,
        lastRun: {
          id: "a",
          job: "report-schedule",
          status: "succeeded",
          startedAt: "2026-10-20T09:00:00.000Z",
        },
        lastSuccessAt: "2026-10-20T09:00:01.000Z",
        lastFailure: null,
      },
      {
        name: "stale-job-recovery",
        cronExpression: "*/5 * * * *",
        enabled: true,
        intervalMs: 300000,
        overdue: false,
        lastRun: {
          id: "b",
          job: "stale-job-recovery",
          status: "failed",
          startedAt: "2026-10-20T09:55:00.000Z",
        },
        lastSuccessAt: null,
        lastFailure: {
          id: "b",
          job: "stale-job-recovery",
          status: "failed",
          startedAt: "2026-10-20T09:55:00.000Z",
          error: { message: "database unavailable" },
        },
      },
      {
        name: "cleanup",
        cronExpression: "0 3 * * *",
        enabled: false,
        intervalMs: 86400000,
        overdue: false,
        lastRun: null,
        lastSuccessAt: null,
        lastFailure: null,
      },
    ],
  });
  api.queueHealth.mockResolvedValue({
    status: "ok",
    transport: "bullmq",
    role: "web",
    consumersInProcess: false,
    queues: [
      { name: "connector.sync", status: "ok", waiting: 4, active: 1, delayed: 0, failed: 2 },
    ],
  });
  api.listJobRuns.mockResolvedValue({
    data: [
      {
        id: "r1",
        job: "alert-evaluation",
        instanceId: "worker-1",
        trigger: "schedule",
        status: "succeeded",
        startedAt: "2026-10-20T10:00:00.000Z",
        finishedAt: "2026-10-20T10:00:01.000Z",
        durationMs: 640,
        counts: { evaluated: 3, triggered: 1 },
        error: null,
      },
    ],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
});

describe("JobsMonitoring", () => {
  it("shows scheduler jobs, queue counts and job runs", async () => {
    renderView();
    expect(await screen.findByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText(/database unavailable/)).toBeInTheDocument();
    expect(await screen.findByText("BullMQ (Redis)")).toBeInTheDocument();
    expect(screen.getByText("connector.sync")).toBeInTheDocument();
    expect(await screen.findByText("worker-1")).toBeInTheDocument();
    expect(screen.getByText("evaluated: 3, triggered: 1")).toBeInTheDocument();
    expect(screen.getByText("640 ms")).toBeInTheDocument();
  });

  it("filters job runs by status", async () => {
    renderView();
    await screen.findByText("worker-1");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Failed" }));
    await waitFor(() =>
      expect(api.listJobRuns).toHaveBeenLastCalledWith({ page: 1, limit: 20, status: "failed" }),
    );
    expect(screen.getByRole("button", { name: "Failed" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an error state per panel", async () => {
    api.listJobRuns.mockRejectedValue(new ApiError("Forbidden", 403, "FORBIDDEN"));
    renderView();
    expect(await screen.findByText("Permission required")).toBeInTheDocument();
    // The other panels still render.
    expect(await screen.findByText("connector.sync")).toBeInTheDocument();
  });
});
