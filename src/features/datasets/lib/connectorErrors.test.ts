import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { FieldError } from "@/lib/api/types";
import { describeUploadError } from "./connectorErrors";

describe("describeUploadError", () => {
  it("explains a 413 FILE_TOO_LARGE with the server's limit", () => {
    const error = new ApiError(
      "The file is larger than the 10 MB limit for CSV uploads.",
      413,
      "FILE_TOO_LARGE",
    );
    const described = describeUploadError(error, "csv");
    expect(described.title).toBe("File too large");
    expect(described.description).toContain("10 MB limit");
    expect(described.description).toContain("Split the file");
  });

  it("explains a 415 UNSUPPORTED_FILE_TYPE with the accepted types for the connector", () => {
    const error = new ApiError(
      "Unsupported file type. Upload a .csv or .xlsx file.",
      415,
      "UNSUPPORTED_FILE_TYPE",
    );
    expect(describeUploadError(error, "xlsx")).toEqual({
      title: "Unsupported file type",
      description:
        "Unsupported file type. Upload a .csv or .xlsx file. This connector accepts .xlsx files.",
    });
  });

  it("explains a 415 FILE_TYPE_MISMATCH", () => {
    const error = new ApiError(
      "This connector accepts .csv (or .txt) files only.",
      415,
      "FILE_TYPE_MISMATCH",
    );
    const described = describeUploadError(error, "csv");
    expect(described.title).toBe("File type does not match");
    expect(described.description).toContain(".csv or .txt");
  });

  it("keeps row / column limit messages distinct from size limits", () => {
    const error = new ApiError("The source has more than 100000 rows", 413, "ROW_LIMIT_EXCEEDED");
    expect(describeUploadError(error, "xlsx").title).toBe("File has too much data");
  });

  it("names inactive workspaces and paused connectors", () => {
    expect(describeUploadError(new ApiError("x", 403, "TENANT_NOT_ACTIVE")).title).toBe(
      "Workspace not active",
    );
    expect(describeUploadError(new ApiError("x", 409, "CONNECTOR_PAUSED")).title).toBe(
      "Connector paused",
    );
  });

  it("explains a sync refused because another sync runs or the queue is down", () => {
    expect(describeUploadError(new ApiError("busy", 409, "SYNC_IN_PROGRESS"), "csv")).toEqual({
      title: "Sync already running",
      description: expect.stringMatching(/already running/),
    });
    expect(describeUploadError(new ApiError("t", 503, "QUEUE_TIMEOUT"), "csv").title).toBe(
      "Sync service unavailable",
    );
  });

  it("treats a code-less 409 / 503 as a sync-slot problem only for a sync", () => {
    const gateway = new ApiError("Service Unavailable", 503);
    expect(describeUploadError(gateway, "csv", { action: "sync" }).title).toBe(
      "Sync service unavailable",
    );
    expect(
      describeUploadError(new ApiError("Conflict", 409), "csv", { action: "sync" }).title,
    ).toBe("Sync already running");
    // A failed preview is an upload problem, whatever the status.
    expect(describeUploadError(gateway, "csv", { action: "preview" })).toEqual({
      title: "Upload failed",
      description: "Service Unavailable",
    });
    expect(describeUploadError(gateway, "csv").title).toBe("Upload failed");
  });

  it("falls back to the error message for other failures", () => {
    expect(describeUploadError(new Error("network down"))).toEqual({
      title: "Upload failed",
      description: "network down",
    });
    expect(describeUploadError("boom").description).toMatch(/Try again/);
  });

  it("explains a stored-rows plan limit with the shared quota sentence on sync", () => {
    const error = new ApiError(
      "Plan limit reached for storedRows (max 1000)",
      409,
      "QUOTA_EXCEEDED",
      [
        {
          field: "storedRows",
          message: "Plan limit reached for storedRows (max 1000)",
          metric: "storedRows",
          limit: 1000,
          current: 1200,
          period: "current",
        } as FieldError,
      ],
    );
    const described = describeUploadError(error, "csv", { action: "sync" });
    expect(described.title).toBe("Plan limit reached");
    expect(described.description).toBe(
      "Plan limit reached: your plan allows 1,000 stored rows and 1,200 are in use. Delete data you no longer need or upgrade your plan.",
    );
  });
});
