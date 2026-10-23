/** Presentation metadata for feature keys supplied by the backend catalogue. */
export const BILLING_FEATURES: Record<string, { label: string; description: string }> = {
  dashboards: { label: "Dashboard creation", description: "Create and manage dashboards." },
  reports: { label: "Report generation", description: "Create and view reports." },
  alerts: { label: "Alerting", description: "Configure alerts for tracked metrics." },
  audit_export: { label: "Data export", description: "Export workspace audit data." },
  webhook_connectors: {
    label: "Webhook integrations",
    description: "Connect workspace events to external systems.",
  },
  embedding: {
    label: "Embedded analytics",
    description: "Embed analytics in another application.",
  },
  embed: { label: "Embedded analytics", description: "Embed analytics in another application." },
  api_access: { label: "API access", description: "Use the workspace API." },
  scheduled_delivery: {
    label: "Scheduled report delivery",
    description: "Deliver reports on a schedule.",
  },
  scheduled_reports: {
    label: "Scheduled report delivery",
    description: "Deliver reports on a schedule.",
  },
  ai_assistant: {
    label: "AI-assisted analytics",
    description: "Use the AI analytics assistant when configured by an administrator.",
  },
  sso: { label: "Single sign-on", description: "Sign in through an enterprise identity provider." },
  audit_streaming: {
    label: "Audit streaming",
    description: "Stream audit events to an external destination.",
  },
  row_level_security: {
    label: "Row-level security",
    description: "Restrict data access by row-level policy.",
  },
};

export function featurePresentation(key: string) {
  const known = BILLING_FEATURES[key];
  if (known) return known;
  const label = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { label, description: "Availability is determined by the workspace plan catalogue." };
}
