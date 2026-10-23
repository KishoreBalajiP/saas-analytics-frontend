import { createFileRoute, useNavigate } from "@tanstack/react-router";
// onboarding: remembered workspace slug.
import { forgetWorkspace, getRememberedWorkspace } from "@/lib/auth/workspaceSlug";
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

/** A workspace slug may arrive from registration or an accepted invitation. */
const SLUG_PATTERN = /^[a-z0-9-]{2,50}$/;

export const Route = createFileRoute("/login/")({
  validateSearch: (search: Record<string, unknown>): { workspace?: string } => {
    const workspace = search["workspace"];
    return typeof workspace === "string" && SLUG_PATTERN.test(workspace) ? { workspace } : {};
  },
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

  // Prefill the slug handed over by registration or invitation acceptance.
  useEffect(() => {
    const workspace = new URLSearchParams(window.location.search).get("workspace");
    if (workspace && SLUG_PATTERN.test(workspace)) setTenantSlug((current) => current || workspace);
    // onboarding: otherwise prefill the workspace remembered from the last sign-in.
    const remembered = getRememberedWorkspace();
    if (remembered && SLUG_PATTERN.test(remembered))
      setTenantSlug((current) => current || remembered);
  }, []);

  const login = useMutation({
    mutationFn: async () => {
      const slug = tenantSlug.trim();
      return authApi.loginTenant(slug, {
        email: email.trim(),
        password,
        // mfa-tenant: a 16-character entry is a one-time recovery code.
        ...(mfaToken.trim()
          ? mfaToken.trim().length > 6
            ? { recoveryCode: mfaToken.trim() }
            : { mfaToken: mfaToken.trim() }
          : {}),
      });
    },
    onSuccess: async (session) => {
      if (session?.mfaRequired && !session.accessToken) {
        setMfaRequired(true);
        toast.info("Enter your 6-digit authenticator code to continue.");
        return;
      }
      storeTenantSlug(tenantSlug.trim());
      if (session?.mfaEnrollmentRequired) {
        try {
          setSession(await authApi.tenantMe(), tenantSlug.trim());
        } catch {
          await refetch();
        }
        void navigate({ to: "/mfa-setup" });
        return;
      }
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
      toast.error(
        error instanceof ApiError && error.isRateLimited
          ? "Too many sign-in attempts. Please wait and try again."
          : "Sign-in failed. Check your details and try again.",
      );
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
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to continue to your Analivo workspace.</CardDescription>
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
            {tenantSlug ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  forgetWorkspace();
                  setTenantSlug("");
                }}
              >
                Use a different workspace
              </button>
            ) : null}
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
            <div className="relative w-full">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((open) => !open)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Eye aria-hidden="true" className="h-4 w-4" />
                )}
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
          {mfaRequired ? (
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Authenticator code or recovery code</Label>
              <Input
                id="mfa-code"
                autoComplete="one-time-code"
                maxLength={40}
                value={mfaToken}
                onChange={(event) => setMfaToken(event.target.value)}
                required
              />
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
