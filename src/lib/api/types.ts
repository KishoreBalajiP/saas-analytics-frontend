// Types transcribed from src/docs/backend/frontend-api-contract.md.
// Do not add fields the backend does not document.

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paged<T> {
  data: T[];
  meta: PaginationMeta & Record<string, unknown>;
}

export interface Actor {
  id: string;
  email: string;
  tenantId?: string;
  role?: string;
}

/**
 * Login / refresh response. The refresh token and session id are never in the
 * body: the refresh token lives only in the HttpOnly cookie.
 */
export interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  /** When the server-side session (and its cookie) ends; not a secret. */
  sessionExpiresAt?: string | null;
  actor?: Actor;
  mfaRequired?: boolean;
}

export interface Me {
  _id?: string;
  id: string;
  email: string;
  tenantId?: string;
  status?: string;
  profile?: { name?: string; locale?: string; timezone?: string; avatarUrl?: string };
  roles?: string[];
  permissions?: string[];
  mfaEnabled?: boolean;
  adminType?: AdminType;
  /** Admins only: the tenant the admin is confined to (null = platform-wide). */
  tenantScope?: string | null;
  /** Admins only: effective reach returned by `GET /admin-auth/me`. */
  scope?: AdminScope;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ConnectorType = "csv" | "xlsx" | "mongodb" | "webhook";

export interface ConnectorTypeInfo {
  type: ConnectorType;
  displayName: string;
  description: string;
  capabilities: string[];
}

export interface Connector {
  _id: string;
  type: ConnectorType;
  name: string;
  status: "active" | "paused" | "error";
  configSummary?: Record<string, unknown>;
  fieldMapping?: Record<string, string>;
  webhookToken?: string;
  /** Webhook signature scheme: 2 = timestamp-bound (`v2=`), 1/absent = legacy body-only. */
  webhookSignatureVersion?: 1 | 2;
  webhookToleranceSeconds?: number;
  lastSyncedAt?: string | null;
  syncStatus?: "idle" | "queued" | "running" | "succeeded" | "failed";
  syncRequestedAt?: string | null;
  /** Lease of the queued/running sync; renewed while a worker runs it. */
  syncLeaseUntil?: string | null;
  /** SyncRun of the sync currently queued/running (null when idle). */
  currentSyncRunId?: string | null;
  lastError?: string | null;
  errorCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PreviewResult {
  fields: string[];
  sample: Array<Record<string, unknown>>;
  meta?: Record<string, unknown>;
}

export type MetricOp =
  | "count"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count_distinct"
  // vizbuilder:
  | "count_non_null";
export type FilterOp = "eq" | "neq" | "in" | "nin" | "gt" | "gte" | "lt" | "lte" | "exists";

export interface QueryFilter {
  field: string;
  op: FilterOp;
  value: unknown;
}

export interface QueryMetric {
  field: string;
  op: MetricOp;
  alias?: string;
  // ai-catalogue: a metric reference ('metric:<key>'); op/field are then ignored by the API.
  ref?: string;
}

export interface QueryOrder {
  field: string;
  direction: "asc" | "desc";
  /** Legacy alias of `direction`, still accepted by the API. */
  dir?: "asc" | "desc";
}

/** Relative presets resolve at run time in the workspace time zone. */
export type DatePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "previous_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "custom";

export type DateBucket = "day" | "week" | "month" | "quarter" | "year";

/**
 * `field` is the date column the window applies to (`ingestedAt` for
 * ingestion time). A relative `preset` carries no from/to; `custom` (or no
 * preset) needs `from` and/or `to` as `YYYY-MM-DD` or ISO date-time.
 */
export interface QueryDateRange {
  field: string;
  preset?: DatePreset;
  from?: string;
  to?: string;
}

/** Group on a field; `bucket` groups a date column by period start. */
export interface QueryGroupBy {
  field: string;
  bucket?: DateBucket;
}

export interface AnalyticsQueryParams {
  connectorIds?: string[];
  filters?: QueryFilter[];
  filtersOp?: "and" | "or";
  dateRange?: QueryDateRange;
  metrics?: QueryMetric[];
  groupBy?: Array<string | QueryGroupBy>;
  orderBy?: QueryOrder[];
  page?: number;
  limit?: number;
}

/** The absolute window a query ran over (after preset resolution). */
export interface QueryWindow {
  field: string;
  preset?: string | null;
  from: string | null;
  to: string | null;
}

/** Workspace self-service settings (`/workspace/settings`). */
export interface WorkspaceSettings {
  timezone: string;
}

export interface AnalyticsResult {
  rows: Array<Record<string, unknown>>;
  total?: number;
  page?: number;
  pages?: number;
  limit?: number;
  columns?: string[];
  executedAt?: string;
  groupMode?: "grouped" | "raw";
  timezone?: string;
  window?: QueryWindow | null;
}

export interface AnalyticsQueryRecord {
  _id: string;
  status?: string;
  createdAt?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WidgetType = "kpi" | "table" | "bar" | "line" | "area" | "pie";

export interface Widget {
  _id: string;
  dashboardId: string;
  type: WidgetType;
  name: string;
  datasetId: string;
  query?: AnalyticsQueryParams;
  visualization?: Record<string, unknown>;
  position?: { x: number; y: number; w: number; h: number };
  /** Set when the widget's dataset was deleted (see BrokenDependency). */
  brokenAt?: string | null;
  brokenReason?: string | null;
}

// vizbuilder: shares grant a tenant user or role view/edit access.
export interface DashboardShare {
  _id: string;
  principalType: "user" | "role";
  principalId: string;
  principalName?: string;
  level: "view" | "edit";
  createdAt?: string;
}

export interface Dashboard {
  _id: string;
  tenantId?: string;
  name: string;
  description?: string;
  status: "draft" | "published" | "archived";
  layout?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  refresh?: Record<string, unknown>;
  shares?: DashboardShare[];
  widgets?: Widget[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardExecutionEntry {
  widgetId: string;
  name: string;
  type: WidgetType;
  result?: AnalyticsResult;
  error?: { message: string; code?: string; errors?: FieldError[] };
}

export interface ReportRun {
  /** Run id (the API sends the sub-document `_id`). */
  _id: string;
  triggeredBy: "manual" | "schedule" | "alert";
  format: "json" | "csv" | "xlsx";
  status: "pending" | "running" | "ready" | "failed";
  /** Rows in the artefact (the whole result unless `truncated`). */
  rowCount?: number | null;
  /** True only when the row safety cap (`rowLimit`) was hit. */
  truncated?: boolean;
  rowLimit?: number | null;
  fileName?: string | null;
  contentType?: string | null;
  size?: number | null;
  resultKey?: string | null;
  error?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  // retention: set once the cleanup job removed the stored file (410 EXPORT_EXPIRED).
  expiredAt?: string | null;
  createdAt?: string;
}

// reports: roadmap 1.5 - signed artefact downloads and async analytics exports.
/** A short-lived signed download link for a stored artefact. */
export interface ArtifactDownload {
  /** Absolute (S3) or relative to the API origin (`/api/v1/files/...`). */
  url: string;
  expiresAt: string;
  fileName: string;
  contentType: string;
  format: "json" | "csv" | "xlsx";
  rowCount?: number | null;
  truncated: boolean;
  rowLimit?: number | null;
  size?: number | null;
}

export interface ReportDownload extends ArtifactDownload {
  runId: string;
  status: ReportRun["status"];
  generatedAt?: string | null;
}

/** An async analytics export (`/analytics/export`). */
export interface AnalyticsExport {
  exportId: string;
  status: "pending" | "running" | "ready" | "failed";
  format: "json" | "csv" | "xlsx";
  rowCount?: number | null;
  truncated?: boolean;
  rowLimit?: number | null;
  fileName?: string | null;
  size?: number | null;
  error?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  // retention: set once the cleanup job removed the stored file (410 EXPORT_EXPIRED).
  expiredAt?: string | null;
}

export interface Report {
  _id: string;
  description?: string;
  name: string;
  source: "widget" | "query";
  dashboardId?: string | null;
  widgetId?: string | null;
  query?: AnalyticsQueryParams | null;
  format: "json" | "csv" | "xlsx";
  status?: "draft" | "active" | "paused" | "archived" | string;
  filters?: {
    dateRange?: Record<string, unknown>;
    filters?: QueryFilter[];
    filtersOp?: "and" | "or";
  };
  schedule?: {
    enabled?: boolean;
    cron?: string;
    /** IANA zone; null/empty = the workspace time zone. */
    timezone?: string | null;
    format?: "json" | "csv" | "xlsx";
    recipients?: Array<{ type?: "user" | "external"; value: string }>;
    // delivery: webhook / Slack / Teams destination ids.
    destinationIds?: string[];
  };
  nextRunAt?: string;
  runs?: ReportRun[];
  brokenAt?: string | null;
  brokenReason?: string | null;
}

export interface AlertRule {
  _id: string;
  description?: string;
  name: string;
  /** Not sent by the API: query alerts carry it as `query.datasetId`. */
  datasetId?: string;
  metric: string;
  condition: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "between";
  threshold: number;
  thresholdHigh?: number | null;
  source: "widget" | "query";
  dashboardId?: string | null;
  widgetId?: string | null;
  query?: AnalyticsQueryParams | null;
  schedule?: { cron?: string; timezone?: string | null };
  cooldownMinutes?: number;
  /** How a grouped query is judged: whole dataset, some group, every group. */
  groupEvaluation?: AlertGroupEvaluation;
  lastTriggeredAt?: string | null;
  lastEvaluatedAt?: string | null;
  lastEvaluation?: AlertEvaluation | null;
  nextEvaluationAt?: string | null;
  enabled: boolean;
  notification?: {
    channels?: Array<"email" | "in_app">;
    recipients?: Array<{ type?: "user" | "email"; value: string }>;
    template?: string | null;
  };
  brokenAt?: string | null;
  brokenReason?: string | null;
}

// reports: roadmap 1.5 - alert metric contract and evaluation outcomes.
export type AlertGroupEvaluation = "total" | "any" | "all";

export type AlertEvaluationOutcome = "triggered" | "suppressed" | "not_met" | "no_data" | "failed";

/** Outcome of an alert's most recent evaluation. */
export interface AlertEvaluation {
  at?: string | null;
  outcome?: AlertEvaluationOutcome | null;
  value?: number | null;
  groupsEvaluated?: number | null;
  groupsMatched?: number | null;
  error?: string | null;
}

export interface AlertEvent {
  _id: string;
  alertId: string;
  triggeredAt: string;
  value?: number | null;
  threshold?: number;
  message?: string;
  status: "triggered" | "suppressed" | "resolved";
  notificationIds?: string[];
  details?: {
    mode: "any" | "all";
    groupsEvaluated: number;
    groupsMatched: number;
    sample?: Array<{ group: Record<string, unknown>; value: number }>;
  } | null;
}

export interface Notification {
  _id: string;
  type: "alert.triggered" | "report.ready" | "broadcast" | "system";
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
}

export const API_KEY_SCOPES = [
  "analytics:query",
  "datasets:read",
  "connectors:read",
  "dashboards:read",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export interface ApiKey {
  id: string;
  prefix: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string | null;
  status: string;
  createdAt?: string;
  // devapi: lifecycle fields.
  lastUsedAt?: string | null;
  lastUsedIp?: string | null;
  ipAllowList?: string[];
  rotatedTo?: string | null;
  rotatedAt?: string | null;
}

export interface EmbedToken {
  id: string;
  name?: string;
  dashboardId: string;
  widgetId?: string | null;
  expiresAt?: string | null;
  status: string;
  createdAt?: string;
  // embedding: signed origin-bound tokens and share links.
  kind?: "embed" | "share";
  allowedOrigins?: string[];
  theme?: "light" | "dark" | "auto";
  lastUsedAt?: string | null;
}

export interface Tenant {
  _id: string;
  slug: string;
  name: string;
  description?: string;
  status: "pending" | "active" | "suspended" | "disabled" | "archived";
  onboardingStatus?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantInvitation {
  _id: string;
  tenantId: string;
  invitedEmail: string;
  roleName: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt?: string;
}

/** Platform admin type: the privilege ceiling (super > platform > support > auditor). */
export type AdminType = "super" | "platform" | "support" | "auditor";

/** Where an admin may act: every tenant, or only its scoped tenant. */
export interface AdminScope {
  type: "platform" | "tenant";
  tenantId: string | null;
}

export interface PlatformAdmin {
  _id: string;
  email: string;
  name?: string;
  profile?: { name?: string };
  adminType: AdminType;
  status?: string;
  tenantScope?: string | null;
  createdAt?: string;
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  scope: "platform" | "tenant";
  permissions?: string[];
  /** One of the four built-in platform roles (managed by the backend catalogue). */
  builtIn?: boolean;
  /** Display label (built-in roles) or the role name. */
  label?: string;
  /** Admin type a built-in role belongs to. */
  adminType?: AdminType | null;
  permissionCount?: number;
}

export interface Permission {
  _id?: string;
  module: string;
  action: string;
  key?: string;
  description?: string;
}

/** Audit trail row as returned by `GET /audit-logs` (flat backend shape). */
export type AuditCategory = "change" | "security";
export type AuditSeverity = "info" | "notice" | "warning" | "critical";

export interface AuditLog {
  _id: string;
  /** Rows written before categories existed have none (treat as "change"). */
  category?: AuditCategory;
  severity?: AuditSeverity | null;
  actorType: "user" | "admin" | "service" | "system";
  actorId?: string | null;
  actorDisplay?: string | null;
  tenantId?: string | null;
  module: string;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  reason?: string | null;
  result: "success" | "failure";
  errorCode?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  occurredAt: string;
  /** Tamper-evidence chain position and hash (absent on legacy rows). */
  seq?: number;
  hash?: string;
}

/** Access trace row as returned by `GET /access-logs`. */
export interface AccessLog {
  _id: string;
  actorType: "user" | "admin" | "service" | "system";
  actorId?: string | null;
  tenantId?: string | null;
  method: string;
  path: string;
  statusCode: number;
  latencyMs?: number;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  event?: string;
  error?: { code?: string | null; message?: string | null } | null;
  occurredAt: string;
}

export type ComplianceRequestType = "export" | "delete" | "restrict" | "consent.withdraw";

export type ComplianceRequestStatus =
  "received" | "in_progress" | "completed" | "rejected" | "cancelled";

/** Data-subject request row (`GET /compliance/requests`). */
export interface ComplianceRequest {
  _id?: string;
  requestId: string;
  type: ComplianceRequestType;
  status: ComplianceRequestStatus | string;
  subjectId: string;
  subjectType: "user" | "tenant";
  subjectEmail?: string | null;
  tenantScope?: string[];
  reason?: string;
  dueBy?: string;
  createdAt?: string;
  completedAt?: string | null;
  cancelledReason?: string | null;
  rejectionReason?: string | null;
  evidenceUrl?: string;
}

export interface MasterDataItem {
  _id: string;
  code: string;
  locale?: string;
  label: string;
  value?: Record<string, unknown>;
  isSystem?: boolean;
  createdAt?: string;
}

// adminauth: admin MFA policy, recovery codes, step-up and invitations
// (roadmap 2.2; documented in frontend-api-contract.md "Admin
// authentication"). The two interfaces below MERGE into `SessionPayload`
// and `Me` declared above (TypeScript declaration merging), so this block
// stays self-contained.
export interface SessionPayload {
  /** The admin session may only enrol MFA (privileged admin without MFA). */
  mfaEnrollmentRequired?: boolean;
  /** Recovery codes left after signing in with one. */
  recoveryCodesRemaining?: number;
}

export interface Me {
  /** The MFA policy applies to this admin (privileged type/role or reset). */
  mfaRequired?: boolean;
  /** This session may only enrol MFA until enrolment completes. */
  mfaEnrollmentRequired?: boolean;
  recoveryCodesRemaining?: number;
  recoveryCodesGeneratedAt?: string | null;
  /** End of the current step-up window on this session, or null. */
  stepUpExpiresAt?: string | null;
  name?: string;
  type?: string;
}

/** Backend admin types (`Admin.adminType`). */
export type BackendAdminType = "super" | "platform" | "support";

export interface MfaEnrollmentStart {
  secret: string;
  otpauthUrl: string;
}

export interface MfaEnrollmentResult {
  enabled: boolean;
  /** Shown exactly once; only digests are stored. */
  recoveryCodes: string[];
  recoveryCodesRemaining: number;
}

export interface RecoveryCodesResult {
  recoveryCodes: string[];
  recoveryCodesRemaining: number;
  generatedAt: string;
}

export interface StepUpResult {
  stepUpExpiresAt: string;
  recoveryCodesRemaining?: number;
}

export interface AdminInvitationPreview {
  email: string;
  name: string;
  adminType: BackendAdminType;
  expiresAt: string;
  mfaRequired: boolean;
}

export interface AdminInvitationRecord {
  id: string;
  _id: string;
  adminId: string;
  email: string;
  adminType: BackendAdminType;
  invitedBy?: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  sendCount: number;
  lastSentAt?: string | null;
  delivered: boolean;
  createdAt?: string;
}

export interface AdminInviteResult extends PlatformAdmin {
  invitation: AdminInvitationRecord;
  delivered: boolean;
}

export interface AdminCredentialResetResult {
  admin: PlatformAdmin;
  sessionsRevoked: number;
  mfaEnrollmentRequired?: boolean;
  delivered?: boolean;
  resetLinkExpiresAt?: string;
}

// delivery: roadmap 3.4 - delivery pipeline (destinations + history).
export type DeliveryDestinationType = "webhook" | "slack" | "teams";

export interface DeliveryDestination {
  _id: string;
  type: DeliveryDestinationType;
  name: string;
  /** Host only; the URL itself is a secret and never returned. */
  urlHint: string;
  createdAt?: string;
  /** Webhook signing secret, returned once at creation. */
  signingSecret?: string;
}

export interface DeliveryRun {
  _id: string;
  kind: string;
  sourceId?: string | null;
  reportRunId?: string | null;
  destinationType: "email" | DeliveryDestinationType;
  recipient: string;
  external?: boolean;
  status: "pending" | "sent" | "retrying" | "dead" | "skipped";
  attempts: number;
  nextAttemptAt?: string | null;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt?: string;
}

// mfa-tenant: tenant-user MFA status on `/users/me` (merges into `Me`).
export interface TenantMfaStatus {
  enabled: boolean;
  required: boolean;
  workspaceRequired: boolean;
  enrollmentRequired: boolean;
  recoveryCodesRemaining: number;
  recoveryCodesGeneratedAt: string | null;
  stepUpExpiresAt: string | null;
}
export interface Me {
  mfa?: TenantMfaStatus;
}
export interface WorkspaceSecurityPolicy {
  mfaRequired: boolean;
  members: { total: number; mfaEnabled: number };
}

// vizbuilder: visualization spec, resolved spec, provenance, sharing.
export type NumberFormat = "number" | "integer" | "percent" | "currency" | "compact";

/** Stored per-widget presentation spec (validated by the server). */
export interface VisualizationSpec {
  xField?: string;
  series?: string[];
  numberFormat?: NumberFormat;
  currency?: string;
  unit?: string;
  sort?: { by: "dimension" | "measure"; direction?: "asc" | "desc" };
  limit?: number;
  showOther?: boolean;
  nullHandling?: "skip" | "zero" | "label";
  pageSize?: number;
  columns?: string[];
}

/** The spec resolved by the server against the query: what the renderer honours. */
export interface ResolvedVisualization {
  type: WidgetType;
  xField: string | null;
  xBucket: string | null;
  dimensions: string[];
  measures: string[];
  numberFormat: NumberFormat;
  currency: string | null;
  unit: string | null;
  sort: VisualizationSpec["sort"] | null;
  limit: number | null;
  showOther: boolean;
  nullHandling: "skip" | "zero" | "label";
  pageSize: number | null;
  columns: string[] | null;
}

export interface WidgetProvenance {
  window: QueryWindow | null;
  timezone: string | null;
  dataset: {
    id: string;
    name: string | null;
    type: string | null;
    dataVersion: number;
    lastSyncedAt: string | null;
  };
  metrics: Array<{ op: string; field: string | null; alias: string }>;
  groupBy: Array<{ field: string; bucket: string | null }>;
  filterCount: number;
  excluded: Record<string, number>;
  metricDefinitions: unknown[];
  executedAt: string | null;
  cached: boolean;
}

export interface AnalyticsResult {
  visualization?: ResolvedVisualization;
  provenance?: WidgetProvenance;
  topN?: { limit: number; of: number; other: Record<string, unknown> | null };
  excluded?: Record<string, number>;
}

export interface Dashboard {
  visibility?: "workspace" | "restricted";
  access?: "view" | "edit" | "manage";
}

export interface DashboardSharing {
  visibility: "workspace" | "restricted";
  shares: DashboardShare[];
  candidates: {
    users: Array<{ id: string; name: string; email: string }>;
    roles: Array<{ id: string; name: string }>;
  };
}

/** Dataset schema (contract owner: datasets). */
export interface DatasetSchemaField {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "date" | "datetime";
  nullable?: boolean;
  displayName?: string;
}

export interface DatasetSchema {
  connectorId: string;
  version: number;
  fields: DatasetSchemaField[];
  dateField: string | null;
}
