// onboarding: no placeholder ("coming soon" / "not implemented") pages are reachable.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routesDir = resolve(__dirname, "../routes");
const PLACEHOLDER =
  /ComingSoon|coming soon|not implemented yet|will be available in a future release/i;

describe("route placeholders", () => {
  it("no route file renders a placeholder", () => {
    const offenders = readdirSync(routesDir)
      .filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      .filter((f) => PLACEHOLDER.test(readFileSync(join(routesDir, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the profile page is real (password, sessions)", () => {
    const profile = readFileSync(join(routesDir, "profile.tsx"), "utf8");
    expect(profile).toContain("PasswordForm");
    expect(profile).toContain("SessionsPanel");
  });
});
