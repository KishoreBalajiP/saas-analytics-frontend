import { beforeEach, describe, expect, it, vi } from "vitest";

import * as client from "@/lib/api/client";
import * as configApi from "./index";

vi.mock("@/lib/api/client", () => ({
  request: vi.fn(),
  requestPaged: vi.fn(),
  requestFull: vi.fn(),
}));
const request = vi.mocked(client.request);
const requestPaged = vi.mocked(client.requestPaged);
const requestFull = vi.mocked(client.requestFull);

beforeEach(() => {
  vi.clearAllMocks();
  request.mockResolvedValue({} as never);
  requestPaged.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, pages: 1 } });
});

describe("platform config API contract", () => {
  it("settings: admin audience, versioned writes, separate secret endpoint", async () => {
    requestFull.mockResolvedValue({
      success: true,
      statusCode: 200,
      message: "ok",
      data: [],
      meta: { groups: ["email"] },
      timestamp: "",
    });
    await expect(configApi.listSettings({ group: "email" })).resolves.toEqual({
      data: [],
      groups: ["email"],
    });
    expect(requestFull).toHaveBeenCalledWith("/settings", {
      audience: "admin",
      query: { group: "email" },
    });

    await configApi.updateSetting("email.smtp_port", { value: 2525, version: 3 });
    expect(request).toHaveBeenLastCalledWith("/settings/email.smtp_port", {
      method: "PUT",
      audience: "admin",
      body: { value: 2525, version: 3 },
    });
    await configApi.rollbackSetting("branding.primary_color", { toVersion: 1, version: 4 });
    expect(request).toHaveBeenLastCalledWith("/settings/branding.primary_color/rollback", {
      method: "POST",
      audience: "admin",
      body: { toVersion: 1, version: 4 },
    });
    await configApi.resetSetting("branding.primary_color", { version: 5 });
    expect(request).toHaveBeenLastCalledWith("/settings/branding.primary_color/reset", {
      method: "POST",
      audience: "admin",
      body: { version: 5 },
    });
    // The reveal is a GET so the plaintext never lands in an idempotency record.
    await configApi.revealSecret("email.smtp_password");
    expect(request).toHaveBeenLastCalledWith("/settings/email.smtp_password/secret", {
      audience: "admin",
    });
    await configApi.settingHistory("email.smtp_password", { limit: 50 });
    expect(requestPaged).toHaveBeenLastCalledWith("/settings/email.smtp_password/history", {
      audience: "admin",
      query: { limit: 50 },
    });
  });

  it("feature flags: CRUD, history, rollback and preview", async () => {
    await configApi.listFlags({ search: "beta" });
    expect(requestPaged).toHaveBeenLastCalledWith("/feature-flags", {
      audience: "admin",
      query: { search: "beta" },
    });
    await configApi.createFlag({ key: "beta.x", name: "X" });
    expect(request).toHaveBeenLastCalledWith("/feature-flags", {
      method: "POST",
      audience: "admin",
      body: { key: "beta.x", name: "X" },
    });
    await configApi.updateFlag("beta.x", { enabled: true, version: 1 });
    expect(request).toHaveBeenLastCalledWith("/feature-flags/beta.x", {
      method: "PATCH",
      audience: "admin",
      body: { enabled: true, version: 1 },
    });
    await configApi.deleteFlag("beta.x", { version: 2 });
    expect(request).toHaveBeenLastCalledWith("/feature-flags/beta.x", {
      method: "DELETE",
      audience: "admin",
      query: { version: 2 },
    });
    await configApi.rollbackFlag("beta.x", { toVersion: 1 });
    expect(request).toHaveBeenLastCalledWith("/feature-flags/beta.x/rollback", {
      method: "POST",
      audience: "admin",
      body: { toVersion: 1 },
    });
    await configApi.previewFlags("t1");
    expect(request).toHaveBeenLastCalledWith("/feature-flags/preview", {
      audience: "admin",
      query: { tenantId: "t1" },
    });
  });

  it("email templates: locale on every call, preview never sends", async () => {
    await configApi.listTemplates("de");
    expect(request).toHaveBeenLastCalledWith("/email-templates", {
      audience: "admin",
      query: { locale: "de" },
    });
    const content = { subject: "S", text: "T {{resetUrl}}", html: null };
    await configApi.updateTemplate("auth.password_reset", { ...content, locale: "en", version: 0 });
    expect(request).toHaveBeenLastCalledWith("/email-templates/auth.password_reset", {
      method: "PUT",
      audience: "admin",
      body: { ...content, locale: "en", version: 0 },
    });
    await configApi.previewTemplate("auth.password_reset", { locale: "en", draft: content });
    expect(request).toHaveBeenLastCalledWith("/email-templates/auth.password_reset/preview", {
      method: "POST",
      audience: "admin",
      body: { locale: "en", draft: content },
    });
    await configApi.templateHistory("auth.password_reset", "fr");
    expect(requestPaged).toHaveBeenLastCalledWith("/email-templates/auth.password_reset/history", {
      audience: "admin",
      query: { locale: "fr" },
    });
    await configApi.rollbackTemplate("auth.password_reset", { locale: "fr", toVersion: 0 });
    expect(request).toHaveBeenLastCalledWith("/email-templates/auth.password_reset/rollback", {
      method: "POST",
      audience: "admin",
      body: { locale: "fr", toVersion: 0 },
    });
  });
});
