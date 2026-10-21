import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AppLink } from "@/components/common/AppLink";
import { InlineFieldErrors } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotAdminPassword } from "@/features/auth/api/adminSecurity";

import { AdminAuthLayout } from "./AdminAuthLayout";
import { errorMessage } from "./errors";

/**
 * Admin "forgot password" (roadmap 2.2). The answer never reveals whether
 * the email belongs to an admin.
 */
export function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const forgot = useMutation({ mutationFn: () => forgotAdminPassword(email.trim()) });

  return (
    <AdminAuthLayout
      title="Reset your admin password"
      description="We will email a single-use reset link to your admin address."
      footer={<AppLink to="/admin/login">Back to admin sign in</AppLink>}
    >
      {forgot.isSuccess ? (
        <p className="text-sm text-muted-foreground" role="status">
          If an admin account exists for {email.trim()}, a reset link is on its way. The link works
          once and expires after a short time.
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            forgot.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <InlineFieldErrors error={forgot.error} />
          {forgot.isError ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage(forgot.error, "Could not send the reset link.")}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={forgot.isPending}>
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AdminAuthLayout>
  );
}
