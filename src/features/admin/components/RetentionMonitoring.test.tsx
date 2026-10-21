import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ retentionStatus: vi.fn() }));
vi.mock("@/features/admin/api", () => api);

import { RetentionMonitoring } from "./RetentionMonitoring";

function renderView() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RetentionMonitoring />
    </QueryClientProvider>,
  );
}

const policies = [
  {
    key: "accessLogs",
    collection: "AccessLog",
    envKey: "RETENTION_ACCESS_LOG_DAYS",
    days: 30,
    enabled: true,
    cutoff: "2026-09-20T03:00:00.000Z",
    field: "occurredAt",
    enforcedBy: "cleanup-job",
    description: "HTTP access trace.",
  },
  {
    key: "archivedTenants",
    collection: "Tenant",
    envKey: "RETENTION_ARCHIVED_TENANT_DAYS",
    days: 0,
    enabled: false,
    cutoff: null,
    field: "archivedAt",
    enforcedBy: "cleanup-job",
    description: "All data of archived tenants.",
  },
  {
    key: "idempotencyKeys",
    collection: "cache",
    envKey: "RETENTION_IDEMPOTENCY_DAYS",
    days: 1,
    enabled: true,
    cutoff: null,
    field: null,
    enforcedBy: "cache-ttl",
    description: "Idempotency outcomes expire from the cache.",
  },
];

beforeEach(() => vi.clearAllMocks());

describe("RetentionMonitoring", () => {
  it("lists each policy with its window, enforcement and last-run count", async () => {
    api.retentionStatus.mockResolvedValue({
      checkedAt: "2026-10-20T10:00:00.000Z",
      job: {
        name: "cleanup",
        enabled: true,
        cronExpression: "0 3 * * *",
        dryRun: false,
        batchSize: 500,
        maxBatchesPerRun: 200,
      },
      legalHoldTenantIds: ["t-held"],
      policies,
      lastRun: {
        id: "r1",
        job: "cleanup",
        instanceId: "w1",
        trigger: "schedule",
        status: "succeeded",
        startedAt: "2026-10-20T03:00:00.000Z",
        finishedAt: "2026-10-20T03:00:05.000Z",
        durationMs: 5000,
        counts: { accessLogs: 42, dryRun: 0 },
        error: null,
      },
      lastSuccessAt: "2026-10-20T03:00:05.000Z",
    });
    renderView();
    expect(await screen.findByText("HTTP access trace.")).toBeInTheDocument();
    expect(screen.getByText("Enforced")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("42 deleted")).toBeInTheDocument();
    expect(screen.getByText("Not purged")).toBeInTheDocument();
    expect(screen.getByText("Cache expiry")).toBeInTheDocument();
    expect(screen.getByText(/Legal holds: t-held/)).toBeInTheDocument();
  });

  it("says plainly when the cleanup job is disabled", async () => {
    api.retentionStatus.mockResolvedValue({
      checkedAt: "2026-10-20T10:00:00.000Z",
      job: {
        name: "cleanup",
        enabled: false,
        cronExpression: "0 3 * * *",
        dryRun: false,
        batchSize: 500,
        maxBatchesPerRun: 200,
      },
      legalHoldTenantIds: [],
      policies,
      lastRun: null,
      lastSuccessAt: null,
    });
    renderView();
    expect(await screen.findByText("Cleanup job disabled")).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is purged until the cleanup job is enabled/),
    ).toBeInTheDocument();
  });
});
