import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { InlineFieldErrors } from "@/components/common/states";
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
import { inviteAdmin } from "@/features/admin/api/adminAccess";
import type { BackendAdminType } from "@/lib/api/types";
import { useAdminSession } from "@/lib/auth/session";
import { Permissions, hasPermission } from "@/lib/permissions";

import { errorMessage } from "./errors";
import { useStepUp } from "./useStepUp";

const TYPES: { value: BackendAdminType; label: string; hint: string }[] = [
  { value: "support", label: "Support", hint: "Support tooling" },
  { value: "platform", label: "Platform", hint: "Platform operations; MFA required" },
  { value: "super", label: "Super", hint: "Full control; MFA required" },
];

/** True when the signed-in admin is a super admin (backend type `super`). */
function isSuper(me: { adminType?: unknown; type?: unknown } | null) {
  return String(me?.adminType ?? me?.type ?? "") === "super";
}

/**
 * "Invite admin" (finding adm.09): the invitee receives an emailed link and
 * chooses their own password. Inviting a super admin needs a fresh step-up
 * and a super inviter (enforced server-side; the option is hidden otherwise).
 */
export function AdminInviteButton() {
  const { me, permissions } = useAdminSession();
  const [open, setOpen] = useState(false);
  if (!hasPermission(permissions, Permissions.IAM_ADMINS_CREATE)) return null;
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" /> Invite admin
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a platform admin</DialogTitle>
            <DialogDescription>
              They receive a single-use link to choose a password. Nobody else ever sees it.
            </DialogDescription>
          </DialogHeader>
          <InviteForm
            canInviteSuper={isSuper(me)}
            mfaEnabled={Boolean(me?.mfaEnabled)}
            onDone={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteForm({
  canInviteSuper,
  mfaEnabled,
  onDone,
}: {
  canInviteSuper: boolean;
  mfaEnabled: boolean;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const stepUp = useStepUp({ mfaEnabled });
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adminType, setAdminType] = useState<BackendAdminType>("support");
  const invite = useMutation({
    mutationFn: () =>
      stepUp.run(() =>
        inviteAdmin({
          email: email.trim(),
          adminType,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      ),
    onSuccess: (result) => {
      if (result.delivered) toast.success(`Invitation sent to ${result.email}`);
      else toast.warning(`Admin invited, but the email to ${result.email} could not be delivered`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "admin-invitations"] });
      onDone();
    },
  });
  // The step-up dialog renders OUTSIDE this form: React events bubble
  // through portals, so a nested form's submit would also submit this one.
  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          invite.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="invite-admin-email">Email</Label>
          <Input
            id="invite-admin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-admin-name">Name (optional)</Label>
          <Input
            id="invite-admin-name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Admin type</legend>
          {TYPES.filter((type) => type.value !== "super" || canInviteSuper).map((type) => (
            <label key={type.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="invite-admin-type"
                value={type.value}
                checked={adminType === type.value}
                onChange={() => setAdminType(type.value)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{type.label}</span>
                <span className="block text-xs text-muted-foreground">{type.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <InlineFieldErrors error={invite.error} />
        {invite.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage(invite.error, "Could not send the invitation.")}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </form>
      {stepUp.dialog}
    </>
  );
}
