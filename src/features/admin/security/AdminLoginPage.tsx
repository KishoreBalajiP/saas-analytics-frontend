import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { InlineFieldErrors } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";
import { ApiError } from "@/lib/api/client";
import { useAdminSession } from "@/lib/auth/session";

import { AdminAuthLayout } from "./AdminAuthLayout";
import { SecondFactorInput } from "./SecondFactorInput";

/** Where a signed-in admin goes next (enrolment first when required). */
function nextRoute(mfaEnrollmentRequired?: boolean) {
  return mfaEnrollmentRequired ? "/admin/mfa-setup" : "/admin/dashboard";
}

/**
 * Admin sign-in (roadmap 2.2): password, then an authenticator code or a
 * one-time recovery code when MFA is on. A privileged admin without MFA is
 * sent to MFA setup; "Forgot password?" opens the admin reset flow.
 * Rendered inside `AdminSessionProvider` by the `/admin/login` route.
 */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const { status, me, setSession, refetch } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [factor, setFactor] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    if (status === "authenticated") void navigate({ to: nextRoute(me?.mfaEnrollmentRequired) });
  }, [status, me, navigate]);

  const login = useMutation({
    mutationFn: async () => {
      const value = factor.trim();
      return authApi.loginAdmin({
        email: email.trim(),
        password,
        ...(value ? (useRecovery ? { recoveryCode: value } : { mfaToken: value }) : {}),
      });
    },
    onSuccess: async (session) => {
      if (session?.mfaRequired && !session.accessToken) {
        setMfaRequired(true);
        toast.info("Enter your 6-digit authenticator code to continue.");
        return;
      }
      try {
        const profile = await authApi.adminMe();
        setSession(profile);
      } catch {
        await refetch();
      }
      if (typeof session?.recoveryCodesRemaining === "number") {
        toast.warning(
          `Recovery code used. ${session.recoveryCodesRemaining} left; generate new ones in Account security.`,
        );
      } else {
        toast.success("Signed in");
      }
      void navigate({ to: nextRoute(session?.mfaEnrollmentRequired) });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.statusCode === 401 && error.code === "MFA_REQUIRED") {
        setMfaRequired(true);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Sign in failed");
    },
  });

  return (
    <AdminAuthLayout
      title="Sign in to admin portal"
      description="Platform administrators only. Tenant users should use the tenant sign-in."
      footer={
        <a className="underline" href="/login">
          Tenant sign in
        </a>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate();
        }}
      >
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <AppLink
              to="/admin/forgot-password"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Forgot password?
            </AppLink>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {mfaRequired ? (
          <SecondFactorInput
            id="mfa"
            value={factor}
            onChange={setFactor}
            useRecovery={useRecovery}
            onToggleRecovery={setUseRecovery}
          />
        ) : null}
        <InlineFieldErrors error={login.error} />
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : mfaRequired ? "Verify and sign in" : "Sign in"}
        </Button>
      </form>
    </AdminAuthLayout>
  );
}
