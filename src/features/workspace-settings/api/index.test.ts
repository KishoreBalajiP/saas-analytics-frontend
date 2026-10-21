import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";

vi.mock("@/lib/api/client", async () => {
  const actual = await vi.importActual<typeof client>("@/lib/api/client");
  return { ...actual, request: vi.fn() };
});

import * as workspaceSettingsApi from "./index";

const mockedRequest = vi.mocked(client.request);

beforeEach(() => vi.clearAllMocks());

describe("workspaceSettingsApi", () => {
  it("reads the workspace settings", async () => {
    mockedRequest.mockResolvedValue({ timezone: "UTC" });
    await expect(workspaceSettingsApi.get()).resolves.toEqual({ timezone: "UTC" });
    expect(mockedRequest).toHaveBeenCalledWith("/workspace/settings");
  });

  it("patches only the given settings", async () => {
    mockedRequest.mockResolvedValue({ timezone: "Asia/Kolkata" });
    await workspaceSettingsApi.update({ timezone: "Asia/Kolkata" });
    expect(mockedRequest).toHaveBeenCalledWith("/workspace/settings", {
      method: "PATCH",
      body: { timezone: "Asia/Kolkata" },
    });
  });
});
