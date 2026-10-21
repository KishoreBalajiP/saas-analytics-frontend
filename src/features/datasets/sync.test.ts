import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import {
  formatDuration,
  isSyncInFlight,
  syncErrorMessage,
  syncStatusLabel,
  syncStatusVariant,
  syncTriggerLabel,
} from "./sync";

describe("dataset sync helpers", () => {
  it("treats queued and running as in flight", () => {
    expect(isSyncInFlight({ syncStatus: "queued" })).toBe(true);
    expect(isSyncInFlight({ syncStatus: "running" })).toBe(true);
    expect(isSyncInFlight({ syncStatus: "failed" })).toBe(false);
    expect(isSyncInFlight(undefined)).toBe(false);
  });

  it("does not block a new sync once the in-flight sync lost its lease", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(
      isSyncInFlight({ syncStatus: "running", syncLeaseUntil: "2026-10-20T12:05:00Z" }, now),
    ).toBe(true);
    expect(
      isSyncInFlight({ syncStatus: "running", syncLeaseUntil: "2026-10-20T11:55:00Z" }, now),
    ).toBe(false);
    expect(isSyncInFlight({ syncStatus: "queued", syncLeaseUntil: null }, now)).toBe(true);
    expect(
      isSyncInFlight({ syncStatus: "failed", syncLeaseUntil: "2026-10-20T12:05:00Z" }, now),
    ).toBe(false);
  });

  it("explains a sync conflict and a queue outage in plain words", () => {
    expect(syncErrorMessage(new ApiError("busy", 409, "SYNC_IN_PROGRESS"))).toMatch(
      /already running/,
    );
    expect(syncErrorMessage(new ApiError("timeout", 503, "QUEUE_TIMEOUT"))).toMatch(
      /temporarily unavailable/,
    );
    expect(syncErrorMessage(new ApiError("down", 503, "QUEUE_UNAVAILABLE"))).toMatch(
      /Nothing was queued/,
    );
    expect(syncErrorMessage(new ApiError("Invalid file", 422, "PAYLOAD_INVALID"))).toBe(
      "Invalid file",
    );
    expect(syncErrorMessage(new Error("boom"))).toBe("boom");
    expect(syncErrorMessage("??")).toBe("Sync failed");
  });

  it("keeps the server message for other 409 / 503 codes", () => {
    // A paused connector also answers 409: it must not read as "already running".
    expect(
      syncErrorMessage(new ApiError("This connector is paused.", 409, "CONNECTOR_PAUSED")),
    ).toBe("This connector is paused.");
    expect(syncErrorMessage(new ApiError("Quota reached", 409, "QUOTA_EXCEEDED"))).toBe(
      "Quota reached",
    );
    expect(syncErrorMessage(new ApiError("Replay store down", 503, "OTHER_OUTAGE"))).toBe(
      "Replay store down",
    );
    // A bare status (no code) keeps the sync-slot meaning.
    expect(syncErrorMessage(new ApiError("busy", 409))).toMatch(/already running/);
    expect(syncErrorMessage(new ApiError("down", 503))).toMatch(/temporarily unavailable/);
  });

  it("labels statuses and triggers", () => {
    expect(syncStatusLabel("abandoned")).toBe("Interrupted");
    expect(syncStatusLabel(undefined)).toBe("Never synced");
    expect(syncStatusVariant("failed")).toBe("destructive");
    expect(syncStatusVariant("running")).toBe("secondary");
    expect(syncStatusVariant("succeeded")).toBe("default");
    expect(syncTriggerLabel("recovery")).toBe("Automatic recovery");
  });

  it("formats durations", () => {
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(12345)).toBe("12.3 s");
    expect(formatDuration(245000)).toBe("4 min 05 s");
    expect(formatDuration(null)).toBe("—");
  });
});
