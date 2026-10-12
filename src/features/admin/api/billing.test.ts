import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";
import * as adminBilling from "./billing";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
beforeEach(() => vi.clearAllMocks());

describe("admin billing API contract", () => {
  it("exposes transaction, webhook and reconcile endpoints with admin audience", async () => {
    request.mockResolvedValue([]);
    await adminBilling.listTransactions("t1", { limit: 20 });
    await adminBilling.listWebhooks("t1", { limit: 20 });
    await adminBilling.triggerReconcile({ limit: 25 });
    expect(request).toHaveBeenNthCalledWith(1, "/admin/subscriptions/t1/transactions", {
      audience: "admin",
      query: { limit: 20 },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/admin/subscriptions/t1/webhooks", {
      audience: "admin",
      query: { limit: 20 },
    });
    expect(request).toHaveBeenNthCalledWith(3, "/admin/subscriptions/reconcile", {
      audience: "admin",
      method: "POST",
      query: { limit: 25 },
    });
  });
});
