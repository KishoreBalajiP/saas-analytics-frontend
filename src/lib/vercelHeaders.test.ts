// onboarding: the SPA's security headers in vercel.json (FE:headers).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rule = { source: string; headers: Array<{ key: string; value: string }> };
const config = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")) as {
  headers: Rule[];
};

function headersFor(path: string) {
  const rule = config.headers.find((r) => new RegExp(`^${r.source}$`).test(path));
  if (!rule) throw new Error(`no header rule for ${path}`);
  return Object.fromEntries(rule.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

describe("vercel.json security headers", () => {
  it("app pages forbid framing and set the baseline headers", () => {
    for (const path of ["/", "/dashboard", "/login", "/embedded-reports"]) {
      const h = headersFor(path);
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
    }
  });

  it("the embed route may be framed but keeps the rest of the policy", () => {
    for (const path of ["/embed", "/embed/abc"]) {
      const h = headersFor(path);
      expect(h["content-security-policy"]).toContain("frame-ancestors *");
      expect(h["x-frame-options"]).toBeUndefined();
      expect(h["x-content-type-options"]).toBe("nosniff");
    }
  });

  it("the CSP restricts scripts, objects and allows the app's font and API origins", () => {
    const csp = headersFor("/dashboard")["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("connect-src 'self' https: wss:");
  });
});
