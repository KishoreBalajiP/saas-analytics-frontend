import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  mailHealth: vi.fn(),
  listOutbox: vi.fn(),
  requeueOutboxMessage: vi.fn(),
}));
vi.mock("@/features/admin/api", () => api);
vi.mock("@/lib/auth/session", () => ({ useAdminSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useAdminSession } from "@/lib/auth/session";
import { MailMonitoring } from "./MailMonitoring";

function asAdmin(permissions: string[]) {
  vi.mocked(useAdminSession).mockReturnValue({ permissions } as never);
}

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MailMonitoring />
    </QueryClientProvider>,
  );
}

const dead = {
  id: "m1",
  tenantId: "t1",
  to: ["al***@example.com"],
  template: "alert-triggered",
  status: "dead",
  attempts: 6,
  maxAttempts: 6,
  nextAttemptAt: null,
  lastAttemptAt: "2026-10-20T10:00:00.000Z",
  sentAt: null,
  deadAt: "2026-10-20T10:00:00.000Z",
  lastError: { code: "SEND_FAILED", message: "connect ETIMEDOUT" },
  transport: null,
  createdAt: "2026-10-20T09:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  api.mailHealth.mockResolvedValue({
    status: "degraded",
    transport: "smtp",
    checkedAt: "2026-10-20T10:00:00.000Z",
    verify: { ok: true, checkedAt: "2026-10-20T10:00:00.000Z", error: null },
    sends: {
      lastSuccessAt: null,
      lastFailureAt: "2026-10-20T10:00:00.000Z",
      lastError: { code: "SEND_FAILED", message: "connect ETIMEDOUT" },
      consecutiveFailures: 1,
    },
    outbox: {
      pending: 2,
      sending: 0,
      retrying: 1,
      sent: 10,
      dead: 1,
      backlog: 3,
      oldestDueAt: null,
      backlogAgeMs: 0,
      lastSentAt: "2026-10-20T08:00:00.000Z",
    },
  });
  api.listOutbox.mockResolvedValue({
    data: [dead],
    meta: { page: 1, limit: 20, total: 1, pages: 1 },
  });
  api.requeueOutboxMessage.mockResolvedValue({ ...dead, status: "pending", attempts: 0 });
});

describe("MailMonitoring", () => {
  it("shows mail health, backlog and dead letters with masked recipients", async () => {
    asAdmin(["monitoring.view"]);
    renderView();
    expect(await screen.findByText(/backlog 3 · dead letters 1/)).toBeInTheDocument();
    expect(screen.getByText(/Some messages are dead-lettered/)).toBeInTheDocument();
    expect(await screen.findByText("al***@example.com")).toBeInTheDocument();
    expect(screen.getByText("Last failure: connect ETIMEDOUT")).toBeInTheDocument();
  });

  it("hides requeue without monitoring.update", async () => {
    asAdmin(["monitoring.view"]);
    renderView();
    expect(await screen.findByText("al***@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /requeue/i })).not.toBeInTheDocument();
  });

  it("requeues a dead letter with monitoring.update", async () => {
    asAdmin(["monitoring.view", "monitoring.update"]);
    renderView();
    await userEvent.click(
      await screen.findByRole("button", { name: /requeue alert-triggered message/i }),
    );
    await waitFor(() => expect(api.requeueOutboxMessage).toHaveBeenCalledWith("m1"));
  });

  it("filters the outbox by status", async () => {
    asAdmin(["monitoring.view"]);
    renderView();
    await screen.findByText("al***@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Dead letters" }));
    await waitFor(() =>
      expect(api.listOutbox).toHaveBeenLastCalledWith({ page: 1, limit: 20, status: "dead" }),
    );
  });

  it("explains a disabled transport", async () => {
    asAdmin(["monitoring.view"]);
    api.mailHealth.mockResolvedValue({
      status: "disabled",
      transport: "noop",
      checkedAt: "2026-10-20T10:00:00.000Z",
      verify: null,
      sends: { lastSuccessAt: null, lastFailureAt: null, lastError: null, consecutiveFailures: 0 },
      outbox: {
        pending: 0,
        sending: 0,
        retrying: 0,
        sent: 0,
        dead: 0,
        backlog: 0,
        oldestDueAt: null,
        backlogAgeMs: 0,
        lastSentAt: null,
      },
    });
    renderView();
    expect(await screen.findByText(/No mail transport is configured/)).toBeInTheDocument();
  });
});
