import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
  const mutation = useMutation({
    mutationFn: () =>
      authApi.submitAccessRequest({
        name: name.trim(),
        email: email.trim(),
        workspaceName: workspaceName.trim(),
        reason: reason.trim(),
      }),
  });

  if (mutation.isSuccess)
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 />
            </div>
            <CardTitle>Request received</CardTitle>
            <CardDescription>
              We’ll review your request and contact you at {email.trim()} if access can be
              provisioned.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg border bg-muted/40 p-4 text-sm">
              Reference: <span className="font-mono font-semibold">{mutation.data.reference}</span>
            </p>
            <Button asChild className="w-full">
              <AppLink to="/login">Return to sign in</AppLink>
            </Button>
          </CardContent>
        </Card>
      </main>
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Request workspace access</CardTitle>
          <CardDescription>
            Tell us where you work. A Platform Admin will review the request before an invitation is
            sent.
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
            {mutation.error ? (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : "Unable to submit the request."}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Submit request"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already invited?{" "}
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
