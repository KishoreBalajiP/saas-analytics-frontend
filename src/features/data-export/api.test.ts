import { beforeEach, describe, expect, it, vi } from "vitest";

import * as client from "@/lib/api/client";
import * as api from "./api";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("data export API", () => {
  it("uses the workspace and admin endpoints", async () => {
    await api.requestWorkspaceExport();
    await api.workspaceDownloadUrl("tex_1");
    await api.requestTenantExport("t1", "Support case");
    await api.deleteTenantExport("t1", "tex_2");
    const request = vi.mocked(client.request);
    expect(request).toHaveBeenNthCalledWith(1, "/workspace/data-exports", {
      method: "POST",
      body: {},
    });
    expect(request).toHaveBeenNthCalledWith(2, "/workspace/data-exports/tex_1/download-url", {
      method: "POST",
      body: {},
    });
    expect(request).toHaveBeenNthCalledWith(3, "/tenants/t1/data-exports", {
      method: "POST",
      audience: "admin",
      body: { reason: "Support case" },
    });
    expect(request).toHaveBeenNthCalledWith(4, "/tenants/t1/data-exports/tex_2", {
      method: "DELETE",
      audience: "admin",
    });
  });
});
