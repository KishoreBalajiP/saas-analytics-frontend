import { createFileRoute } from "@tanstack/react-router";
import { LEGAL_DOCUMENT_VERSION } from "@/content/legal/version";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

import { AppLink } from "@/components/common/AppLink";
import { PublicAuthLayout } from "@/components/common/PublicAuthLayout";
import { InlineFieldErrors } from "@/components/common/states";
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
import { ApiError } from "@/lib/api/client";

/** Mirrors the backend register schema (lowercase letters, digits, hyphens; 2-50). */
const WORKSPACE_SLUG_PATTERN = "[a-z0-9-]{2,50}";

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
  // onboarding: Terms/Privacy consent.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [registeredTenantSlug, setRegisteredTenantSlug] = useState("");
  const [verificationSent, setVerificationSent] = useState(true);
  const [resendSent, setResendSent] = useState(false);
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
        acceptTerms,
        termsVersion: LEGAL_DOCUMENT_VERSION,
      };
      const normalizedSlug = workspaceSlug.trim();
      if (normalizedSlug) payload.workspaceSlug = normalizedSlug;
      return authApi.registerWorkspace(payload);
    },
    onSuccess: (result) => {
      setIsSubmitted(true);
      setRegisteredTenantSlug(result.tenant.slug);
      setVerificationSent(Boolean(result.verificationSent));
      if (result.verificationSent)
        toast.success("Check your inbox to verify your workspace email.");
      else toast.error("Workspace created, but the verification email could not be delivered.");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "WORKSPACE_SLUG_TAKEN") {
        toast.error(
          "This workspace URL is already taken. Choose another, or sign in if it is your workspace.",
        );
        return;
      }
      // Field-level validation errors render inline under the form.
      if (error instanceof ApiError && error.errors?.length) return;
      toast.error(error instanceof Error ? error.message : "Unable to create your workspace.");
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
    // The token is single-use. Remove it from browser history immediately so
    // refresh/back navigation cannot submit the same token a second time.
    const cleanUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);
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
            {verificationSent
              ? "We sent a confirmation link to your inbox. Complete verification to activate your account."
              : "Your workspace was created, but we could not send the confirmation email. Request a new link below."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground"
            role="status"
          >
            Your workspace is pending email verification. The verification link expires after a
            limited time and can only be used once.
          </div>
          {registeredTenantSlug ? (
            <p className="text-sm">
              Workspace slug: <span className="font-semibold">{registeredTenantSlug}</span>
            </p>
          ) : null}
          <Button asChild className="w-full">
            <AppLink
              to="/login"
              {...(registeredTenantSlug ? { search: { workspace: registeredTenantSlug } } : {})}
            >
              Go to tenant sign in
            </AppLink>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={resendSent}
            onClick={async () => {
              try {
                await authApi.resendVerification(email, registeredTenantSlug);
                setResendSent(true);
                toast.info(
                  "If this account is still awaiting verification, a fresh link has been sent.",
                );
              } catch {
                toast.error("Could not request verification resend. Please try again later.");
              }
            }}
          >
            {resendSent ? "Verification link requested" : "Resend verification link"}
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
            <AppLink to="/login" {...(verifiedSlug ? { search: { workspace: verifiedSlug } } : {})}>
              Continue to sign in
            </AppLink>
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
    <PublicAuthLayout contentClassName="max-w-2xl">
      <Card className="mx-auto w-full max-w-2xl">
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
                minLength={2}
                maxLength={120}
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
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspaceSlug">Workspace URL</Label>
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-md border bg-muted px-2 py-2 text-sm text-muted-foreground">
                  analivo.app/
                </span>
                <Input
                  id="workspaceSlug"
                  value={workspaceSlug}
                  onChange={(e) => setWorkspaceSlug(e.target.value.toLowerCase())}
                  pattern={WORKSPACE_SLUG_PATTERN}
                  maxLength={50}
                  title="2 to 50 lowercase letters, numbers, or hyphens"
                  aria-describedby="workspaceSlug-help"
                  placeholder={workspaceName ? "your-workspace" : undefined}
                  className="min-w-0 flex-1"
                />
              </div>
              <p id="workspaceSlug-help" className="text-xs leading-5 text-muted-foreground">
                2 to 50 lowercase letters, numbers, and hyphens. Leave blank to derive it from the
                workspace name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="flex w-full items-center gap-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((open) => !open)}
                  className="h-10 w-10 shrink-0 rounded-xl border border-border p-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <input
                id="acceptTerms"
                type="checkbox"
                className="mt-1"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
              />
              <Label htmlFor="acceptTerms" className="font-normal leading-6">
                I accept the{" "}
                <AppLink to="/terms" className="text-primary hover:underline">
                  Terms of Service
                </AppLink>{" "}
                and the{" "}
                <AppLink to="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </AppLink>{" "}
              </Label>
            </div>
            <InlineFieldErrors error={mutation.error} />
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
          </form>
        </CardContent>
      </Card>
    </PublicAuthLayout>
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
    <PublicAuthLayout contentClassName="max-w-xl">
      <Card className="w-full max-w-xl">
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
    </PublicAuthLayout>
  );
}
