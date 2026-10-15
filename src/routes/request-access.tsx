import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { AppLink } from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as authApi from "@/features/auth/api";

export const Route = createFileRoute("/request-access")({
  head: () => ({ meta: [{ title: "Request workspace access - Analivo" }] }),
  component: AccessRequestPage,
});

function AccessRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      authApi.submitAccessRequest({
        name: name.trim(),
        email: email.trim(),
        workspaceName: workspaceName.trim(),
        reason: reason.trim(),
      }),
  });

  if (mutation.isSuccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 />
            </div>
            <CardTitle>Request submitted</CardTitle>
            <CardDescription>
              Your request is pending Platform Admin review. Access has not been granted and an
              invitation is not sent automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                If the request is approved, the administrator can send an invitation to{" "}
                {email.trim()}. Use that invitation to accept access and finish onboarding.
              </p>
            </div>
            <p className="rounded-lg border p-4 text-sm">
              Reference: <span className="font-mono font-semibold">{mutation.data.reference}</span>
            </p>
            <Button asChild className="w-full">
              <AppLink to="/login">Return to sign in</AppLink>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = [name.trim(), email.trim(), workspaceName.trim()];
    if (values.some((value) => !value)) {
      setValidationError("Enter your name, work email, and workspace name.");
      return;
    }
    setValidationError("");
    mutation.mutate();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Request workspace access</CardTitle>
          <CardDescription>
            Submit a request if you have not received an invitation. A Platform Admin reviews it
            before deciding whether to send an invitation; submitting this form does not grant
            access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="request-name">Full name</Label>
              <Input
                id="request-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-email">Work email</Label>
              <Input
                id="request-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-workspace">Workspace name</Label>
              <Input
                id="request-workspace"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="request-reason">
                What do you need access for?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="request-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={4}
              />
            </div>
            {validationError || mutation.error ? (
              <p role="alert" className="text-sm text-destructive">
                {validationError ||
                  (mutation.error instanceof Error
                    ? mutation.error.message
                    : "Unable to submit the request. Try again shortly.")}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Submit access request"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already received an invitation?{" "}
              <AppLink to="/invite/accept" className="text-primary hover:underline">
                Accept your invitation
              </AppLink>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
