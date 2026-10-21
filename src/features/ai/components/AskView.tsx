import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { EmptyState, ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as aiApi from "@/features/ai/api";
import type { AiAnswer } from "@/features/ai/api";
import { useTenantSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

export function AskView() {
  const { permissions } = useTenantSession();
  const canAsk = hasPermission(permissions, Permissions.ANALYTICS_VIEW);
  const [question, setQuestion] = useState("");
  const [rated, setRated] = useState(false);
  const statusQuery = useQuery({
    queryKey: ["ai", "status"],
    queryFn: aiApi.status,
    enabled: canAsk,
  });
  const askMutation = useMutation({
    mutationFn: (q: string) => aiApi.ask(q),
    onSuccess: () => setRated(false),
  });
  const rate = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: "up" | "down" }) =>
      aiApi.feedback(id, rating),
    onSuccess: () => setRated(true),
  });
  if (!canAsk) return <ErrorState error={{ statusCode: 403 }} resource="Ask" />;
  if (statusQuery.isLoading) return null;
  const s = statusQuery.data;
  if (!s?.available) {
    return (
      <EmptyState
        title="Ask is not available"
        description="Use the query builder in Analytics. Natural-language questions are off for this workspace."
      />
    );
  }
  if (!s.consent) {
    return (
      <EmptyState
        title="Consent required"
        description="A workspace administrator must allow AI processing of dataset schemas in Settings."
      />
    );
  }
  const answer = askMutation.data;
  const ask = (q: string) => {
    setQuestion(q);
    askMutation.mutate(q);
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
      {answer && <AnswerView answer={answer} onClarify={(o) => ask(`${question} (${o})`)} />}
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

export function AnswerView({
  answer,
  onClarify,
}: {
  answer: AiAnswer;
  onClarify: (option: string) => void;
}) {
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
      <p role="status">
        This question could not be answered ({answer.reason ?? "unknown"}). Try the query builder.
      </p>
    );
  }
  const columns = answer.result?.columns ?? [];
  return (
    <div className="space-y-3">
      {answer.assumptions?.length ? (
        <ul aria-label="Assumptions" className="list-disc pl-5 text-sm">
          {answer.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} className="text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(answer.result?.rows ?? []).map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c}>{String(row[c] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>How this was calculated</summary>
        <p className="text-xs">
          Dataset {answer.provenance?.datasetName ?? answer.provenance?.datasetId} ·{" "}
          {answer.provenance?.rowCount} of {answer.provenance?.total} rows · time zone{" "}
          {answer.provenance?.timezone}
        </p>
        <pre className="overflow-auto text-xs">{JSON.stringify(answer.plan, null, 2)}</pre>
      </details>
    </div>
  );
}
