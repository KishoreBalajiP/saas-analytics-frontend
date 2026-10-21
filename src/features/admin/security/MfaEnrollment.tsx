import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";
import type { MfaEnrollmentResult, MfaEnrollmentStart } from "@/lib/api/types";

import { errorMessage } from "./errors";
import { RecoveryCodesDisplay } from "./RecoveryCodesDisplay";

/** Base32 secret in groups of four for manual entry. */
function groupSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Admin TOTP enrolment (roadmap 2.2): start -> add the key to an
 * authenticator app -> confirm a code -> save the one-time recovery codes.
 * `onComplete` runs after the admin confirmed they saved the codes.
 */
export function MfaEnrollment({
  onComplete,
  api,
}: {
  onComplete: () => void;
  /** mfa-tenant: enrolment calls (defaults to the admin portal). */
  api?: {
    start: () => Promise<MfaEnrollmentStart>;
    verify: (code: string) => Promise<MfaEnrollmentResult>;
  };
}) {
  const [setup, setSetup] = useState<MfaEnrollmentStart | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const start = useMutation({
    mutationFn: () => (api ? api.start() : authApi.enrollMfa()),
    onSuccess: (data) => setSetup(data),
  });
  const verify = useMutation({
    mutationFn: () => (api ? api.verify(code.trim()) : authApi.verifyMfa(code.trim())),
    onSuccess: (data) => setRecoveryCodes(data.recoveryCodes ?? []),
  });

  if (recoveryCodes) {
    return <RecoveryCodesDisplay codes={recoveryCodes} onDone={onComplete} />;
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You will need an authenticator app such as 1Password, Google Authenticator or Microsoft
          Authenticator.
        </p>
        {start.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage(start.error, "Could not start MFA setup.")}
          </p>
        ) : null}
        <Button type="button" onClick={() => start.mutate()} disabled={start.isPending}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          {start.isPending ? "Preparing…" : "Set up authenticator"}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        verify.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        In your authenticator app, add an account with this setup key, or{" "}
        <a className="underline" href={setup.otpauthUrl}>
          open it in your authenticator app
        </a>{" "}
        on this device:
      </p>
      <p
        className="break-all rounded-md border bg-muted/40 p-3 font-mono text-sm tracking-wider"
        aria-label="Setup key"
      >
        {groupSecret(setup.secret)}
      </p>
      <div className="space-y-2">
        <Label htmlFor="mfa-enrol-code">Enter the 6-digit code it shows</Label>
        <Input
          id="mfa-enrol-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          required
        />
      </div>
      {verify.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage(verify.error, "That code did not work. Try the next one.")}
        </p>
      ) : null}
      <Button type="submit" disabled={verify.isPending || code.length !== 6}>
        {verify.isPending ? "Verifying…" : "Verify and turn on MFA"}
      </Button>
    </form>
  );
}
