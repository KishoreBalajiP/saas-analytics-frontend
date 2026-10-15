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
import { Eye, EyeOff } from "lucide-react";
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
  const [resendPending, setResendPending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      if (
        error instanceof ApiError &&
        error.statusCode === 403 &&
        error.code === "EMAIL_NOT_VERIFIED"
      ) {
        setShowResend(true);
        setResendEmail(email.trim());
        toast.error("Email verification required. Would you like to resend the verification link?");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    },
  });

  const handleResend = async () => {
    setResendPending(true);
    try {
      await authApi.resendVerification(resendEmail, tenantSlug.trim());
      setResendSent(true);
      toast.info("If the account is awaiting verification, a new link will be sent.");
    } catch {
      toast.error("Could not request verification resend. Please try again later.");
    } finally {
      setResendPending(false);
    }
  };

  return (
    <Card className="w-full border-border/80 shadow-lifted">
      <CardHeader>
        <CardTitle>Sign in to your workspace</CardTitle>
        <CardDescription>
          Enter your workspace slug together with your account credentials.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
              Sent as the tenant header on sign-in only. If you don't know your slug,{" "}
              <a href="/register" className="font-medium text-primary hover:underline">
                create a workspace
              </a>{" "}
              or contact your administrator.
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
            <div className="flex items-center gap-3 w-full">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="flex-1 rounded-xl border border-border py-4 px-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((open) => !open)}
                className="rounded-xl border border-border py-3 px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {showResend ? (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
              role="status"
            >
              <p className="font-medium">Email verification required</p>
              <p className="mt-1 text-amber-900/80">
                {resendSent
                  ? "Check your inbox for a fresh link, if this account is still awaiting verification."
                  : "Your credentials are valid, but this account must be verified before it can sign in."}
              </p>
              {!resendSent ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleResend}
                  disabled={resendPending}
                >
                  {resendPending ? "Requesting…" : "Resend verification link"}
                </Button>
              ) : null}
            </div>
          ) : null}
          <InlineFieldErrors error={login.error} />
          <Button
            type="submit"
            className="w-full rounded-xl py-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
            disabled={login.isPending}
          >
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
              Get started
            </AppLink>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Need access to an existing workspace?{" "}
            <AppLink to="/request-access" className="font-medium text-primary hover:underline">
              Request access
            </AppLink>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
