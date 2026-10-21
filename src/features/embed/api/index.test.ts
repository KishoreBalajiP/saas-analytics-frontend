import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as embedApi from "./index";

vi.mock("@/lib/api/client", async (orig) => {
  const actual = await orig<typeof import("@/lib/api/client")>();
  return {
    ApiError: actual.ApiError,
    apiUrl: vi.fn((path: string) => `https://api.example.test${path}`),
    request: vi.fn(),
    requestPaged: vi.fn(),
  };
});
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("embed contract", () => {
  it("lists and mints origin-bound tokens", async () => {
    requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
    request.mockResolvedValue({ token: { id: "e1" }, secret: "a.b.c" });
    await embedApi.list({ dashboardId: "d1" });
    await embedApi.create({
      dashboardId: "d1",
      ttlSec: 3600,
      allowedOrigins: ["https://host.test"],
    });
    expect(requestPaged).toHaveBeenCalledWith("/embed/tokens", { query: { dashboardId: "d1" } });
    expect(request).toHaveBeenCalledWith("/embed/tokens", {
      method: "POST",
      body: { dashboardId: "d1", ttlSec: 3600, allowedOrigins: ["https://host.test"] },
    });
  });

  it("public calls keep tokens out of URLs and send no cookies", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { sessionToken: "s" } }) });
    await embedApi.exchangeSession("signed.jwt.token", "https://host.test");
    await embedApi.viewEmbed("s", "https://host.test");
    for (const [url, init] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain("signed.jwt.token");
      expect(init.credentials).toBe("omit");
    }
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.test/embed/public/session");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({
      token: "signed.jwt.token",
      parentOrigin: "https://host.test",
    });
    expect(fetchMock.mock.calls[1]?.[1].headers.Authorization).toBe("Bearer s");
  });

  it("maps public errors to ApiError with the code", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "no", code: "EMBED_ORIGIN_NOT_ALLOWED" }),
    });
    await expect(embedApi.exchangeSession("t", "https://x.test")).rejects.toMatchObject({
      statusCode: 403,
      code: "EMBED_ORIGIN_NOT_ALLOWED",
    });
  });
});
