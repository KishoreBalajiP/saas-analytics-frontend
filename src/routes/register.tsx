import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MailQuestion } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [verificationState, setVerificationState] = useState<
    "idle" | "checking" | "verified" | "failed"
  >("idle");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verifiedSlug, setVerifiedSlug] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const verificationStarted = useRef(false);

  const slugPreview = useMemo(() => {
    const raw = (workspaceSlug || workspaceName).trim();
    return (
      raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "workspace"
    );
  }, [workspaceName, workspaceSlug]);

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
      setVerificationSent(result.verificationSent);
      if (result.verificationSent)
        toast.success("Check your inbox to verify your workspace email.");
      else toast.error("Workspace created, but the verification email could not be delivered.");
    },
    onError: (error) => {
      if (error instanceof Error) {
        // Distinguish workspace-slug-taken from a generic conflict, so the
        // user is guided to sign in rather than seeing a dead-end conflict.
        if ((error as { code?: string })?.code === 'WORKSPACE_SLUG_TAKEN') {
          toast.error(
            'This workspace URL is already taken. If this is your existing workspace, <a href="/login" target="_blank" rel="noopener">sign in</a>.'
          );
          return;
        }
        toast.error(error.message ?? 'Unable to create your workspace.');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Unable to create your workspace.');
    },
  });

  const { mutate: verifyToken } = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: (result) => {
      setVerificationState("verified");
      setVerifiedSlug(result.tenant.slug);
      setVerificationMessage(`Email verified. Your workspace slug is ${result.tenant.slug}.`);
    },
    onError: (error) => {
      setVerificationState("failed");
      setVerificationMessage(
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
      <StatusPage
        title={title}
        description={description}
        message={
          verificationState === "verified"
            ? verificationMessage
            : verificationState === "failed"
              ? verificationMessage
              : "Please keep this page open while verification completes."
        }
        actionLabel={verificationState === "verified" ? "Continue to sign in" : "Back to Analivo"}
        actionTo={verificationState === "verified" ? "/login" : "/"}
        showLogin={verificationState === "failed"}
        slug={verifiedSlug}
        state={verificationState}
      />
    );
  }

  if (isSubmitted) {
    return (
      <AccessPage
        title="Verify your email"
        description={
          verificationSent
            ? "We sent a confirmation link to your inbox. Complete verification to activate your account."
            : "Your workspace was created, but the confirmation email could not be delivered. Contact support to request a new link."
        }
        message={
          verificationSent
            ? "Your workspace is pending email verification. The link expires in 15 minutes and can only be used once."
            : "The account is not active yet. We have not signed you in."
        }
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailQuestion className="h-5 w-5" />
          </div>
          <CardTitle>Create your Analivo workspace</CardTitle>
          <CardDescription>
            Set up your workspace, confirm your email, and start connecting data in minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
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
                  placeholder={workspaceName ? slugPreview : "your-workspace"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
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
            {isSubmitted === false && verificationSent === false && (
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  try {
                    await authApi.resendVerification(email);
                    toast.info("If an account exists for that email, a verification link has been sent. Check your inbox.");
                  } catch {
                    toast.error("Could not resend verification email. Please try again later.");
                  }
                }}
                className="mt-2 w-full"
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
  message = "Your workspace is created and awaiting email verification. Once verified, you’ll be able to sign in and complete onboarding.",
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

function StatusPage({
  title,
  description,
  message,
  actionLabel,
  actionTo,
  showLogin,
  slug,
  state,
}: {
  title: string;
  description: string;
  message: string;
  actionLabel: string;
  actionTo: "/" | "/login";
  showLogin: boolean;
  slug: string;
  state: "checking" | "verified" | "failed";
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {state === "checking" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : state === "verified" ? (
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
            {message}
          </div>
          {slug ? (
            <p className="text-sm">
              Workspace slug: <span className="font-semibold">{slug}</span>
            </p>
          ) : null}
          <Button asChild className="w-full">
            <AppLink to={actionTo}>{actionLabel}</AppLink>
          </Button>
          {showLogin ? (
            <Button asChild variant="outline" className="w-full">
              <AppLink to="/login">Go to sign in</AppLink>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
