import { beforeEach, describe, expect, it, vi } from "vitest";
import * as client from "@/lib/api/client";

vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof client>();
  return { ...actual, request: vi.fn() };
});

import * as security from "./adminSecurity";
import { expectsLiveSession } from "@/lib/auth/sessionHint";

const mockedRequest = vi.mocked(client.request);

beforeEach(() => {
  vi.clearAllMocks();
  client.setAccessToken("admin", null);
  window.localStorage.clear();
});

describe("admin security API", () => {
  it("step-up posts the password and the second factor", async () => {
    mockedRequest.mockResolvedValue({ stepUpExpiresAt: "x" });
    await security.stepUpAdmin("pw", { code: "123456" });
    expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/step-up", {
      method: "POST",
      audience: "admin",
      body: { password: "pw", code: "123456" },
    });
    await security.stepUpAdmin("pw");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin-auth/step-up", {
      method: "POST",
      audience: "admin",
      body: { password: "pw" },
    });
  });

  it("recovery codes, MFA disable and password flows use the admin-auth endpoints", async () => {
    mockedRequest.mockResolvedValue({});
    await security.regenerateRecoveryCodes();
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin-auth/mfa/recovery-codes", {
      method: "POST",
      audience: "admin",
    });
    await security.disableAdminMfa("pw", { recoveryCode: "ABCD-EFGH-JKMN-PQRS" });
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin-auth/mfa/disable", {
      method: "POST",
      audience: "admin",
      body: { password: "pw", recoveryCode: "ABCD-EFGH-JKMN-PQRS" },
    });
    await security.forgotAdminPassword("a@b.com");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin-auth/password/forgot", {
      method: "POST",
      audience: "public",
      body: { email: "a@b.com" },
    });
    await security.resetAdminPassword("tok", "NewPassword1!");
    expect(mockedRequest).toHaveBeenLastCalledWith("/admin-auth/password/reset", {
      method: "POST",
      audience: "public",
      body: { token: "tok", newPassword: "NewPassword1!" },
    });
  });

  it("invitation preview posts the token (never in the URL)", async () => {
    mockedRequest.mockResolvedValue({ email: "a@b.com" });
    await security.previewAdminInvitation("tok");
    expect(mockedRequest).toHaveBeenCalledWith("/admin-auth/invitations/preview", {
      method: "POST",
      audience: "public",
      body: { token: "tok" },
    });
  });

  it("accepting an invitation keeps the admin access token in memory and remembers the session", async () => {
    const sessionExpiresAt = new Date(Date.now() + 60_000).toISOString();
    mockedRequest.mockResolvedValue({
      accessToken: "adm_tok",
      expiresIn: 900,
      sessionExpiresAt,
      mfaEnrollmentRequired: true,
    });
    const result = await security.acceptAdminInvitation({ token: "tok", password: "pw12345678" });
    expect(result.mfaEnrollmentRequired).toBe(true);
    expect(client.getAccessToken("admin")).toBe("adm_tok");
    expect(client.getAccessToken("tenant")).toBeNull();
    expect(expectsLiveSession("admin")).toBe(true);
  });

  it("recognises the step-up and enrolment-only error codes", () => {
    expect(security.isStepUpRequired(new client.ApiError("x", 403, "STEP_UP_REQUIRED"))).toBe(true);
    expect(security.isStepUpRequired(new client.ApiError("x", 403, "FORBIDDEN"))).toBe(false);
    expect(security.isStepUpRequired(new Error("x"))).toBe(false);
    expect(
      security.isMfaEnrollmentRequired(new client.ApiError("x", 403, "MFA_ENROLLMENT_REQUIRED")),
    ).toBe(true);
  });
});
