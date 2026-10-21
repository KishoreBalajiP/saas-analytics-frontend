import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as apiKeysApi from "./index";

vi.mock("@/lib/api/client", () => ({
  apiUrl: vi.fn((p: string) => `https://api.test${p}`),
  request: vi.fn(),
  requestFull: vi.fn(),
  requestPaged: vi.fn(),
}));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
beforeEach(() => vi.clearAllMocks());

describe("API keys contract", () => {
  it("lists metadata without a secret field", async () => {
    requestPaged.mockResolvedValue({
      data: [
        {
          id: "k1",
          prefix: "sak_test",
          name: "Analytics",
          scopes: ["analytics:query"],
          status: "active",
        },
      ],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    const result = await apiKeysApi.list();
    expect(result.data[0]).not.toHaveProperty("secret");
    expect(requestPaged).toHaveBeenCalledWith("/api-keys", { query: {} });
  });
  it("creates and revokes using the existing endpoints", async () => {
    request.mockResolvedValue({ key: { id: "k1" }, secret: "test-only-secret" });
    await apiKeysApi.create({ name: "Analytics", scopes: ["analytics:query", "dashboards:read"] });
    await apiKeysApi.revoke("k1", "retired");
    expect(request).toHaveBeenNthCalledWith(
      1,
      "/api-keys",
      expect.objectContaining({ method: "POST" }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      "/api-keys/k1/revoke",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("rotates, reads usage and the scope catalogue", async () => {
    request.mockResolvedValue({});
    await apiKeysApi.rotate("k1");
    await apiKeysApi.usage("k1", 7);
    expect(request).toHaveBeenNthCalledWith(1, "/api-keys/k1/rotate", { method: "POST", body: {} });
    expect(request).toHaveBeenNthCalledWith(2, "/api-keys/k1/usage", { query: { days: 7 } });
    vi.mocked(client.requestFull).mockResolvedValue({
      data: [{ scope: "datasets:read", description: "d" }],
      meta: { maxTtlDays: 30, rotationOverlapMinutes: 60 },
    } as never);
    expect(await apiKeysApi.scopes()).toEqual({
      scopes: [{ scope: "datasets:read", description: "d" }],
      maxTtlDays: 30,
      rotationOverlapMinutes: 60,
    });
  });
});
