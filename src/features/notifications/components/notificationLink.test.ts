import { describe, expect, it } from "vitest";

import type { Notification } from "@/lib/api/types";

import { notificationLink } from "./NotificationsView";

const n = (data?: Record<string, unknown>): Notification => ({
  _id: "n1",
  type: "system",
  title: "t",
  read: false,
  createdAt: "2026-01-01T00:00:00Z",
  ...(data ? { data } : {}),
});

describe("notificationLink", () => {
  it("links to the affected alert or report", () => {
    expect(notificationLink(n({ alertId: "a1" }))).toBe("/alerts/a1");
    expect(notificationLink(n({ reportId: "r1", runId: "x" }))).toBe("/reports/r1");
  });
  it("has no link without a safe resource id", () => {
    expect(notificationLink(n())).toBeNull();
    expect(notificationLink(n({ alertId: "../admin" }))).toBeNull();
  });
});
