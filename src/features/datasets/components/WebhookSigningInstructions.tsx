import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyableValue } from "@/features/datasets/components/FileUploadZone";
import { webhookIngestUrl } from "@/features/datasets/api";
import { signingExample } from "@/features/datasets/lib/webhookSigning";

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Where to send webhook deliveries and how to sign them (timestamp-bound
 * `v2` scheme). Legacy connectors get an upgrade path.
 */
export function WebhookSigningInstructions({
  webhookToken,
  signatureVersion,
  toleranceSeconds,
  onUpgrade,
  upgrading = false,
}: {
  webhookToken: string;
  signatureVersion?: 1 | 2 | undefined;
  toleranceSeconds?: number | undefined;
  onUpgrade?: (() => void) | undefined;
  upgrading?: boolean;
}) {
  const url = webhookIngestUrl(webhookToken);
  const tolerance = toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const legacy = signatureVersion !== 2;

  return (
    <div className="space-y-4">
      <CopyableValue label="Endpoint URL (POST)" value={url} />

      {legacy ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Legacy signatures enabled</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              This webhook still accepts the older body-only signature (<code>sha256=…</code>),
              which cannot stop replayed deliveries. Update your sender to the timestamped signature
              below, then require it.
            </p>
            {onUpgrade ? (
              <Button size="sm" variant="outline" onClick={onUpgrade} disabled={upgrading}>
                {upgrading ? "Updating…" : "Require timestamped signatures"}
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          Timestamped signatures required. Replayed deliveries are rejected.
        </p>
      )}

      <div className="space-y-2 text-sm">
        <h4 className="font-medium">Signing each request</h4>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>
            Send the body as JSON with <code>Content-Type: application/json</code>.
          </li>
          <li>
            Set <code>X-Saas-Timestamp</code> to the current Unix time in seconds. Requests older
            than {tolerance} seconds are rejected.
          </li>
          <li>
            Compute HMAC-SHA256 with your signing secret over{" "}
            <code>{"<timestamp>.<raw body>"}</code> (the timestamp, a dot, then the exact body
            bytes).
          </li>
          <li>
            Send it as <code>X-Saas-Signature: v2=&lt;hex digest&gt;</code>. Use a new timestamp for
            every delivery and retry: a repeated signature is rejected as a replay.
          </li>
        </ol>
        <pre
          aria-label="Signing example"
          className="max-h-72 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px] leading-relaxed"
        >
          {signingExample(url)}
        </pre>
      </div>
    </div>
  );
}
