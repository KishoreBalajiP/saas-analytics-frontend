import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, MailQuestion } from "lucide-react";

import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Join a workspace - Analivo" }] }),
  component: RegistrationPage,
});

export function RegistrationPage() {
  return (
    <AccessPage
      title="Join your Analivo workspace"
      description="Analivo workspaces are invitation-only. Your workspace administrator can invite you with the correct role and access."
    />
  );
}

export function AccessPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8">
        <Brand />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MailQuestion className="h-5 w-5" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            Ask your workspace administrator to send an invitation to your email address. Once
            invited, use the link in that email to complete onboarding.
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
