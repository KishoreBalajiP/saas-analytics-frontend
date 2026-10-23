import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";
import type { MfaEnrollmentResult, MfaEnrollmentStart } from "@/lib/api/types";

import { RecoveryCodesDisplay } from "./RecoveryCodesDisplay";

function groupSecret(secret: string) {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/** Shared tenant/admin TOTP enrollment UI. Secrets stay in component memory. */
export function MfaEnrollment({
  onComplete,
  api,
}: {
  onComplete: () => void;
  api?: {
    start: () => Promise<MfaEnrollmentStart>;
    verify: (code: string) => Promise<MfaEnrollmentResult>;
  };
}) {
  const [setup, setSetup] = useState<MfaEnrollmentStart | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [qrSvg, setQrSvg] = useState("");
  const [qrError, setQrError] = useState(false);

  const start = useMutation({
    mutationFn: () => (api ? api.start() : authApi.enrollMfa()),
    onSuccess: (data) => setSetup(data),
  });
  const verify = useMutation({
    mutationFn: () => (api ? api.verify(code.trim()) : authApi.verifyMfa(code.trim())),
    onSuccess: (data) => setRecoveryCodes(data.recoveryCodes ?? []),
  });

  useEffect(() => {
    if (!setup) return;
    let active = true;
    void QRCode.toString(setup.otpauthUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#111827", light: "#ffffff" },
    })
      .then((svg) => {
        if (active) setQrSvg(svg);
      })
      .catch(() => {
        if (active) setQrError(true);
      });
    return () => {
      active = false;
    };
  }, [setup]);

  if (recoveryCodes) {
    return <RecoveryCodesDisplay codes={recoveryCodes} onDone={onComplete} />;
  }

  if (!setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          You will need an authenticator app such as Google Authenticator, 1Password, or Microsoft
          Authenticator.
        </p>
        {start.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {start.error instanceof Error && start.error.message
              ? start.error.message
              : "Could not start MFA setup. Please try again."}
          </p>
        ) : null}
        <Button
          type="button"
          aria-label="Set up MFA; Set up authenticator"
          onClick={() => start.mutate()}
          disabled={start.isPending}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          {start.isPending ? "Preparing..." : "Set up MFA"}
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
        Scan this QR code with Google Authenticator or another compatible authenticator app.
      </p>
      <div className="flex justify-center rounded-md border bg-white p-4">
        {qrSvg ? (
          <div aria-label="MFA enrollment QR code" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        ) : qrError ? (
          <p className="flex h-[240px] w-[240px] items-center justify-center text-center text-sm text-destructive">
            Could not create the QR code. Use the manual setup key below.
          </p>
        ) : (
          <div className="h-[240px] w-[240px]" aria-label="Preparing MFA enrollment QR code" />
        )}
      </div>
      <details className="rounded-md border px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium">Can&apos;t scan the QR code?</summary>
        <div className="mt-2 space-y-2 text-muted-foreground">
          <p>Enter this setup key manually in your authenticator app.</p>
          <p className="break-all font-mono tracking-wider" aria-label="Setup key">
            {groupSecret(setup.secret)}
          </p>
        </div>
      </details>
      <div className="space-y-2">
        <Label htmlFor="mfa-enrol-code">Enter the 6-digit code from your authenticator app</Label>
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
          {verify.error instanceof Error && verify.error.message
            ? verify.error.message
            : "That code did not work. Wait for a new code and try again."}
        </p>
      ) : null}
      <Button type="submit" disabled={verify.isPending || code.length !== 6}>
        {verify.isPending ? "Verifying..." : "Verify and turn on MFA"}
      </Button>
    </form>
  );
}
