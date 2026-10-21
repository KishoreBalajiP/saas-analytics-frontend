import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  resendAdminInvitation,
  resetAdminMfaFor,
  resetAdminPasswordFor,
  revokeAdminInvitation,
} from "@/features/admin/api/adminAccess";
import type { PlatformAdmin } from "@/lib/api/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

import { errorMessage } from "./errors";
import { useStepUp } from "./useStepUp";

type ResetKind = "mfa" | "password";

const RESET_COPY: Record<ResetKind, { title: string; body: string; done: string }> = {
  mfa: {
    title: "Reset this admin's MFA?",
    body: "Their authenticator and recovery codes stop working, every session ends, and they must set up MFA again at their next sign-in.",
    done: "MFA reset. The admin must enrol again at the next sign-in.",
  },
  password: {
    title: "Reset this admin's password?",
    body: "Their current password stops working at once, every session ends, and they receive a single-use link to choose a new one.",
    done: "Password reset. A reset link was emailed to the admin.",
  },
};

/**
 * Row actions for one platform admin (roadmap 2.2): resend / revoke a
 * pending invitation, and admin-assisted MFA or password reset. Resets are
 * offered to super admins for other admins only and need a fresh step-up;
 * the server enforces every rule.
 */
export function AdminAccessActions({ admin, isSelf }: { admin: PlatformAdmin; isSelf: boolean }) {
  const queryClient = useQueryClient();
  const { me, permissions } = useAdminSession();
  const stepUp = useStepUp({ mfaEnabled: Boolean(me?.mfaEnabled) });
  const [reset, setReset] = useState<ResetKind | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });

  const resend = useMutation({
    mutationFn: () => resendAdminInvitation(admin._id),
    onSuccess: (result) => {
      if (result.delivered) toast.success(`Invitation sent again to ${admin.email}`);
      else toast.warning("Invitation renewed, but the email could not be delivered");
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "Could not resend the invitation")),
  });
  const revoke = useMutation({
    mutationFn: () => revokeAdminInvitation(admin._id),
    onSuccess: () => {
      toast.success(`Invitation for ${admin.email} revoked`);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "Could not revoke the invitation")),
  });

  const pending = admin.status === "pending";
  const isSuperActor = String(me?.adminType ?? me?.type ?? "") === "super";
  const canReset =
    !pending &&
    !isSelf &&
    isSuperActor &&
    hasPermission(permissions, Permissions.IAM_ADMINS_CONFIGURE);

  return (
    <>
      {pending && hasPermission(permissions, Permissions.IAM_ADMINS_CREATE) ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
        >
          Resend invite
        </Button>
      ) : null}
      {pending && hasPermission(permissions, Permissions.IAM_ADMINS_DELETE) ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => revoke.mutate()}
          disabled={revoke.isPending}
        >
          Revoke invite
        </Button>
      ) : null}
      {canReset ? (
        <>
          <Button size="sm" variant="outline" onClick={() => setReset("mfa")}>
            Reset MFA
          </Button>
          <Button size="sm" variant="outline" onClick={() => setReset("password")}>
            Reset password
          </Button>
        </>
      ) : null}
      <Dialog open={reset !== null} onOpenChange={(next) => (!next ? setReset(null) : undefined)}>
        <DialogContent>
          {reset ? (
            <ResetForm
              kind={reset}
              email={admin.email}
              run={(reason) =>
                stepUp.run(() =>
                  reset === "mfa"
                    ? resetAdminMfaFor(admin._id, reason)
                    : resetAdminPasswordFor(admin._id, reason),
                )
              }
              onDone={() => {
                toast.success(RESET_COPY[reset].done);
                setReset(null);
                refresh();
              }}
              onCancel={() => setReset(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {stepUp.dialog}
    </>
  );
}

function ResetForm({
  kind,
  email,
  run,
  onDone,
  onCancel,
}: {
  kind: ResetKind;
  email: string;
  run: (reason: string) => Promise<unknown>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: () => run(reason.trim()), onSuccess: onDone });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length >= 3) mutation.mutate();
      }}
    >
      <DialogHeader>
        <DialogTitle>{RESET_COPY[kind].title}</DialogTitle>
        <DialogDescription>
          {email}: {RESET_COPY[kind].body}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor={`reset-${kind}-reason`}>Reason (recorded in the audit log)</Label>
        <Textarea
          id={`reset-${kind}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          required
        />
      </div>
      {mutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage(mutation.error, "The reset did not go through.")}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={mutation.isPending || reason.trim().length < 3}
        >
          {mutation.isPending ? "Resetting…" : kind === "mfa" ? "Reset MFA" : "Reset password"}
        </Button>
      </DialogFooter>
    </form>
  );
}
