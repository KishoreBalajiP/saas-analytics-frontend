import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorState, InlineFieldErrors, TableSkeleton } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as authApi from "@/features/auth/api";
import type { Me } from "@/lib/api/types";

/** Name and time zone (PATCH /users/me). */
export function ProfileForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [name, setName] = useState(me.profile?.name ?? "");
  const [timezone, setTimezone] = useState(me.profile?.timezone ?? "UTC");
  const mutation = useMutation({
    mutationFn: () => authApi.updateTenantProfile({ name: name.trim(), timezone: timezone.trim() }),
    onSuccess: (updated) => {
      toast.success("Profile saved");
      onSaved(updated);
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <p className="text-sm">
            <span className="text-muted-foreground">Email:</span>{" "}
            <span className="font-medium">{me.email}</span>
          </p>
          <div className="space-y-1">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-timezone">Time zone</Label>
            <Input
              id="profile-timezone"
              value={timezone}
              maxLength={64}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
          <InlineFieldErrors error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** Password change; the current password is required. */
export function PasswordForm() {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: (result) => {
      toast.success(
        result.sessionsRevoked
          ? `Password changed. ${result.sessionsRevoked} other session(s) signed out.`
          : "Password changed",
      );
      setCurrent("");
      setNew("");
      setConfirm("");
      void queryClient.invalidateQueries({ queryKey: ["profile", "sessions"] });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword.length < 8)
              return setLocalError("New password must be at least 8 characters.");
            if (newPassword !== confirm) return setLocalError("The new passwords do not match.");
            setLocalError(null);
            mutation.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNew(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {localError ? (
            <p role="alert" className="text-sm text-destructive">
              {localError}
            </p>
          ) : null}
          <InlineFieldErrors error={mutation.error} />
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Changing…" : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function when(value: string | null) {
  return value ? new Date(value).toLocaleString() : "—";
}

/** The user's own active sessions, with revoke. */
export function SessionsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["profile", "sessions"], queryFn: authApi.listMySessions });
  const revoke = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeMySession(sessionId),
    onSuccess: () => {
      toast.success("Session signed out");
      void queryClient.invalidateQueries({ queryKey: ["profile", "sessions"] });
    },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Active sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <TableSkeleton rows={2} cols={2} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Sessions" />
        ) : (
          <ul className="space-y-2" aria-label="Sessions">
            {(query.data ?? []).map((s) => (
              <li
                key={s.sessionId}
                className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {s.device ?? s.userAgent ?? "Unknown device"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {s.ip ?? "—"} · last active {when(s.lastUsedAt)}
                  </span>
                </span>
                {s.current ? (
                  <Badge variant="secondary">This device</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(s.sessionId)}
                  >
                    Sign out
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** MFA status (tenant-user MFA ships separately; show the truthful state). */
export function MfaStatusCard({ me }: { me: Me }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {me.mfaEnabled ? (
          <Badge>Enabled</Badge>
        ) : (
          <p className="text-muted-foreground">Not enabled for your account.</p>
        )}
      </CardContent>
    </Card>
  );
}
