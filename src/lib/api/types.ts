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

export interface SessionPayload {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  sessionId?: string;
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
  scope?: { tenantId: string | "*"; allowed?: string[] };
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
  lastSyncedAt?: string | null;
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

export type MetricOp = "count" | "sum" | "avg" | "min" | "max";
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
}

export interface QueryOrder {
  field: string;
  dir: "asc" | "desc";
}

export interface AnalyticsQueryParams {
  connectorIds?: string[];
  filters?: QueryFilter[];
  filtersOp?: "and" | "or";
  dateRange?: { from?: string; to?: string };
  metrics?: QueryMetric[];
  groupBy?: string[];
  orderBy?: QueryOrder[];
  page?: number;
  limit?: number;
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
}

export interface DashboardShare {
  id: string;
  email: string;
  role: "viewer";
  expiresAt?: string | null;
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
  error?: { message: string; code?: string };
}

export interface ReportRun {
  runId: string;
  triggeredBy: "manual" | "schedule";
  format: "json" | "csv" | "xlsx";
  status: "queued" | "running" | "ready" | "failed";
  rowCount?: number;
  resultKey?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Report {
  _id: string;
  name: string;
  source: "widget" | "query";
  sourceWidgetId?: string;
  sourceQuery?: AnalyticsQueryParams;
  format: "json" | "csv" | "xlsx";
  status?: string;
  schedule?: {
    enabled?: boolean;
    cron?: string;
    timezone?: string;
    recipients?: string[];
  };
  nextRunAt?: string;
  runs?: ReportRun[];
}

export interface AlertRule {
  _id: string;
  name: string;
  datasetId: string;
  condition: { field: string; op: FilterOp; value: unknown };
  source: "widget" | "query";
  sourceWidgetId?: string;
  sourceQuery?: AnalyticsQueryParams;
  schedule?: { cron?: string; timezone?: string };
  cooldownMinutes?: number;
  lastTriggeredAt?: string | null;
  nextEvaluationAt?: string | null;
  enabled: boolean;
  notification?: {
    channels?: Array<"email" | "in_app">;
    recipients?: string[];
    template?: string;
  };
}

export interface AlertEvent {
  _id: string;
  alertId: string;
  triggeredAt: string;
  value?: number;
  threshold?: number;
  message?: string;
  status: "triggered" | "suppressed" | "resolved";
  notificationIds?: string[];
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
}

export interface EmbedToken {
  id: string;
  name?: string;
  dashboardId: string;
  widgetId?: string | null;
  expiresAt?: string | null;
  status: string;
  createdAt?: string;
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

export type AdminType = "super_admin" | "platform_admin" | "support_admin" | "readonly_admin";

export interface PlatformAdmin {
  _id: string;
  email: string;
  name?: string;
  adminType: AdminType;
  status?: string;
  scope?: Record<string, unknown>;
  createdAt?: string;
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  scope: "platform" | "tenant";
  permissions?: string[];
}

export interface Permission {
  _id?: string;
  module: string;
  action: string;
  key?: string;
  description?: string;
}

export interface AuditLog {
  _id: string;
  actor?: { type: "user" | "admin" | "system"; id: string };
  module: string;
  action: string;
  resource?: { type: string; id: string };
  tenantId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AccessLog {
  _id: string;
  actor?: { type: string; id: string };
  method: string;
  path: string;
  status: number;
  tenantId?: string;
  durationMs?: number;
  createdAt: string;
}

export interface ComplianceRequest {
  _id: string;
  subjectEmail: string;
  subjectUserId?: string;
  type: "export" | "delete" | "restrict";
  status: string;
  notes?: string;
  evidence?: Record<string, unknown>;
  createdAt?: string;
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
