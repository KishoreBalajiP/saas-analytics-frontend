import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as apiKeysApi from "./index";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
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
});
