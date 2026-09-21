import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import * as notificationsApi from "@/features/notifications/api";
import type { Notification, PaginationMeta } from "@/lib/api/types";
import { Permissions, hasPermission } from "@/lib/permissions";
import { useTenantSession } from "@/lib/auth/session";

export function NotificationsView() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.NOTIFICATIONS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.NOTIFICATIONS_UPDATE);
  const canDelete = hasPermission(permissions, Permissions.NOTIFICATIONS_DELETE);
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["notifications", "list", page],
    queryFn: () => notificationsApi.list({ page, limit: 20 }),
    enabled: canView,
  });
  const count = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationsApi.unreadCount,
    enabled: canView,
  });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      toast.success("Notifications marked as read");
      void client.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unable to update notifications"),
  });
  if (!canView) return <ErrorState error={{ statusCode: 403 }} resource="Notifications" />;
  if (query.isLoading) return <TableSkeleton rows={5} cols={3} />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => query.refetch()} resource="Notifications" />
    );
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta as PaginationMeta | undefined;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{count.data?.count ?? 0} unread</p>
        {canUpdate && (
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((notification) => (
            <NotificationCard
              key={notification._id}
              notification={notification}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No notifications"
          description="Alert triggers, report completions, and system messages will appear here."
        />
      )}
      {meta && meta.pages > 1 && (
        <div className="flex justify-between text-sm">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="self-center">
            Page {page} of {meta.pages}
          </span>
          <Button variant="outline" disabled={page >= meta.pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification,
  canUpdate,
  canDelete,
}: {
  notification: Notification;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const client = useQueryClient();
  const read = useMutation({
    mutationFn: () => notificationsApi.markRead(notification._id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const remove = useMutation({
    mutationFn: () => notificationsApi.remove(notification._id),
    onSuccess: () => {
      toast.success("Notification removed");
      void client.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  return (
    <Card className={notification.read ? "" : "border-primary/50 bg-primary/5"}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span>{notification.title}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {new Date(notification.createdAt).toLocaleString()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{notification.body ?? ""}</p>
        <div className="flex shrink-0 gap-1">
          {canUpdate && !notification.read && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => read.mutate()}
              disabled={read.isPending}
            >
              Read
            </Button>
          )}
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Delete ${notification.title}`}
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationPreferences() {
  const { permissions } = useTenantSession();
  const canView = hasPermission(permissions, Permissions.NOTIFICATIONS_VIEW);
  const canUpdate = hasPermission(permissions, Permissions.NOTIFICATIONS_UPDATE);
  const query = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: notificationsApi.getPreferences,
    enabled: canView,
  });
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: notificationsApi.updatePreferences,
    onSuccess: () => {
      toast.success("Preferences saved");
      void client.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
  if (!canView || query.isLoading) return null;
  const preferences = query.data?.preferences ?? {};
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notification preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {["email", "in_app"].map((channel) => (
          <label key={channel} className="flex items-center justify-between text-sm">
            <span>{channel === "in_app" ? "In-app" : "Email"}</span>
            <Switch
              checked={Boolean(preferences[channel])}
              disabled={!canUpdate || mutation.isPending}
              onCheckedChange={(checked) => mutation.mutate({ ...preferences, [channel]: checked })}
            />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
