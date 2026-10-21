import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import { stepUpAdmin } from "@/features/auth/api/adminSecurity";

import { errorMessage } from "./errors";
import { SecondFactorInput } from "./SecondFactorInput";

interface StepUpDialogProps {
  open: boolean;
  /** Admins without MFA (outside the policy) confirm with their password only. */
  mfaEnabled?: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}

/**
 * Re-authentication dialog for sensitive admin actions (roadmap 2.2). The
 * server opens a short step-up window on this session; the caller then
 * retries the action (see `useStepUp`). The form lives inside the dialog
 * content, so credentials are dropped whenever the dialog closes.
 */
export function StepUpDialog({
  open,
  mfaEnabled = true,
  onConfirmed,
  onCancel,
}: StepUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onCancel() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm it is you</DialogTitle>
          <DialogDescription>
            This action is sensitive. Enter your password
            {mfaEnabled ? " and a code from your authenticator app" : ""} to continue. You will not
            be asked again for a few minutes.
          </DialogDescription>
        </DialogHeader>
        <StepUpForm mfaEnabled={mfaEnabled} onConfirmed={onConfirmed} onCancel={onCancel} />
      </DialogContent>
    </Dialog>
  );
}

function StepUpForm({
  mfaEnabled,
  onConfirmed,
  onCancel,
}: Omit<StepUpDialogProps, "open" | "mfaEnabled"> & { mfaEnabled: boolean }) {
  const [password, setPassword] = useState("");
  const [factor, setFactor] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  const confirm = useMutation({
    mutationFn: () => {
      const value = factor.trim();
      if (!mfaEnabled || !value) return stepUpAdmin(password);
      return stepUpAdmin(password, useRecovery ? { recoveryCode: value } : { code: value });
    },
    onSuccess: () => onConfirmed(),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        confirm.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="step-up-password">Password</Label>
        <Input
          id="step-up-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      {mfaEnabled ? (
        <SecondFactorInput
          id="step-up-code"
          value={factor}
          onChange={setFactor}
          useRecovery={useRecovery}
          onToggleRecovery={setUseRecovery}
        />
      ) : null}
      {confirm.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage(confirm.error, "Could not confirm your identity.")}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={confirm.isPending}>
          {confirm.isPending ? "Checking…" : "Confirm"}
        </Button>
      </DialogFooter>
    </form>
  );
}
