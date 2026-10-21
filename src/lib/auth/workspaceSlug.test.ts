import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetWorkspace, getRememberedWorkspace, rememberWorkspace } from "./workspaceSlug";

afterEach(() => {
  vi.restoreAllMocks();
  forgetWorkspace();
});

describe("remembered workspace (onboarding)", () => {
  it("round-trips through localStorage", () => {
    rememberWorkspace("acme");
    expect(window.localStorage.getItem("saas.tenantSlug")).toBe("acme");
    expect(getRememberedWorkspace()).toBe("acme");
    forgetWorkspace();
    expect(getRememberedWorkspace()).toBeNull();
  });

  it("falls back to memory when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    rememberWorkspace("beta");
    expect(getRememberedWorkspace()).toBe("beta");
  });
});
