import { describe, expect, it } from "vitest";

import {
  BUILT_IN_PLATFORM_ROLES,
  adminScopeOf,
  adminTypeLabel,
  builtInPlatformRole,
  describeScope,
} from "./roles";

describe("platform role display helpers", () => {
  it("describes the four built-in platform roles, most privileged first", () => {
    expect(BUILT_IN_PLATFORM_ROLES.map((role) => role.name)).toEqual([
      "super_admin",
      "platform_admin",
      "support_operator",
      "auditor",
    ]);
    expect(builtInPlatformRole("auditor")?.adminType).toBe("auditor");
    expect(builtInPlatformRole("custom_role")).toBeUndefined();
  });

  it("labels admin types and falls back to the raw value", () => {
    expect(adminTypeLabel("support")).toBe("Support Operator");
    expect(adminTypeLabel("auditor")).toBe("Auditor");
    expect(adminTypeLabel("legacy_type")).toBe("legacy_type");
    expect(adminTypeLabel(undefined)).toBe("Admin");
  });

  it("trusts the scope returned by /admin-auth/me", () => {
    expect(adminScopeOf({ scope: { type: "tenant", tenantId: "ten_A" } })).toEqual({
      type: "tenant",
      tenantId: "ten_A",
    });
    // A platform scope wins over a raw tenantScope value.
    expect(adminScopeOf({ scope: { type: "platform", tenantId: null }, tenantScope: "*" })).toEqual(
      { type: "platform", tenantId: null },
    );
  });

  it("falls back to tenantScope for admin rows, treating '*' as every tenant", () => {
    expect(adminScopeOf({ tenantScope: "ten_B" })).toEqual({ type: "tenant", tenantId: "ten_B" });
    expect(adminScopeOf({ tenantScope: "*" })).toEqual({ type: "platform", tenantId: null });
    expect(adminScopeOf({ tenantScope: null })).toEqual({ type: "platform", tenantId: null });
    expect(adminScopeOf(null)).toEqual({ type: "platform", tenantId: null });
  });

  it("renders a short scope description", () => {
    expect(describeScope({ type: "tenant", tenantId: "ten_A" })).toBe("Tenant ten_A");
    expect(describeScope({ type: "platform", tenantId: null })).toBe("All tenants");
  });
});
