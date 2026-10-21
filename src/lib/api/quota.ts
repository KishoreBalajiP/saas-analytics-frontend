/**
 * Plan-limit (quota) error handling shared by every create action.
 *
 * The backend refuses a create that would pass a hard plan limit with
 * `code: "QUOTA_EXCEEDED"` (409 for resource counts, 429 for daily API
 * calls) and one `errors` entry keyed by the metric:
 *   { field, message, metric, limit, current, requested, period, resetsAt }
 *
 * `errorMessage()` turns that into one consistent sentence naming the
 * metric, the limit and current use; `toastError()` shows it as a toast
 * with a link to the usage panel. Other errors keep their own message.
 */

import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { referenceToastOptions, requestIdOf } from "@/lib/errors/reference";

export const QUOTA_EXCEEDED = "QUOTA_EXCEEDED";

/** Human labels for usage metrics (plural nouns). */
export const QUOTA_METRIC_LABELS: Record<string, string> = {
  members: "team members",
  connectors: "connectors",
  dashboards: "dashboards",
  reports: "reports",
  alerts: "alerts",
  scheduledReports: "scheduled reports",
  storedRows: "stored rows",
  apiCallsPerDay: "API calls per day",
};

/** Title-case label for headings and tiles. */
export function metricTitle(metric: string): string {
  const label = QUOTA_METRIC_LABELS[metric] ?? metric;
  if (metric === "apiCallsPerDay") return "API calls / day";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface QuotaDetails {
  metric: string;
  limit: number | null;
  current: number | null;
  period: string | null;
  resetsAt: string | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** True when `err` is the backend's plan-limit refusal. */
export function isQuotaExceeded(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === QUOTA_EXCEEDED;
}

/** Structured details of a plan-limit refusal, or null for other errors. */
export function getQuotaDetails(err: unknown): QuotaDetails | null {
  if (!isQuotaExceeded(err)) return null;
  const entry = (err.errors?.[0] ?? {}) as unknown as Record<string, unknown>;
  const metric =
    (typeof entry["metric"] === "string" && entry["metric"]) ||
    (typeof entry["field"] === "string" && entry["field"]) ||
    "";
  return {
    metric,
    limit: num(entry["limit"]),
    current: num(entry["current"]),
    period: typeof entry["period"] === "string" ? entry["period"] : null,
    resetsAt: typeof entry["resetsAt"] === "string" ? entry["resetsAt"] : null,
  };
}

function fmt(value: number): string {
  return value.toLocaleString("en-US");
}

function resetPhrase(resetsAt: string | null): string {
  if (!resetsAt) return "It resets at midnight UTC.";
  const at = new Date(resetsAt);
  if (Number.isNaN(at.getTime())) return "It resets at midnight UTC.";
  const time = at.toISOString().slice(11, 16);
  return `It resets at ${time} UTC.`;
}

/** One consistent sentence for a plan-limit refusal. */
export function quotaMessage(details: QuotaDetails): string {
  const { metric, limit, current } = details;
  const label = QUOTA_METRIC_LABELS[metric] ?? (metric || "this resource");
  if (metric === "apiCallsPerDay") {
    const cap = limit !== null ? `${fmt(limit)} API calls per day` : "its daily API calls";
    return `Your plan allows ${cap} and today's allowance is used up. ${resetPhrase(details.resetsAt)}`;
  }
  if (limit === 0) {
    return `Your plan does not include ${label}. Upgrade your plan to use them.`;
  }
  const noun = limit === 1 ? label.replace(/s$/u, "") : label;
  const used =
    current === null ? "" : ` and ${fmt(current)} ${current === 1 ? "is" : "are"} in use`;
  const cap = limit !== null ? `${fmt(limit)} ${noun}` : label;
  const fix =
    metric === "storedRows"
      ? "Delete data you no longer need or upgrade your plan."
      : `Delete ${label} you no longer need or upgrade your plan.`;
  return `Plan limit reached: your plan allows ${cap}${used}. ${fix}`;
}

// billing: plan feature gates (`403 FEATURE_NOT_AVAILABLE` from requireFeature).
export const FEATURE_NOT_AVAILABLE = "FEATURE_NOT_AVAILABLE";

/** Human labels for the plan feature keys. */
export const FEATURE_LABELS: Record<string, string> = {
  embedding: "Embedding",
  api_access: "API access",
  scheduled_delivery: "Scheduled delivery",
  ai_assistant: "AI assistant",
  sso: "Single sign-on",
  audit_streaming: "Audit streaming",
  row_level_security: "Row-level security",
};

/** True when `err` is the backend's "plan lacks this feature" refusal. */
export function isFeatureNotAvailable(err: unknown): err is ApiError {
  return err instanceof ApiError && err.code === FEATURE_NOT_AVAILABLE;
}

/** The feature key a feature refusal names, or null. */
export function getUnavailableFeature(err: unknown): string | null {
  if (!isFeatureNotAvailable(err)) return null;
  const entry = (err.errors?.[0] ?? {}) as unknown as Record<string, unknown>;
  return typeof entry["feature"] === "string" ? entry["feature"] : null;
}

/** One sentence for a feature the plan does not include. */
export function featureMessage(feature: string | null): string {
  const label = feature ? (FEATURE_LABELS[feature] ?? feature) : "This feature";
  return `${label} is not included in your plan. Upgrade your plan to use it.`;
}

/** Page that lists plans and starts a checkout. */
export const PRICING_PAGE = "/pricing";

/** Message for any error from a create action; plan limits get the quota sentence. */
export function errorMessage(err: unknown, fallback: string): string {
  const details = getQuotaDetails(err);
  if (details) return quotaMessage(details);
  if (isFeatureNotAvailable(err)) return featureMessage(getUnavailableFeature(err));
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Path of the page that shows usage against plan limits. */
export const USAGE_PAGE = "/billing";

/**
 * Toast an error from a create action. Plan-limit refusals get a titled
 * toast naming the metric with a "View usage" action.
 */
export function toastError(err: unknown, fallback: string) {
  if (isFeatureNotAvailable(err)) {
    toast.error("Not included in your plan", {
      description: featureMessage(getUnavailableFeature(err)),
      action: {
        label: "View plans",
        onClick: () => {
          if (typeof window !== "undefined") window.location.assign(PRICING_PAGE);
        },
      },
    });
    return;
  }
  const details = getQuotaDetails(err);
  const requestId = requestIdOf(err);
  if (!details) {
    // Failed API calls show their copyable reference id.
    if (requestId) toast.error(errorMessage(err, fallback), referenceToastOptions(requestId));
    else toast.error(errorMessage(err, fallback));
    return;
  }
  toast.error("Plan limit reached", {
    description: requestId
      ? `${quotaMessage(details)} Reference ID: ${requestId}`
      : quotaMessage(details),
    action: {
      label: "View usage",
      onClick: () => {
        if (typeof window !== "undefined") window.location.assign(USAGE_PAGE);
      },
    },
  });
}
