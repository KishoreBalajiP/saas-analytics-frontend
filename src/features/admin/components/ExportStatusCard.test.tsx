import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExportStatus } from "@/features/admin/api";
import { ApiError } from "@/lib/api/client";

import { isExportExpiredError } from "@/features/admin/lib/exportExpiry";

import { ExportStatusCard } from "./ExportStatusCard";

function renderCard(fetchStatus: (id: string) => Promise<ExportStatus>, onReset = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExportStatusCard
        exportId="exp_1"
        fetchStatus={fetchStatus}
        queryKey={["test", "export"]}
        onReset={onReset}
        pollMs={20}
      />
    </QueryClientProvider>,
  );
  return { onReset };
}

beforeEach(() => vi.clearAllMocks());

describe("ExportStatusCard", () => {
  it("polls a queued export until it completes, then offers the download and its expiry", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ exportId: "exp_1", status: "queued" })
      .mockResolvedValue({
        exportId: "exp_1",
        status: "completed",
        recordCount: 12,
        expiresAt: "2026-10-22T10:00:00.000Z",
        downloadUrl: "https://bucket.example.com/exp_1.json?sig=abc",
        fileName: "audit-export.json",
      });
    renderCard(fetchStatus);
    expect(await screen.findByText(/12 records · available until/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /download audit-export\.json/i });
    expect(link).toHaveAttribute("href", "https://bucket.example.com/exp_1.json?sig=abc");
    const calls = fetchStatus.mock.calls.length;
    await new Promise((r) => setTimeout(r, 80));
    expect(fetchStatus.mock.calls.length).toBe(calls);
  });

  it("does not offer a non-http pseudo URL as a link", async () => {
    const fetchStatus = vi.fn().mockResolvedValue({
      exportId: "exp_1",
      status: "completed",
      recordCount: 1,
      downloadUrl: "local:///tmp/storage/exp_1.json",
    });
    renderCard(fetchStatus);
    expect(await screen.findByText(/1 records/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an expired export (410 EXPORT_EXPIRED), stops polling and asks for a new export", async () => {
    const fetchStatus = vi
      .fn()
      .mockRejectedValue(
        new ApiError("This export expired. Request a new export.", 410, "EXPORT_EXPIRED"),
      );
    const { onReset } = renderCard(fetchStatus);
    expect(await screen.findByText(/has expired and its file was deleted/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 80));
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /request a new export/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("shows other errors without claiming expiry", async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new ApiError("Audit export not found", 404));
    renderCard(fetchStatus);
    expect(await screen.findByText("Audit export not found")).toBeInTheDocument();
    expect(screen.queryByText(/has expired/)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /dismiss export/i })).toBeVisible(),
    );
  });

  it("recognises the expiry error", () => {
    expect(isExportExpiredError(new ApiError("x", 410, "EXPORT_EXPIRED"))).toBe(true);
    expect(isExportExpiredError(new ApiError("x", 404, "NOT_FOUND"))).toBe(false);
    expect(isExportExpiredError(new Error("x"))).toBe(false);
  });
});
