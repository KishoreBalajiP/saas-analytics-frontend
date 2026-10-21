import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/errors/reference";

/**
 * The failed request's reference id (`X-Request-Id`) with a copy button, so
 * a user can quote it and support can find the backend log lines.
 */
export function RequestReference({ requestId }: { requestId: string | undefined }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!requestId) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span>Reference ID:</span>
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
        {requestId}
      </code>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 px-1.5"
        aria-label={copied ? "Reference ID copied" : "Copy reference ID"}
        onClick={() => {
          void copyText(requestId).then((ok) => setCopied(ok));
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </p>
  );
}
