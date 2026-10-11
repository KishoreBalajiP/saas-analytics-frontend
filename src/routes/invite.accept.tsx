import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";

export const Route = createFileRoute("/invite/accept")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? search["token"] : "",
  }),
  head: () => ({ meta: [{ title: "Accept invitation - Analivo" }] }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const invitation = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => authApi.previewInvitation(token),
    enabled: token.length > 0,
  });
  const accept = useMutation({
    mutationFn: () => authApi.acceptInvitation(token, name.trim(), password),
    onSuccess: () => {
      toast.success("Invitation accepted. Sign in to continue.");
      void navigate({ to: "/login" });
    },
  });
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Brand />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Accept your Analivo invitation</CardTitle>
            <CardDescription>
              {invitation.data
                ? `${invitation.data.tenant.name} · ${invitation.data.invitedEmail} · ${invitation.data.role}`
                : "Complete your workspace setup."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token || invitation.isError ? (
              <p className="text-sm text-destructive">
                This invitation is invalid, expired, or no longer available.
              </p>
            ) : invitation.isLoading ? (
              <p className="text-sm text-muted-foreground">Checking invitation…</p>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!mismatch) accept.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Your name</Label>
                  <Input
                    id="invite-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-password">Password</Label>
                  <Input
                    id="invite-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-confirm">Confirm password</Label>
                  <Input
                    id="invite-confirm"
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    required
                    aria-invalid={mismatch}
                  />
                  {mismatch && <p className="text-sm text-destructive">Passwords do not match.</p>}
                </div>
                {accept.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {accept.error instanceof Error
                      ? accept.error.message
                      : "Unable to accept invitation"}
                  </p>
                )}
                <Button className="w-full" type="submit" disabled={accept.isPending || mismatch}>
                  {accept.isPending ? "Activating…" : "Accept invitation"}
                </Button>
              </form>
            )}
            <Button className="mt-4 w-full" variant="ghost" asChild>
              <AppLink to="/login">Go to sign in</AppLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
