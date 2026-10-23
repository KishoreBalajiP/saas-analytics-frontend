import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState, type ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
import { WidgetView } from "@/components/common/WidgetView";
import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as aiApi from "@/features/ai/api";
import type { AiAnswer, AiChartType } from "@/features/ai/api";
import { AddToDashboardButton } from "@/features/dashboards/components/AddToDashboardDialog";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

export function AskView() {
  const { permissions } = useTenantSession();
  const canAsk = hasPermission(permissions, Permissions.ANALYTICS_VIEW);
  const canConsent = hasPermission(permissions, Permissions.SETTINGS_UPDATE);
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");
  const [rated, setRated] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const statusQuery = useQuery({
    queryKey: ["ai", "status"],
    queryFn: aiApi.status,
    enabled: canAsk,
  });
  const askMutation = useMutation({
    mutationFn: ({ q, previousId }: { q: string; previousId?: string }) => aiApi.ask(q, previousId),
    onSuccess: () => setRated(false),
  });
  const consent = useMutation({
    mutationFn: () => aiApi.setConsent(true),
    onSuccess: () => {
      toast.success("AI processing allowed for this workspace");
      void queryClient.invalidateQueries({ queryKey: ["ai", "status"] });
    },
    onError: (err: Error) => toast.error(err.message || "Could not record consent"),
  });
  const rate = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: "up" | "down" }) =>
      aiApi.feedback(id, rating),
    onSuccess: () => setRated(true),
  });
  if (!canAsk) return <ErrorState error={{ statusCode: 403 }} resource="Ask" />;
  if (statusQuery.isLoading) return null;
  if (statusQuery.isError)
    return (
      <ErrorState error={statusQuery.error} onRetry={() => statusQuery.refetch()} resource="Ask" />
    );
  const s = statusQuery.data;
  if (s && (s.reason === "AI_CONSENT_REQUIRED" || (!s.consent && !s.reason))) {
    return (
      <EmptyState
        title="Consent required"
        description={
          canConsent
            ? "Ask sends dataset field names and your question (never row data or credentials) to the AI provider. Allow this once for the workspace to start asking questions."
            : "A workspace administrator must allow AI processing before questions can be asked."
        }
        action={
          canConsent ? (
            <Button onClick={() => consent.mutate()} disabled={consent.isPending}>
              Allow AI processing
            </Button>
          ) : undefined
        }
      />
    );
  }
  if (!s?.available) {
    return (
      <EmptyState
        title="Ask is not available"
        description={
          s?.action ??
          "Natural-language questions are off for this workspace. Use the query builder in Analytics instead."
        }
        action={
          s?.reason === "FEATURE_NOT_AVAILABLE" ? (
            <Button asChild variant="outline">
              <AppLink to="/pricing">View plans</AppLink>
            </Button>
          ) : (
            <Button asChild variant="outline">
              <AppLink to="/analytics">Open Analytics</AppLink>
            </Button>
          )
        }
      />
    );
  }
  const answer = askMutation.data;
  const ask = (q: string) => {
    setQuestion(q);
    askMutation.mutate({ q });
  };
  const askFollowUp = (q: string) => {
    if (!answer) return;
    setFollowUp("");
    askMutation.mutate({ q, previousId: answer.id });
  };
  return (
    <div className="space-y-4">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
      >
        <label htmlFor="ai-question" className="text-sm font-medium">
          Question
        </label>
        <Textarea id="ai-question" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Button type="submit" disabled={askMutation.isPending}>
          Ask
        </Button>
      </form>
      {askMutation.isError && <ErrorState error={askMutation.error} resource="Answer" />}
      {answer && (
        <AnswerView
          answer={answer}
          onClarify={(o) => ask(`${question} (${o})`)}
          actions={
            answer.outcome === "answered" && answer.plan && answer.provenance?.datasetId ? (
              <AddToDashboardButton
                query={answer.plan}
                datasetId={answer.provenance.datasetId}
                rows={answer.result?.rows ?? []}
                defaultTitle={question.trim().slice(0, 120)}
              />
            ) : undefined
          }
        />
      )}
      {answer?.outcome === "answered" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (followUp.trim()) askFollowUp(followUp.trim());
          }}
        >
          <label htmlFor="ai-follow-up" className="sr-only">
            Ask a follow-up
          </label>
          <input
            id="ai-follow-up"
            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
            placeholder="Ask a follow-up, e.g. now split by city"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" disabled={askMutation.isPending}>
            Ask follow-up
          </Button>
        </form>
      )}
      {answer && (
        <div className="flex gap-2 text-sm">
          {rated ? (
            <span>Thanks for the feedback.</span>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rate.mutate({ id: answer.id, rating: "up" })}
              >
                Helpful
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rate.mutate({ id: answer.id, rating: "down" })}
              >
                Not right
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const CHART_LABELS: Record<AiChartType, string> = {
  kpi: "Number",
  line: "Line",
  area: "Area",
  bar: "Bar",
  pie: "Pie",
  table: "Table",
};

export function AnswerView({
  answer,
  onClarify,
  actions,
}: {
  answer: AiAnswer;
  onClarify: (option: string) => void;
  /** Extra controls rendered next to the chart switcher (e.g. "Add to dashboard"). */
  actions?: ReactNode;
}) {
  const recommended = answer.visualization?.type ?? "table";
  const [chosen, setChosen] = useState<{ id: string; type: AiChartType } | null>(null);
  const chartType = chosen?.id === answer.id ? chosen.type : recommended;
  if (answer.outcome === "clarify" && answer.clarify) {
    return (
      <div className="space-y-2">
        <p>{answer.clarify.question}</p>
        <div className="flex flex-wrap gap-2">
          {answer.clarify.options.map((o) => (
            <Button key={o} size="sm" variant="secondary" onClick={() => onClarify(o)}>
              {o}
            </Button>
          ))}
        </div>
      </div>
    );
  }
  if (answer.outcome !== "answered") {
    return (
      <div role="status" className="space-y-1">
        <p>
          This question could not be answered ({answer.reason ?? "unknown"}).{" "}
          {answer.message ?? "Try rephrasing it or use the query builder."}
        </p>
        {answer.missing?.length ? (
          <p className="text-sm text-muted-foreground">Missing: {answer.missing.join(", ")}</p>
        ) : null}
      </div>
    );
  }
  const options: AiChartType[] = answer.visualization?.alternatives?.length
    ? answer.visualization.alternatives
    : ["table"];
  return (
    <div className="space-y-3">
      {answer.assumptions?.length ? (
        <ul aria-label="Assumptions" className="list-disc pl-5 text-sm">
          {answer.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Chart type" className="flex flex-wrap gap-1">
          {options.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={t === chartType ? "secondary" : "ghost"}
              aria-pressed={t === chartType}
              onClick={() => setChosen({ id: answer.id, type: t })}
            >
              {CHART_LABELS[t]}
              {t === recommended ? " (recommended)" : ""}
            </Button>
          ))}
        </div>
        {actions ? <div className="ml-auto flex gap-2">{actions}</div> : null}
      </div>
      <WidgetView
        type={chartType}
        result={{
          rows: answer.result?.rows ?? [],
          columns: answer.result?.columns ?? [],
          ...(answer.provenance ? { total: answer.provenance.total } : {}),
          ...(answer.provenance?.timezone ? { timezone: answer.provenance.timezone } : {}),
        }}
      />
      <details>
        <summary>How this was calculated</summary>
        <p className="text-xs">
          Dataset {answer.provenance?.datasetName ?? answer.provenance?.datasetId} ·{" "}
          {answer.provenance?.rowCount} of {answer.provenance?.total} rows · time zone{" "}
          {answer.provenance?.timezone}
        </p>
        {answer.checks?.includes("truncated") ? (
          <p className="text-xs">Only the first {answer.provenance?.rowCount} rows are shown.</p>
        ) : null}
        <pre className="overflow-auto text-xs">{JSON.stringify(answer.plan, null, 2)}</pre>
      </details>
    </div>
  );
}
