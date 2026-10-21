/**
 * Platform configuration API client (roadmap 2.4).
 *
 * Typed wrappers for the platform-admin configuration surface. Every call
 * uses the admin audience; the backend enforces the permissions
 * (`settings.*`, `settings.secrets.*`, `feature_flags.*`,
 * `email_templates.*`) and the frontend only uses them as UX gates.
 *
 * Writes carry the `version` the admin saw: a stale version is a 409
 * `VERSION_CONFLICT` (someone else changed it), shown as "reload".
 */

import { request, requestFull, requestPaged, type Query } from "@/lib/api/client";
import type {
  ConfigRevision,
  EmailLocale,
  EmailTemplate,
  EmailTemplateContent,
  EmailTemplatePreview,
  FeatureFlag,
  FeatureFlagInput,
  FlagPreviewEntry,
  PlatformSetting,
  RevealedSecret,
} from "@/features/platform-config/types";

const audience = "admin" as const;
const enc = encodeURIComponent;

export const configKeys = {
  settings: ["admin", "config", "settings"] as const,
  settingHistory: (key: string) => ["admin", "config", "settings", key, "history"] as const,
  flags: ["admin", "config", "flags"] as const,
  flagHistory: (key: string) => ["admin", "config", "flags", key, "history"] as const,
  templates: (locale: EmailLocale) => ["admin", "config", "templates", locale] as const,
  templateHistory: (key: string, locale: EmailLocale) =>
    ["admin", "config", "templates", locale, key, "history"] as const,
};

/* ------------------------------ settings ------------------------------ */

export async function listSettings(query: Query = {}) {
  const payload = await requestFull<PlatformSetting[]>("/settings", { audience, query });
  const meta = (payload.meta ?? {}) as { groups?: string[] };
  return { data: payload.data ?? [], groups: meta.groups ?? [] };
}

export function getSetting(key: string) {
  return request<PlatformSetting>(`/settings/${enc(key)}`, { audience });
}

export function updateSetting(
  key: string,
  body: { value: unknown; version?: number | undefined; reason?: string | undefined },
) {
  return request<PlatformSetting>(`/settings/${enc(key)}`, { method: "PUT", audience, body });
}

export function resetSetting(
  key: string,
  body: { version?: number | undefined; reason?: string | undefined } = {},
) {
  return request<PlatformSetting>(`/settings/${enc(key)}/reset`, {
    method: "POST",
    audience,
    body,
  });
}

export function settingHistory(key: string, query: Query = {}) {
  return requestPaged<ConfigRevision>(`/settings/${enc(key)}/history`, { audience, query });
}

export function rollbackSetting(
  key: string,
  body: { toVersion: number; version?: number | undefined; reason?: string | undefined },
) {
  return request<PlatformSetting>(`/settings/${enc(key)}/rollback`, {
    method: "POST",
    audience,
    body,
  });
}

/** Decrypted secret; requires `settings.secrets.view` and is audited server-side. */
export function revealSecret(key: string) {
  return request<RevealedSecret>(`/settings/${enc(key)}/secret`, { audience });
}

/* ---------------------------- feature flags ---------------------------- */

export function listFlags(query: Query = {}) {
  return requestPaged<FeatureFlag>("/feature-flags", { audience, query });
}

export function getFlag(key: string) {
  return request<FeatureFlag>(`/feature-flags/${enc(key)}`, { audience });
}

export function createFlag(body: FeatureFlagInput) {
  return request<FeatureFlag>("/feature-flags", { method: "POST", audience, body });
}

export function updateFlag(key: string, body: FeatureFlagInput) {
  return request<FeatureFlag>(`/feature-flags/${enc(key)}`, { method: "PATCH", audience, body });
}

export function deleteFlag(
  key: string,
  query: { version?: number | undefined; reason?: string | undefined } = {},
) {
  return request<{ key: string; deleted: true; version: number }>(`/feature-flags/${enc(key)}`, {
    method: "DELETE",
    audience,
    query,
  });
}

export function flagHistory(key: string, query: Query = {}) {
  return requestPaged<ConfigRevision>(`/feature-flags/${enc(key)}/history`, { audience, query });
}

export function rollbackFlag(
  key: string,
  body: { toVersion: number; version?: number | undefined; reason?: string | undefined },
) {
  return request<FeatureFlag>(`/feature-flags/${enc(key)}/rollback`, {
    method: "POST",
    audience,
    body,
  });
}

export function previewFlags(tenantId: string) {
  return request<FlagPreviewEntry[]>("/feature-flags/preview", { audience, query: { tenantId } });
}

/* ---------------------------- email templates ---------------------------- */

export function listTemplates(locale: EmailLocale = "en") {
  return request<EmailTemplate[]>("/email-templates", { audience, query: { locale } });
}

export function getTemplate(key: string, locale: EmailLocale = "en") {
  return request<EmailTemplate>(`/email-templates/${enc(key)}`, { audience, query: { locale } });
}

export function updateTemplate(
  key: string,
  body: EmailTemplateContent & {
    locale: EmailLocale;
    version?: number | undefined;
    reason?: string | undefined;
  },
) {
  return request<EmailTemplate>(`/email-templates/${enc(key)}`, { method: "PUT", audience, body });
}

export function resetTemplate(
  key: string,
  body: { locale: EmailLocale; version?: number | undefined; reason?: string | undefined },
) {
  return request<EmailTemplate>(`/email-templates/${enc(key)}/reset`, {
    method: "POST",
    audience,
    body,
  });
}

/** Render only: the backend never sends a preview. */
export function previewTemplate(
  key: string,
  body: { locale: EmailLocale; draft?: EmailTemplateContent; variables?: Record<string, string> },
) {
  return request<EmailTemplatePreview>(`/email-templates/${enc(key)}/preview`, {
    method: "POST",
    audience,
    body,
  });
}

export function templateHistory(key: string, locale: EmailLocale = "en", query: Query = {}) {
  return requestPaged<ConfigRevision>(`/email-templates/${enc(key)}/history`, {
    audience,
    query: { ...query, locale },
  });
}

export function rollbackTemplate(
  key: string,
  body: {
    locale: EmailLocale;
    toVersion: number;
    version?: number | undefined;
    reason?: string | undefined;
  },
) {
  return request<EmailTemplate>(`/email-templates/${enc(key)}/rollback`, {
    method: "POST",
    audience,
    body,
  });
}
