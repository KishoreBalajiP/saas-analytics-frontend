/**
 * Platform configuration types (roadmap 2.4): platform settings, feature
 * flags and email templates as returned by `/settings`, `/feature-flags`
 * and `/email-templates` (platform-admin surface).
 */

export type SettingType = "string" | "number" | "boolean" | "json" | "duration";

export interface PlatformSetting {
  key: string;
  group: string;
  type: SettingType;
  description: string;
  isSecret: boolean;
  isReadonly: boolean;
  /** Built-in default (null for secrets). */
  defaultValue: unknown;
  /** Current platform value; always null for a secret (masked). */
  value: unknown;
  /** Secrets only: whether a value is stored. */
  hasValue?: boolean;
  redacted?: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  source: "platform" | "default";
}

export interface RevealedSecret extends PlatformSetting {
  value: string;
}

export type RevisionAction = "baseline" | "create" | "update" | "reset" | "delete" | "rollback";

/** One entry of a configuration history (never contains a secret value). */
export interface ConfigRevision<State = Record<string, unknown>> {
  version: number;
  action: RevisionAction;
  state: State | null;
  isSecret: boolean;
  hasSecretValue?: boolean;
  rolledBackFrom: number | null;
  reason: string | null;
  changedBy: { type: string; id: string | null };
  createdAt: string | null;
}

export type RolloutStrategy = "all" | "tenantId" | "percentage" | "attribute";

export interface FeatureFlagRollout {
  strategy: RolloutStrategy;
  tenantIds: string[];
  percentage: number;
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  type: "boolean";
  enabled: boolean;
  rollout: FeatureFlagRollout;
  isReadonly: boolean;
  isSystem: boolean;
  version: number;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FeatureFlagInput {
  key?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  enabled?: boolean | undefined;
  rollout?: Partial<Pick<FeatureFlagRollout, "strategy" | "tenantIds" | "percentage">> | undefined;
  version?: number | undefined;
  reason?: string | undefined;
}

export interface FlagPreviewEntry {
  key: string;
  name: string;
  value: boolean;
  reason: string;
}

export interface EmailTemplateVariable {
  key: string;
  description: string;
  required: boolean;
  sample: string;
  default?: string;
}

export interface EmailTemplateContent {
  subject: string;
  text: string;
  html: string | null;
}

export type EmailLocale = "en" | "es" | "fr" | "de";

export interface EmailTemplate {
  key: string;
  name: string;
  description: string;
  locale: EmailLocale;
  variables: EmailTemplateVariable[];
  customized: boolean;
  version: number;
  updatedAt: string | null;
  updatedBy: string | null;
  builtIn: EmailTemplateContent;
  override: EmailTemplateContent | null;
  effective: EmailTemplateContent;
}

export interface EmailTemplatePreview extends EmailTemplateContent {
  key: string;
  locale: EmailLocale;
  source: "draft" | "override" | "built_in";
  variables: Record<string, string>;
}
