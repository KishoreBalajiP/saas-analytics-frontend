import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/features/admin/security/errors";
import { MfaEnrollment } from "@/features/admin/security/MfaEnrollment";
import { SecondFactorInput } from "@/features/admin/security/SecondFactorInput";
import { disableTenantMfa, tenantEnrollmentApi } from "@/features/auth/api/tenantSecurity";
import { useTenantSession } from "@/lib/auth/session";

/** mfa-tenant: the signed-in member's MFA status, enrolment and disable. */
export function TenantMfaCard() {
  const { me, refetch } = useTenantSession();
  const [password, setPassword] = useState("");
  const [factor, setFactor] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
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
  const mfa = me?.mfa;
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
          {mfa?.required ? "Required by your workspace." : "Recommended for every member."}
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
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              disable.mutate();
            }}
          >
            <p className="text-sm text-muted-foreground">
              {mfa.recoveryCodesRemaining} unused recovery codes.
            </p>
            <div className="space-y-2">
              <Label htmlFor="tenant-disable-password">Password</Label>
              <Input
                id="tenant-disable-password"
                type="password"
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
                {errorMessage(disable.error, "Could not turn off MFA.")}
              </p>
            ) : null}
            <Button type="submit" variant="destructive" disabled={disable.isPending}>
              Turn off MFA
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
