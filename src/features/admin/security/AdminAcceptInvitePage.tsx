import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { InlineFieldErrors } from "@/components/common/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptAdminInvitation, previewAdminInvitation } from "@/features/auth/api/adminSecurity";

import { AdminAuthLayout } from "./AdminAuthLayout";
import { errorMessage } from "./errors";
import { NewPasswordFields } from "./NewPasswordFields";
import { passwordsReady } from "./passwords";

/**
 * Admin invitation acceptance (finding adm.09): the emailed link
 * `/admin/accept-invite?token=...` lands here. The invitee chooses a
 * password; privileged roles continue straight to MFA setup.
 */
export function AdminAcceptInvitePage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const invitation = useQuery({
    queryKey: ["admin-invitation", token],
    queryFn: () => previewAdminInvitation(token),
    enabled: token.length > 0,
    retry: false,
  });
  const displayName = name ?? invitation.data?.name ?? "";

  const accept = useMutation({
    mutationFn: () =>
      acceptAdminInvitation({
        token,
        password,
        ...(displayName.trim() ? { name: displayName.trim() } : {}),
      }),
    onSuccess: (session) => {
      if (session?.mfaEnrollmentRequired) {
        toast.success("Password set. Next, set up multi-factor authentication.");
        void navigate({ to: "/admin/mfa-setup" });
        return;
      }
      toast.success("Welcome to the admin portal");
      void navigate({ to: "/admin/dashboard" });
    },
  });

  const invalid = !token || invitation.isError;

  return (
    <AdminAuthLayout
      title="Accept your admin invitation"
      description={
        invitation.data
          ? `${invitation.data.email} · ${invitation.data.adminType} administrator`
          : "Finish setting up your admin portal account."
      }
      footer={<AppLink to="/admin/login">Admin sign in</AppLink>}
    >
      {invalid ? (
        <p className="text-sm text-destructive" role="alert">
          This invitation is invalid, expired or already used. Ask an administrator to send a new
          one.
        </p>
      ) : invitation.isLoading ? (
        <p className="text-sm text-muted-foreground">Checking invitation…</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (passwordsReady(password, confirm)) accept.mutate();
          }}
        >
          {invitation.data?.mfaRequired ? (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                Your role requires multi-factor authentication. After choosing a password you will
                set up an authenticator app.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="invite-name">Your name</Label>
            <Input
              id="invite-name"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <NewPasswordFields
            password={password}
            confirm={confirm}
            onPassword={setPassword}
            onConfirm={setConfirm}
          />
          <InlineFieldErrors error={accept.error} />
          {accept.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage(accept.error, "Could not accept the invitation.")}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={accept.isPending || !passwordsReady(password, confirm)}
          >
            {accept.isPending ? "Setting up…" : "Accept and continue"}
          </Button>
        </form>
      )}
    </AdminAuthLayout>
  );
}
