import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MfaEnrollment } from "@/features/admin/security/MfaEnrollment";
import { SecondFactorInput } from "@/features/admin/security/SecondFactorInput";
import { RecoveryCodesDisplay } from "@/features/admin/security/RecoveryCodesDisplay";
import {
  disableTenantMfa,
  regenerateTenantRecoveryCodes,
  stepUpTenant,
  tenantEnrollmentApi,
} from "@/features/auth/api/tenantSecurity";
import { useTenantSession } from "@/lib/auth/session";

/** mfa-tenant: the signed-in member's MFA status, enrolment and disable. */
export function TenantMfaCard() {
  const { me, refetch } = useTenantSession();
  const [password, setPassword] = useState("");
  const [factor, setFactor] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [showRecoverySetup, setShowRecoverySetup] = useState(false);
  const [stepUpComplete, setStepUpComplete] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const disable = useMutation({
    mutationFn: () =>
      disableTenantMfa(
        password,
        useRecovery ? { recoveryCode: factor.trim() } : { code: factor.trim() },
      ),
    onSuccess: async () => {
      setPassword("");
      setFactor("");
      await refetch();
      toast.success("Multi-factor authentication is off");
    },
  });
  const confirmStepUp = useMutation({
    mutationFn: () =>
      stepUpTenant(
        password,
        useRecovery ? { recoveryCode: factor.trim() } : { code: factor.trim() },
      ),
    onSuccess: () => {
      setPassword("");
      setFactor("");
      setStepUpComplete(true);
    },
  });
  const regenerate = useMutation({
    mutationFn: regenerateTenantRecoveryCodes,
    onSuccess: (result) => setRecoveryCodes(result.recoveryCodes),
  });
  const mfa = me?.mfa;

  if (recoveryCodes) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Save your recovery codes</CardTitle>
        </CardHeader>
        <CardContent>
          <RecoveryCodesDisplay
            codes={recoveryCodes}
            onDone={async () => {
              setRecoveryCodes(null);
              setShowRecoverySetup(false);
              setStepUpComplete(false);
              await refetch();
            }}
            doneLabel="I saved my recovery codes"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          Multi-factor authentication
          <Badge variant={mfa?.enabled ? "default" : "destructive"}>
            {mfa?.enabled ? "On" : "Off"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {mfa?.required
            ? "Required by your workspace."
            : "Recommended to help protect your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!mfa?.enabled ? (
          <MfaEnrollment
            api={tenantEnrollmentApi}
            onComplete={async () => {
              await refetch();
              toast.success("Multi-factor authentication is on");
            }}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {mfa.recoveryCodesRemaining} unused recovery codes.
            </p>
            {!showRecoverySetup ? (
              <Button type="button" variant="outline" onClick={() => setShowRecoverySetup(true)}>
                Generate new recovery codes
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                {stepUpComplete ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your identity is verified. Generating a new set will invalidate your current
                      recovery codes.
                    </p>
                    {regenerate.isError ? (
                      <p className="text-sm text-destructive" role="alert">
                        Could not generate recovery codes. Try again.
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      onClick={() => regenerate.mutate()}
                      disabled={regenerate.isPending}
                    >
                      {regenerate.isPending ? "Generating..." : "Generate recovery codes"}
                    </Button>
                  </>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      confirmStepUp.mutate();
                    }}
                  >
                    <p className="text-sm text-muted-foreground">
                      Confirm your password and a current authenticator or recovery code to
                      regenerate.
                    </p>
                    <Label htmlFor="tenant-recovery-password">Password</Label>
                    <Input
                      id="tenant-recovery-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <SecondFactorInput
                      id="tenant-recovery-code"
                      value={factor}
                      onChange={setFactor}
                      useRecovery={useRecovery}
                      onToggleRecovery={setUseRecovery}
                    />
                    {confirmStepUp.isError ? (
                      <p className="text-sm text-destructive" role="alert">
                        Password or verification code is incorrect. Try again.
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button type="submit" disabled={confirmStepUp.isPending}>
                        {confirmStepUp.isPending ? "Verifying..." : "Verify identity"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowRecoverySetup(false);
                          setPassword("");
                          setFactor("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
            {!showRecoverySetup ? (
              <form
                className="space-y-3 border-t pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  disable.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="tenant-disable-password">Password</Label>
                  <Input
                    id="tenant-disable-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <SecondFactorInput
                  id="tenant-disable-code"
                  value={factor}
                  onChange={setFactor}
                  useRecovery={useRecovery}
                  onToggleRecovery={setUseRecovery}
                />
                {disable.isError ? (
                  <p className="text-sm text-destructive" role="alert">
                    Could not turn off MFA. Verify your password and code, then try again.
                  </p>
                ) : null}
                <Button type="submit" variant="destructive" disabled={disable.isPending}>
                  {disable.isPending ? "Turning off..." : "Turn off MFA"}
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
