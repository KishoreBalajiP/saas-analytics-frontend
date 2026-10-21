import { Copy, Download, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * One-time display of MFA recovery codes (roadmap 2.2). The server stores
 * only digests, so this is the only time the admin can see them: they must
 * confirm they saved them before continuing.
 */
export function RecoveryCodesDisplay({
  codes,
  onDone,
  doneLabel = "Continue",
}: {
  codes: string[];
  onDone: () => void;
  doneLabel?: string;
}) {
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Copy failed; select the codes and copy them manually");
    }
  };

  const download = () => {
    const blob = new Blob(
      [`Analivo admin portal recovery codes\nEach code works once.\n\n${text}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "analivo-admin-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Alert>
        <KeyRound className="h-4 w-4" />
        <AlertTitle>Save your recovery codes</AlertTitle>
        <AlertDescription>
          If you lose your authenticator, each code signs you in once instead of an authenticator
          code. They are shown only now; store them somewhere safe, such as a password manager.
        </AlertDescription>
      </Alert>
      <ol
        aria-label="Recovery codes"
        className="grid grid-cols-1 gap-2 rounded-md border bg-muted/40 p-4 font-mono text-sm sm:grid-cols-2"
      >
        {codes.map((code) => (
          <li key={code} className="tracking-wider">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
          <Copy className="mr-2 h-4 w-4" /> Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="recovery-codes-saved"
          checked={saved}
          onCheckedChange={(value) => setSaved(value === true)}
        />
        <Label htmlFor="recovery-codes-saved" className="text-sm font-normal">
          I have saved these recovery codes
        </Label>
      </div>
      <Button type="button" className="w-full" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </Button>
    </div>
  );
}
