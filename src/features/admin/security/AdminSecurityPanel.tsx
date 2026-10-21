import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  disableAdminMfa,
  forgotAdminPassword,
  regenerateRecoveryCodes,
} from "@/features/auth/api/adminSecurity";
import { useAdminSession } from "@/lib/auth/session";

import { errorMessage } from "./errors";
import { MfaEnrollment } from "./MfaEnrollment";
import { RecoveryCodesDisplay } from "./RecoveryCodesDisplay";
import { SecondFactorInput } from "./SecondFactorInput";
import { useStepUp } from "./useStepUp";

/** Fewer unused recovery codes than this triggers a warning. */
const LOW_RECOVERY_CODES = 3;

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/**
 * Admin account security (roadmap 2.2): MFA status and enrolment, recovery
 * codes (regeneration needs a fresh step-up), turning MFA off (password +
 * code), and a password reset link for the signed-in admin.
 */
export function AdminSecurityPanel() {
  const navigate = useNavigate();
  const { me, refetch } = useAdminSession();
  const stepUp = useStepUp({ mfaEnabled: Boolean(me?.mfaEnabled) });
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);

  const regenerate = useMutation({
    mutationFn: () => stepUp.run(() => regenerateRecoveryCodes()),
    onSuccess: (data) => setFreshCodes(data.recoveryCodes),
    onError: (error) => toast.error(errorMessage(error, "Could not generate new recovery codes")),
  });
  const resetLink = useMutation({
    mutationFn: () => forgotAdminPassword(me?.email ?? ""),
    onSuccess: () =>
      toast.success(`A password reset link was sent to ${me?.email ?? "your email"}`),
    onError: (error) => toast.error(errorMessage(error, "Could not send the reset link")),
  });

  if (!me) return null;
  const remaining = me.recoveryCodesRemaining ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {me.mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            )}
            Multi-factor authentication
            <Badge variant={me.mfaEnabled ? "default" : "destructive"}>
              {me.mfaEnabled ? "On" : "Off"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {me.mfaRequired
              ? "Required for your admin role."
              : "Recommended for every administrator."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!me.mfaEnabled ? (
            <MfaEnrollment
              onComplete={async () => {
                await refetch();
                toast.success("Multi-factor authentication is on");
              }}
            />
          ) : freshCodes ? (
            <RecoveryCodesDisplay
              codes={freshCodes}
              doneLabel="Done"
              onDone={async () => {
                setFreshCodes(null);
                await refetch();
              }}
            />
          ) : (
            <>
              <div className="flex items-start gap-3 text-sm">
                <KeyRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">
                    {remaining} unused recovery code{remaining === 1 ? "" : "s"}
                  </div>
                  <div className="text-muted-foreground">
                    Generated {formatDate(me.recoveryCodesGeneratedAt)}
                  </div>
                </div>
              </div>
              {remaining <= LOW_RECOVERY_CODES ? (
                <Alert variant="destructive">
                  <AlertTitle>Few recovery codes left</AlertTitle>
                  <AlertDescription>
                    Generate a new set so you can still sign in if you lose your authenticator.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => regenerate.mutate()}
                  disabled={regenerate.isPending}
                >
                  {regenerate.isPending ? "Generating…" : "Generate new recovery codes"}
                </Button>
                <Button variant="ghost" onClick={() => setDisableOpen(true)}>
                  Turn off MFA
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs you out everywhere. We email a single-use link to{" "}
            {me.email}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => resetLink.mutate()}
            disabled={resetLink.isPending}
          >
            {resetLink.isPending ? "Sending…" : "Email me a reset link"}
          </Button>
        </CardContent>
      </Card>

      <DisableMfaDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onDisabled={async (enrollmentRequired) => {
          setDisableOpen(false);
          await refetch();
          if (enrollmentRequired) {
            toast.info("Your role requires MFA. Set up your new authenticator now.");
            void navigate({ to: "/admin/mfa-setup" });
          } else {
            toast.success("Multi-factor authentication is off");
          }
        }}
      />
      {stepUp.dialog}
    </div>
  );
}

function DisableMfaDialog({
  open,
  onClose,
  onDisabled,
}: {
  open: boolean;
  onClose: () => void;
  onDisabled: (enrollmentRequired: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn off multi-factor authentication?</DialogTitle>
          <DialogDescription>
            Your recovery codes stop working too. If your role requires MFA you will have to set up
            a new authenticator before doing anything else.
          </DialogDescription>
        </DialogHeader>
        <DisableMfaForm onClose={onClose} onDisabled={onDisabled} />
      </DialogContent>
    </Dialog>
  );
}

function DisableMfaForm({
  onClose,
  onDisabled,
}: {
  onClose: () => void;
  onDisabled: (enrollmentRequired: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [factor, setFactor] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const disable = useMutation({
    mutationFn: () =>
      disableAdminMfa(
        password,
        useRecovery ? { recoveryCode: factor.trim() } : { code: factor.trim() },
      ),
    onSuccess: (data) => onDisabled(Boolean(data.enrollmentRequired)),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        disable.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="disable-mfa-password">Password</Label>
        <Input
          id="disable-mfa-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <SecondFactorInput
        id="disable-mfa-code"
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={disable.isPending}>
          {disable.isPending ? "Turning off…" : "Turn off MFA"}
        </Button>
      </DialogFooter>
    </form>
  );
}
