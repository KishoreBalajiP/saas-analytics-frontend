import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/lib/api/auth";

export const Route = createFileRoute("/login/forgot")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const forgot = useMutation({
    mutationFn: () => authApi.forgotPassword(tenantSlug.trim(), email.trim()),
    // The backend is intentionally opaque, so always show the same result.
    onSettled: () => setSent(true),
  });

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          We'll email a reset link if an account exists for that address.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If the account exists, a reset link is on its way. The link contains a one-time token
              and expires shortly.
            </p>
            <Button variant="outline" className="w-full" asChild>
              <AppLink to="/login">Back to sign in</AppLink>
            </Button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              forgot.mutate();
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending ? "Sending…" : "Send reset link"}
            </Button>
            <div className="text-center text-sm">
              <AppLink to="/login" className="text-muted-foreground hover:underline">
                Back to sign in
              </AppLink>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
