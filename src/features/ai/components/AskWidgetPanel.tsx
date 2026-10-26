import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppLink } from "@/components/common/AppLink";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as aiApi from "@/features/ai/api";
import type { AiChartType } from "@/features/ai/api";
import { AnswerView } from "@/features/ai/components/AskView";
import { AddToDashboardButton } from "@/features/dashboards/components/AddToDashboardDialog";

/**
 * "Ask AI" path of the dashboard editor: ask a question, review the answer
 * and its chart, then add it to this dashboard as a widget. The widget
 * stores the validated query, so it re-runs on live data like any other.
 */
export function AskWidgetPanel({
  dashboardId,
  onAdded,
}: {
  dashboardId: string;
  onAdded: () => void;
}) {
  const [question, setQuestion] = useState("");
  const statusQuery = useQuery({ queryKey: ["ai", "status"], queryFn: aiApi.status });
  const askMutation = useMutation({ mutationFn: (q: string) => aiApi.ask(q) });

  if (statusQuery.isLoading) return null;
  if (statusQuery.isError)
    return (
      <ErrorState error={statusQuery.error} onRetry={() => statusQuery.refetch()} resource="Ask" />
    );
  const s = statusQuery.data;
  if (!s?.available) {
    return (
      <div role="status" className="space-y-2 rounded-md border border-dashed p-4 text-sm">
        <p className="font-medium">Ask is not available</p>
        <p className="text-muted-foreground">
          {s?.action ?? "Natural-language questions are off for this workspace."} You can still
          build the widget visually.
        </p>
        {s?.reason === "AI_CONSENT_REQUIRED" ? (
          <Button asChild size="sm" variant="outline">
            <AppLink to="/ask">Review AI consent</AppLink>
          </Button>
        ) : null}
      </div>
    );
  }

  const answer = askMutation.data;
  return (
    <div className="space-y-3">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) askMutation.mutate(question.trim());
        }}
      >
        <label htmlFor="ask-widget-question" className="text-sm font-medium">
          Question
        </label>
        <Textarea
          id="ask-widget-question"
          placeholder="e.g. Revenue by product category this year"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={askMutation.isPending || !question.trim()}>
          {askMutation.isPending ? "Asking…" : "Ask"}
        </Button>
      </form>
      {askMutation.isError ? <ErrorState error={askMutation.error} resource="Answer" /> : null}
      {answer ? (
        <AnswerView
          answer={answer}
          onClarify={(option) => {
            const q = `${question.trim()} (${option})`;
            setQuestion(q);
            askMutation.mutate(q);
          }}
          actions={
            answer.outcome === "answered" && answer.plan && answer.provenance?.datasetId
              ? (chartType: AiChartType) => (
                  <AddToDashboardButton
                    query={answer.plan!}
                    datasetId={answer.provenance!.datasetId}
                    rows={answer.result?.rows ?? []}
                    defaultTitle={question.trim().slice(0, 120)}
                    defaultType={chartType}
                    defaultDashboardId={dashboardId}
                    onAdded={onAdded}
                  />
                )
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
