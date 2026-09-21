import { describe, it, expect } from "vitest";

import { perm, hasPermission, hasAnyPermission, hasAllPermissions, Permissions } from "./index";

describe("perm", () => {
  it("builds a canonical permission key", () => {
    expect(perm("dashboards", "view")).toBe("dashboards.view");
  });

  it("builds compound module keys", () => {
    expect(perm("iam.tenants", "create")).toBe("iam.tenants.create");
  });
});

describe("hasPermission", () => {
  it("returns true when the key is present", () => {
    expect(hasPermission(["dashboards.view", "dashboards.create"], "dashboards.view")).toBe(true);
  });

  it("returns false when the key is absent", () => {
    expect(hasPermission(["dashboards.view"], "dashboards.create")).toBe(false);
  });

  it("returns false for undefined permissions", () => {
    expect(hasPermission(undefined, "dashboards.view")).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasPermission([], "dashboards.view")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true when at least one key matches", () => {
    expect(hasAnyPermission(["dashboards.view"], "dashboards.create", "dashboards.view")).toBe(
      true,
    );
  });

  it("returns false when no keys match", () => {
    expect(hasAnyPermission(["dashboards.view"], "reports.create", "alerts.view")).toBe(false);
  });

  it("returns false for undefined permissions", () => {
    expect(hasAnyPermission(undefined, "dashboards.view")).toBe(false);
  });
});

describe("hasAllPermissions", () => {
  it("returns true when all keys are present", () => {
    expect(
      hasAllPermissions(
        ["dashboards.view", "dashboards.create"],
        "dashboards.view",
        "dashboards.create",
      ),
    ).toBe(true);
  });

  it("returns false when some keys are missing", () => {
    expect(hasAllPermissions(["dashboards.view"], "dashboards.view", "dashboards.create")).toBe(
      false,
    );
  });

  it("returns false for undefined permissions", () => {
    expect(hasAllPermissions(undefined, "dashboards.view")).toBe(false);
  });
});

describe("Permissions constants", () => {
  it("contains expected permission keys", () => {
    expect(Permissions.ANALYTICS_VIEW).toBe("analytics.view");
    expect(Permissions.CONNECTORS_CREATE).toBe("connectors.create");
    expect(Permissions.DASHBOARDS_VIEW).toBe("dashboards.view");
    expect(Permissions.IAM_TENANTS_VIEW).toBe("iam.tenants.view");
    expect(Permissions.AUDIT_LOGS_EXPORT).toBe("audit_logs.export");
  });

  it("all values are strings with a dot separator", () => {
    for (const value of Object.values(Permissions)) {
      expect(typeof value).toBe("string");
      expect(value).toContain(".");
    }
  });
});
