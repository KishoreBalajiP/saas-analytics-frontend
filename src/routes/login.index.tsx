import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { InlineFieldErrors } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";
import { ApiError } from "@/lib/api/client";
import { storeTenantSlug, useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/login/")({
  component: TenantLoginPage,
});

export function TenantLoginPage() {
  const navigate = useNavigate();
  const { status, setSession, refetch } = useTenantSession();
  const [tenantSlug, setTenantSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");

  useEffect(() => {
    if (status === "authenticated") void navigate({ to: "/dashboard" });
  }, [status, navigate]);

  const login = useMutation({
    mutationFn: async () => {
      const slug = tenantSlug.trim();
      return authApi.loginTenant(slug, {
        email: email.trim(),
        password,
        ...(mfaToken.trim() ? { mfaToken: mfaToken.trim() } : {}),
      });
    },
    onSuccess: async (session) => {
      if (session?.mfaRequired && !session.accessToken) {
        setMfaRequired(true);
        toast.info("Enter your 6-digit authenticator code to continue.");
        return;
      }
      storeTenantSlug(tenantSlug.trim());
      try {
        const me = await authApi.tenantMe();
        setSession(me, tenantSlug.trim());
      } catch {
        await refetch();
      }
      toast.success("Signed in");
      void navigate({ to: "/dashboard" });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 401 && error.code === "MFA_REQUIRED") {
        setMfaRequired(true);
        return;
      }
      if (error instanceof ApiError && error.statusCode === 403 && error.code === "EMAIL_NOT_VERIFIED") {
        setShowResend(true);
        setResendEmail(email.trim());
        toast.error("Email verification required. Would you like to resend the verification link?");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    },
  });

  const handleResend = async () => {
    try {
      await authApi.resendVerification(resendEmail);
      setShowResend(false);
      toast.info("A verification email has been sent. Check your inbox.");
    } catch {
      toast.error("Could not request verification resend. Please try again later.");
      setShowResend(true);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to your workspace</CardTitle>
        <CardDescription>
          Enter your workspace slug together with your account credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tenant">Workspace slug</Label>
            <Input
              id="tenant"
              autoComplete="organization"
              placeholder="acme"
              value={tenantSlug}
              onChange={(event) => setTenantSlug(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Sent as the tenant header on sign-in only.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {showResend ? (
            <div className="space-y-2">
              <Label htmlFor="resendEmail">Email</Label>
              <Input
                id="resendEmail"
                type="email"
                defaultValue={resendEmail}
                readOnly
                className="bg-transparent border-none text-sm text-foreground"
                required
              />
              <Button type="button" size="sm" onClick={handleResend} disabled={login.isPending}>
                {login.isPending ? "Sending…" : "Resend verification"}
              </Button>
            </div>
          ) : null}
          <InlineFieldErrors error={login.error} />
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : mfaRequired ? "Verify and sign in" : "Sign in"}
          </Button>
          <div className="text-center text-sm">
            <AppLink to="/login/forgot" className="text-muted-foreground hover:underline">
              Forgot your password?
            </AppLink>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            New to Analivo?{" "}
            <AppLink to="/register" className="font-medium text-primary hover:underline">
              Create a workspace
            </AppLink>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
