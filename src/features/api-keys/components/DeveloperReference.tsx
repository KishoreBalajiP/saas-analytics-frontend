import { useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";

import { ErrorState, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as apiKeysApi from "@/features/api-keys/api";

const PLACEHOLDER_ORIGIN = "https://api.analivo.example";

/** The API origin this deployment actually serves (mirrors lib/api/client). */
export function apiOrigin(): string {
  const configured = import.meta.env["VITE_API_BASE_URL"] as string | undefined;
  if (configured) return configured.replace(/\/+$/, "");
  if (import.meta.env.PROD && typeof window !== "undefined") return window.location.origin;
  return "http://localhost:8080";
}

/** Replace the spec placeholder host so copied curl commands work here. */
export function withRealBaseUrl(source: string, origin = apiOrigin()): string {
  return source.split(PLACEHOLDER_ORIGIN).join(origin);
}

function CopyBlock({ text, label }: { text: string; label: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 pr-10 text-xs">{text}</pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute right-1 top-1"
        aria-label={label}
        onClick={() => void navigator.clipboard?.writeText(text)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Renders the external API's OpenAPI 3.1 reference with copyable examples. */
export function DeveloperReference() {
  const query = useQuery({ queryKey: ["developer", "openapi"], queryFn: apiKeysApi.openApi });
  if (query.isLoading) return <TableSkeleton rows={4} cols={2} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="API reference" />
    );
  const spec = query.data;
  if (!spec) return null;
  const base = spec.servers?.[0]?.url ?? "";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {spec.info.title}{" "}
            <span className="text-sm text-muted-foreground">v{spec.info.version}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{spec.info.description}</p>
          <p>
            Base path: <code>{base}</code>
          </p>
        </CardContent>
      </Card>
      {Object.entries(spec.paths).flatMap(([path, ops]) =>
        Object.entries(ops).map(([method, op]) => (
          <Card key={`${method} ${path}`} aria-label={`${method.toUpperCase()} ${path}`}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Badge>{method.toUpperCase()}</Badge>
                <code>{path}</code>
                <span className="text-sm font-normal text-muted-foreground">{op.summary}</span>
                {op["x-scope"] ? <Badge variant="outline">{op["x-scope"]}</Badge> : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {op.parameters?.length ? (
                <ul className="text-xs">
                  {op.parameters.map((p) => (
                    <li key={`${p.in}-${p.name}`}>
                      <code>{p.name}</code> ({p.in}
                      {p.required ? ", required" : ""}){p.description ? ` — ${p.description}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {(op["x-codeSamples"] ?? []).map((sample) => (
                <CopyBlock
                  key={sample.lang}
                  text={withRealBaseUrl(sample.source)}
                  label={`Copy ${sample.lang} example for ${method.toUpperCase()} ${path}`}
                />
              ))}
              {Object.entries(op.responses ?? {}).map(([status, r]) => {
                const example = r.content?.["application/json"]?.example;
                return (
                  <details key={status}>
                    <summary className="cursor-pointer text-xs">
                      {status} — {r.description}
                    </summary>
                    {example !== undefined ? (
                      <CopyBlock
                        text={JSON.stringify(example, null, 2)}
                        label={`Copy ${status} response for ${path}`}
                      />
                    ) : null}
                  </details>
                );
              })}
            </CardContent>
          </Card>
        )),
      )}
      {spec["x-errorCodes"] ? (
        <Card>
          <CardHeader>
            <CardTitle>Error codes</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs">
              {Object.entries(spec["x-errorCodes"]).map(([code, e]) => (
                <li key={code}>
                  <code>{code}</code> ({e.status}) — {e.description}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
