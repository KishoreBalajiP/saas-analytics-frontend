import { beforeEach, describe, expect, it, vi } from "vitest";

import * as client from "@/lib/api/client";
import * as supportApi from "./api";

vi.mock("@/lib/api/client", () => ({ request: vi.fn(), requestPaged: vi.fn() }));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);

beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue({});
  requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 0 } });
});

describe("workspace support access API", () => {
  it("reads the workspace's support access and activity", async () => {
    await supportApi.getWorkspaceSupportAccess();
    await supportApi.listSupportActivity({ limit: 20 });
    expect(request).toHaveBeenCalledWith("/workspace/support-access");
    expect(requestPaged).toHaveBeenCalledWith("/workspace/support-access/activity", {
      query: { limit: 20 },
    });
  });

  it("grants consent with durationHours (+ note only when given)", async () => {
    await supportApi.grantSupportAccess({ durationHours: 4 });
    await supportApi.grantSupportAccess({ durationHours: 24, note: "Ticket 4711" });
    expect(request).toHaveBeenNthCalledWith(1, "/workspace/support-access/grants", {
      method: "POST",
      body: { durationHours: 4 },
    });
    expect(request).toHaveBeenNthCalledWith(2, "/workspace/support-access/grants", {
      method: "POST",
      body: { durationHours: 24, note: "Ticket 4711" },
    });
  });

  it("revokes a grant and ends a session by id", async () => {
    await supportApi.revokeSupportAccess("sag_1");
    await supportApi.endSupportSessionAsWorkspace("ses_1", "Done");
    expect(request).toHaveBeenNthCalledWith(1, "/workspace/support-access/grants/sag_1/revoke", {
      method: "POST",
      body: {},
    });
    expect(request).toHaveBeenNthCalledWith(2, "/workspace/support-access/sessions/ses_1/end", {
      method: "POST",
      body: { reason: "Done" },
    });
  });

  it("reads and ends the current support session", async () => {
    await supportApi.getCurrentSupportSession();
    await supportApi.endCurrentSupportSession();
    expect(request).toHaveBeenNthCalledWith(1, "/support-session");
    expect(request).toHaveBeenNthCalledWith(2, "/support-session/end", {
      method: "POST",
      body: {},
    });
  });
});
