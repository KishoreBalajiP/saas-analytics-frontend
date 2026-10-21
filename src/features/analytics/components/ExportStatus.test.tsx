import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

const api = vi.hoisted(() => ({ getExport: vi.fn(), downloadExport: vi.fn() }));
vi.mock("@/features/analytics/api", () => ({
  getExport: (...args: unknown[]) => api.getExport(...args),
  downloadExport: (...args: unknown[]) => api.downloadExport(...args),
}));

import { ExportStatus } from "./ExportStatus";

let clicked: Array<{ href: string; download: string }> = [];

function renderStatus(onDismiss = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ExportStatus exportId="e1" onDismiss={onDismiss} />
    </QueryClientProvider>,
  );
  return { onDismiss };
}

beforeEach(() => {
  vi.clearAllMocks();
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push({ href: this.href, download: this.download });
  });
});

afterEach(() => vi.restoreAllMocks());

describe("ExportStatus", () => {
  it("polls a queued export until it is ready, then downloads it through the signed link", async () => {
    api.getExport
      .mockResolvedValueOnce({ exportId: "e1", status: "pending", format: "xlsx" })
      .mockResolvedValueOnce({ exportId: "e1", status: "running", format: "xlsx" })
      .mockResolvedValue({
        exportId: "e1",
        status: "ready",
        format: "xlsx",
        rowCount: 250,
        truncated: false,
        fileName: "analytics-export-2026-10-20-0900.xlsx",
      });
    api.downloadExport.mockResolvedValue({
      exportId: "e1",
      url: "/api/v1/files/abc.def",
      expiresAt: "2026-10-20T09:05:00.000Z",
      fileName: "analytics-export-2026-10-20-0900.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      format: "xlsx",
      truncated: false,
    });
    renderStatus();
    expect(await screen.findByText("Queued…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    expect(await screen.findByText("Generating…", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(await screen.findByText("Ready", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText("250 rows")).toBeInTheDocument();
    const callsWhenReady = api.getExport.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /download/i }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(api.downloadExport).toHaveBeenCalledWith("e1");
    expect(clicked[0]).toEqual({
      href: "http://localhost:8080/api/v1/files/abc.def",
      download: "analytics-export-2026-10-20-0900.xlsx",
    });
    // Polling stops once the export is ready.
    await new Promise((r) => setTimeout(r, 1700));
    expect(api.getExport.mock.calls.length).toBe(callsWhenReady);
  }, 10_000);

  it("shows a truncated export and a failed one", async () => {
    api.getExport.mockResolvedValue({
      exportId: "e1",
      status: "ready",
      format: "csv",
      rowCount: 1000,
      truncated: true,
      rowLimit: 1000,
    });
    renderStatus();
    expect(
      await screen.findByText(`Truncated at ${(1000).toLocaleString()} rows`),
    ).toBeInTheDocument();
  });

  it("explains a failed export and lets the user dismiss it", async () => {
    api.getExport.mockResolvedValue({
      exportId: "e1",
      status: "failed",
      format: "csv",
      error: "Invalid analytics query: filters[0].op must be one of eq",
    });
    const { onDismiss } = renderStatus();
    expect(await screen.findByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/filters\[0\]\.op must be one of eq/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("stops polling when the export status cannot be read", async () => {
    api.getExport.mockRejectedValue(new ApiError("Export not found", 404, "NOT_FOUND"));
    renderStatus();
    await waitFor(() => expect(api.getExport).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 1700));
    expect(api.getExport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
  });

  it("shows a refused download", async () => {
    api.getExport.mockResolvedValue({
      exportId: "e1",
      status: "ready",
      format: "csv",
      rowCount: 1,
    });
    api.downloadExport.mockRejectedValue(
      new ApiError("This export is not ready yet", 409, "EXPORT_NOT_READY"),
    );
    renderStatus();
    fireEvent.click(await screen.findByRole("button", { name: /download/i }));
    expect(await screen.findByText("This export is not ready yet")).toBeInTheDocument();
    expect(clicked).toHaveLength(0);
  });
});
