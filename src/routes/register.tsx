import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  MailQuestion,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import * as authApi from "@/features/auth/api";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Join a workspace - Analivo" }] }),
  component: RegistrationPage,
});

export function RegistrationPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationState, setVerificationState] = useState<
    "idle" | "checking" | "verified" | "failed"
  >("idle");
  const [verifiedSlug, setVerifiedSlug] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const verificationStarted = useRef(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Parameters<typeof authApi.registerWorkspace>[0] = {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        workspaceName: workspaceName.trim(),
      };
      const normalizedSlug = workspaceSlug.trim();
      if (normalizedSlug) payload.workspaceSlug = normalizedSlug;
      return authApi.registerWorkspace(payload);
    },
    onSuccess: (result) => {
      setIsSubmitted(true);
      if (result.verificationSent)
        toast.success("Check your inbox to verify your workspace email.");
      else toast.error("Workspace created, but the verification email could not be delivered.");
    },
    onError: (error) => {
      if (error instanceof Error || (typeof error === "object" && error !== null)) {
        if ((error as { code?: string })?.code === "WORKSPACE_SLUG_TAKEN") {
          toast.error(
            'This workspace URL is already taken. If this is your existing workspace, <a href="/login" target="_blank" rel="noopener">sign in</a>.',
          );
          return;
        }
        toast.error(error.message ?? "Unable to create your workspace.");
        return;
      }
      toast.error("Unable to create your workspace.");
    },
  });

  const { mutate: verifyToken } = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (result) => {
      setVerificationState("verified");
      setVerifiedSlug(result.tenant.slug);
      setVerificationMessage("Email verified. Your workspace is active.");
      toast.success("Email verified. Your workspace is active.");
    },
    onError: (error) => {
      setVerificationState("failed");
      setVerificationMessage(
        error instanceof Error ? error.message : "This verification link is invalid or expired.",
      );
      toast.error(
        error instanceof Error ? error.message : "This verification link is invalid or expired.",
      );
    },
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token || verificationStarted.current) return;
    verificationStarted.current = true;
    setVerificationState("checking");
    verifyToken(token);
  }, [verifyToken]);

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailQuestion className="h-5 w-5" />
          </div>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to your inbox. Complete verification to activate your
            account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            Your workspace is pending email verification. The link expires in 15 minutes and can
            only be used once.
          </div>
          <Button asChild className="w-full">
            <AppLink to="/login">Go to tenant sign in</AppLink>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (verificationState !== "idle") {
    const title =
      verificationState === "checking"
        ? "Verifying your email"
        : verificationState === "verified"
          ? "Workspace activated"
          : "Verification could not be completed";
    const description =
      verificationState === "checking"
        ? "We are verifying the link and preparing your workspace."
        : verificationState === "verified"
          ? "Your owner account is ready. Sign in to continue setup."
          : "The link may have expired, already been used, or the workspace may be restricted.";
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {verificationState === "checking" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : verificationState === "verified" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground"
            role="status"
          >
            {verificationState === "verified"
              ? `Email verified. Your workspace slug is ${verifiedSlug}.`
              : verificationState === "failed"
                ? verificationMessage
                : "Please keep this page open while verification completes."}
          </div>
          {verificationState === "verified" ? (
            <p className="text-sm">
              Workspace slug: <span className="font-semibold">{verifiedSlug}</span>
            </p>
          ) : null}
          <Button asChild className="w-full">
            <AppLink to="/login">Continue to sign in</AppLink>
          </Button>
          {verificationState === "failed" ? (
            <Button asChild variant="outline" className="w-full">
              <AppLink to="/login">Go to sign in</AppLink>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <Card className="w-full max-w-xl mx-auto">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailQuestion className="h-5 w-5" />
          </div>
          <CardTitle>Create your Analivo workspace</CardTitle>
          <CardDescription>
            Set up your workspace, confirm your email, and start connecting data in minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input
                id="workspaceName"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceSlug">Workspace URL</Label>
              <div className="flex items-center gap-2">
                <span className="rounded-md border bg-muted px-2 py-1 text-sm text-muted-foreground">
                  analivo.app/
                </span>
                <Input
                  id="workspaceSlug"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value)}
                  placeholder={workspaceName ? "your-workspace" : undefined}
                  className="flex-1 rounded-xl border border-border py-4 px-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
                />
                <p className="text-xs text-muted-foreground">
                  slug can only contain lowercase letters, numbers, and hyphens
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="flex items-center gap-3 w-full">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="flex-1 rounded-xl border border-border py-4 px-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 transition-colors"
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
            <Button
              type="submit"
              className="w-full rounded-xl py-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating workspace…" : "Create workspace"}
            </Button>
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <Button asChild variant="ghost" className="px-0">
                <AppLink to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to sign in
                </AppLink>
              </Button>
              <Button asChild variant="link" className="px-0">
                <AppLink to="/request-access">Request access instead</AppLink>
              </Button>
            </div>
            {isSubmitted === false && (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    await authApi.resendVerification(email);
                    toast.info(
                      "If an account exists for that email, a verification link has been sent. Check your inbox.",
                    );
                  } catch {
                    toast.error("Could not resend verification email. Please try again later.");
                  }
                }}
                className="mt-2 w-full rounded-sm py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
              >
                Resend verification link
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function AccessPage({
  title,
  description,
  message = "Your workspace is created and awaiting email verification. Once verified, you'll be able to sign in and complete onboarding.",
}: {
  title: string;
  description: string;
  message?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            {message}
          </div>
          <Button asChild className="w-full">
            <AppLink to="/login">Go to tenant sign in</AppLink>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <AppLink to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Analivo
            </AppLink>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
