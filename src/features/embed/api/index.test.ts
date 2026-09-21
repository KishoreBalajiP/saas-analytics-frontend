import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as embedApi from "./index";

vi.mock("@/lib/api/client", () => ({
  apiUrl: vi.fn((path: string) => `https://example.test${path}`),
  request: vi.fn(),
  requestPaged: vi.fn(),
}));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
beforeEach(() => vi.clearAllMocks());

describe("embed contract", () => {
  it("lists and creates one-time tokens", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    request.mockResolvedValue({ token: { id: "e1" }, secret: "test-only-token" });
    await embedApi.list({ dashboardId: "d1" });
    await embedApi.create({ dashboardId: "d1", ttlSec: 3600 });
    expect(requestPaged).toHaveBeenCalledWith("/embed/tokens", { query: { dashboardId: "d1" } });
    expect(request).toHaveBeenCalledWith(
      "/embed/tokens",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("uses public execution and revoke endpoints", async () => {
    request.mockResolvedValue([]);
    await embedApi.getEmbed("test-only-token");
    await embedApi.revoke("e1");
    expect(request).toHaveBeenNthCalledWith(1, "/embed/test-only-token", { audience: "public" });
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/embed/tokens/e1/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
