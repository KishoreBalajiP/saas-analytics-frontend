import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { InlineFieldErrors } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { resetAdminPassword } from "@/features/auth/api/adminSecurity";

import { AdminAuthLayout } from "./AdminAuthLayout";
import { errorMessage } from "./errors";
import { NewPasswordFields } from "./NewPasswordFields";
import { passwordsReady } from "./passwords";

/**
 * Admin password reset page (finding auth.03): the emailed link
 * `/admin/reset-password?token=...` lands here and posts to
 * `/admin-auth/password/reset`. Every admin session ends on success.
 */
export function AdminResetPasswordPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const reset = useMutation({
    mutationFn: () => resetAdminPassword(token, password),
    onSuccess: () => {
      toast.success("Password updated. Sign in with your new password.");
      void navigate({ to: "/admin/login" });
    },
  });

  return (
    <AdminAuthLayout
      title="Choose a new admin password"
      description={token ? "Your reset link is valid for a single use." : undefined}
      footer={<AppLink to="/admin/login">Back to admin sign in</AppLink>}
    >
      {!token ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>This link is missing its reset token. Request a new link to continue.</p>
          <Button variant="outline" className="w-full" asChild>
            <AppLink to="/admin/forgot-password">Request a new link</AppLink>
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (passwordsReady(password, confirm)) reset.mutate();
          }}
        >
          <NewPasswordFields
            password={password}
            confirm={confirm}
            onPassword={setPassword}
            onConfirm={setConfirm}
          />
          <InlineFieldErrors error={reset.error} />
          {reset.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage(reset.error, "Could not reset the password.")}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={reset.isPending || !passwordsReady(password, confirm)}
          >
            {reset.isPending ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </AdminAuthLayout>
  );
}
