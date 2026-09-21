import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as notificationsApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);

beforeEach(() => vi.clearAllMocks());

describe("notifications API contract", () => {
  it("lists notifications and unread count", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    request.mockResolvedValue({ count: 0 });
    await notificationsApi.list({ unreadOnly: true });
    await notificationsApi.unreadCount();
    expect(requestPaged).toHaveBeenCalledWith("/notifications", { query: { unreadOnly: true } });
    expect(request).toHaveBeenCalledWith("/notifications/unread-count");
  });
  it("uses read, delete, and preference endpoints", async () => {
    request.mockResolvedValue({});
    await notificationsApi.markRead("n1");
    await notificationsApi.markAllRead();
    await notificationsApi.updatePreferences({ email: true });
    await notificationsApi.remove("n1");
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/notifications/n1/read",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/notifications/read-all",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      "/notifications/preferences",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      4,
      "/notifications/n1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
