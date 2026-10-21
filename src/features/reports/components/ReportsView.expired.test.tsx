import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn(), run: vi.fn() }));
vi.mock("@/features/reports/api", () => ({
  get: (...args: unknown[]) => api.get(...args),
  download: (...args: unknown[]) => api.download(...args),
  run: (...args: unknown[]) => api.run(...args),
}));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useTenantSession } from "@/lib/auth/session";
import { ReportDetail } from "./ReportsView";

function renderDetail() {
  vi.mocked(useTenantSession).mockReturnValue({
    permissions: ["reports.view", "reports.export"],
  } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReportDetail reportId="r1" />
    </QueryClientProvider>,
  );
}

const baseReport = {
  _id: "r1",
  name: "Weekly revenue",
  source: "query",
  format: "csv",
  status: "active",
  schedule: { enabled: false },
};

beforeEach(() => vi.clearAllMocks());

describe("ReportDetail (retention: expired files)", () => {
  it("says the latest file expired and offers no download", async () => {
    api.get.mockResolvedValue({
      ...baseReport,
      runs: [
        {
          _id: "run1",
          status: "ready",
          format: "csv",
          triggeredBy: "manual",
          finishedAt: "2026-09-01T10:00:00.000Z",
          expiredAt: "2026-10-01T03:00:00.000Z",
        },
      ],
    });
    renderDetail();
    expect(await screen.findByText(/The latest file expired on/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).not.toBeInTheDocument();
    expect(screen.getByText(/file expired/, { selector: "span" })).toBeInTheDocument();
  });

  it("shows a 410 from the download endpoint as an expired file", async () => {
    api.get.mockResolvedValue({
      ...baseReport,
      runs: [
        {
          _id: "run1",
          status: "ready",
          format: "csv",
          triggeredBy: "manual",
          resultKey: "reports/t1/r1/run1.csv",
          finishedAt: "2026-09-01T10:00:00.000Z",
        },
      ],
    });
    api.download.mockRejectedValue(
      new ApiError(
        "This report artefact expired on 2026-10-01T03:00:00.000Z. Request a new report artefact.",
        410,
        "EXPORT_EXPIRED",
      ),
    );
    renderDetail();
    await userEvent.click(await screen.findByRole("button", { name: /Download latest/ }));
    expect(await screen.findByText("Report download expired")).toBeInTheDocument();
    expect(api.download).toHaveBeenCalledWith("r1", "run1");
  });
});
