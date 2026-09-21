import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { InlineFieldErrors } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";

export const Route = createFileRoute("/login/reset")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
    tenant: typeof search["tenant"] === "string" ? search["tenant"] : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, tenant } = Route.useSearch();
  const navigate = useNavigate();
  const [tenantSlug, setTenantSlug] = useState(tenant);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(tenantSlug.trim(), token, password),
    onSuccess: () => {
      toast.success("Password updated. Sign in with your new password.");
      void navigate({ to: "/login" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reset failed"),
  });

  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          {token ? "Your reset token was read from the link." : "This link is missing its token."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!token ? (
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Request a new reset link to continue.</p>
            <Button variant="outline" className="w-full" asChild>
              <AppLink to="/login/forgot">Request a new link</AppLink>
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (mismatch) return;
              reset.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="tenant">Workspace slug</Label>
              <Input
                id="tenant"
                value={tenantSlug}
                onChange={(event) => setTenantSlug(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                aria-invalid={mismatch}
              />
              {mismatch ? (
                <p className="text-sm text-destructive" role="alert">
                  Passwords do not match.
                </p>
              ) : null}
            </div>
            <InlineFieldErrors error={reset.error} />
            <Button type="submit" className="w-full" disabled={reset.isPending || mismatch}>
              {reset.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
