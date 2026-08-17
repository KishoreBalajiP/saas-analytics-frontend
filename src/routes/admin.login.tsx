import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield } from "lucide-react";

import { InlineFieldErrors } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { AdminSessionProvider, useAdminSession } from "@/lib/auth/session";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Sign In — Analytics Console" },
      { name: "description", content: "Sign in to the admin portal." },
    ],
  }),
  component: () => (
    <AdminSessionProvider>
      <AdminLoginPage />
    </AdminSessionProvider>
  ),
});

function AdminLoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <span className="font-display text-lg font-semibold tracking-tight">Admin Portal</span>
      </div>
      <AdminLoginForm />
      <p className="mt-8 text-xs text-muted-foreground">
        <a className="underline" href="/login">
          Tenant sign in
        </a>
      </p>
    </div>
  );
}

function AdminLoginForm() {
  const navigate = useNavigate();
  const { status, setSession, refetch } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    if (status === "authenticated") void navigate({ to: "/admin/dashboard" });
  }, [status, navigate]);

  const login = useMutation({
    mutationFn: async () =>
      authApi.loginAdmin({
        email: email.trim(),
        password,
        ...(mfaToken.trim() ? { mfaToken: mfaToken.trim() } : {}),
      }),
    onSuccess: async (session) => {
      if (session?.mfaRequired && !session.accessToken) {
        setMfaRequired(true);
        toast.info("Enter your 6-digit authenticator code to continue.");
        return;
      }
      try {
        const me = await authApi.adminMe();
        setSession(me);
      } catch {
        await refetch();
      }
      toast.success("Signed in");
      void navigate({ to: "/admin/dashboard" });
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Sign in to admin portal</CardTitle>
        <CardDescription>
          Platform administrators only. Tenant users should use the tenant sign-in.
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
          {mfaRequired ? (
            <div className="space-y-2">
              <Label htmlFor="mfa">Authenticator code</Label>
              <Input
                id="mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaToken}
                onChange={(event) => setMfaToken(event.target.value)}
                required
              />
            </div>
          ) : null}
          <InlineFieldErrors error={login.error} />
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : mfaRequired ? "Verify and sign in" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
