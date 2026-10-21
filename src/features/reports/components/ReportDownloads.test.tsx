import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { Report } from "@/lib/api/types";

const api = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn(), run: vi.fn() }));
vi.mock("@/features/reports/api", () => ({
  get: (...args: unknown[]) => api.get(...args),
  download: (...args: unknown[]) => api.download(...args),
  run: (...args: unknown[]) => api.run(...args),
}));
const session = vi.hoisted(() => ({ permissions: ["reports.view", "reports.export"] as string[] }));
vi.mock("@/lib/auth/session", () => ({ useTenantSession: () => session }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReportDetail } from "./ReportsView";

const report: Report = {
  _id: "r1",
  name: "Weekly sales",
  source: "query",
  format: "xlsx",
  runs: [
    {
      _id: "run-old",
      triggeredBy: "schedule",
      format: "csv",
      status: "ready",
      rowCount: 1000000,
      truncated: true,
      rowLimit: 1000000,
      resultKey: "reports/t/r1/run-old.csv",
      finishedAt: "2026-10-19T08:00:00.000Z",
    },
    {
      _id: "run-failed",
      triggeredBy: "manual",
      format: "json",
      status: "failed",
      error: "Invalid analytics query: query.filters[0].op must be one of eq",
      finishedAt: "2026-10-19T09:00:00.000Z",
    },
    {
      _id: "run-new",
      triggeredBy: "manual",
      format: "xlsx",
      status: "ready",
      rowCount: 52341,
      truncated: false,
      rowLimit: null,
      resultKey: "reports/t/r1/run-new.xlsx",
      finishedAt: "2026-10-20T08:00:00.000Z",
    },
    { _id: "run-pending", triggeredBy: "manual", format: "csv", status: "pending" },
  ],
};

let clicked: Array<{ href: string; download: string }> = [];

function renderDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReportDetail reportId="r1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  session.permissions = ["reports.view", "reports.export"];
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download });
  });
  api.get.mockResolvedValue(report);
});

afterEach(() => vi.restoreAllMocks());

describe("Report run history and downloads", () => {
  it("lists runs newest first with format, rows, the truncated flag and failures", async () => {
    renderDetail();
    const list = await screen.findByRole("list", { name: "Report runs" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(/pending/i);
    expect(items[1]).toHaveTextContent("xlsx");
    expect(items[1]).toHaveTextContent(`${(52341).toLocaleString()} rows`);
    expect(items[1]).not.toHaveTextContent(/truncated/i);
    expect(items[2]).toHaveTextContent(/failed/i);
    expect(items[2]).toHaveTextContent("query.filters[0].op must be one of eq");
    const million = (1000000).toLocaleString();
    expect(items[3]).toHaveTextContent(`${million} rows`);
    expect(items[3]).toHaveTextContent(`Truncated at ${million} rows`);
    expect(items[3]).toHaveTextContent("Scheduled");
    // Only ready runs with a file can be downloaded.
    expect(within(items[0]!).queryByRole("button", { name: /download/i })).toBeNull();
    expect(within(items[2]!).queryByRole("button", { name: /download/i })).toBeNull();
  });

  it("downloads a run through its short-lived signed link", async () => {
    api.download.mockResolvedValue({
      url: "/api/v1/files/payload.signature",
      expiresAt: "2026-10-20T08:05:00.000Z",
      fileName: "weekly-sales-2026-10-19-0800.csv",
      contentType: "text/csv; charset=utf-8",
      format: "csv",
      rowCount: 1000000,
      truncated: true,
      runId: "run-old",
      status: "ready",
    });
    renderDetail();
    const list = await screen.findByRole("list", { name: "Report runs" });
    const oldRun = within(list).getAllByRole("listitem")[3]!;
    fireEvent.click(within(oldRun).getByRole("button", { name: /download csv/i }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(api.download).toHaveBeenCalledWith("r1", "run-old");
    expect(clicked[0]!.href).toBe("http://localhost:8080/api/v1/files/payload.signature");
    expect(clicked[0]!.download).toBe("weekly-sales-2026-10-19-0800.csv");
  });

  it("'Download latest' uses the newest ready run and keeps absolute (S3) links", async () => {
    api.download.mockResolvedValue({
      url: "https://bucket.s3.amazonaws.com/storage/reports/x.xlsx?X-Amz-Signature=abc",
      expiresAt: "2026-10-20T08:05:00.000Z",
      fileName: "weekly-sales.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      format: "xlsx",
      truncated: false,
      runId: "run-new",
      status: "ready",
    });
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /download latest/i }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(api.download).toHaveBeenCalledWith("r1", "run-new");
    expect(clicked[0]!.href).toBe(
      "https://bucket.s3.amazonaws.com/storage/reports/x.xlsx?X-Amz-Signature=abc",
    );
  });

  it("shows why a download was refused", async () => {
    api.download.mockRejectedValue(
      new ApiError("No generated artefact available", 404, "NOT_FOUND"),
    );
    renderDetail();
    fireEvent.click(await screen.findByRole("button", { name: /download latest/i }));
    expect(await screen.findByText(/report download/i)).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
  });

  it("offers no download or generate without reports.export", async () => {
    session.permissions = ["reports.view"];
    renderDetail();
    await screen.findByRole("list", { name: "Report runs" });
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /generate/i })).toBeNull();
  });
});
