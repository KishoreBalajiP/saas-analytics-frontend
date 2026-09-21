import { AlertTriangle, Ban, Clock, Inbox, Lock, RefreshCw, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-2">
          {Array.from({ length: cols }).map((__, colIndex) => (
            <Skeleton key={colIndex} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mb-3 text-muted-foreground">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>Coming soon — backend not implemented yet.</p>
        {description ? <p>{description}</p> : null}
        <Button variant="outline" size="sm" disabled>
          Unavailable
        </Button>
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  loginTo?: "/login" | "/admin/login";
  resource?: string;
}

/** Distinguishes 401 / 403 / 404 / 422 / 429 / 500 / 501 per the UX spec. */
export function ErrorState({ error, onRetry, loginTo, resource }: ErrorStateProps) {
  const api = error instanceof ApiError ? error : null;
  const status =
    api?.statusCode ??
    (typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode ?? 0)
      : 0);

  if (status === 501) {
    return <ComingSoon title={resource ? `${resource}` : "Not implemented"} />;
  }

  let icon: ReactNode = <AlertTriangle className="h-5 w-5 text-destructive" />;
  let title = "Something went wrong";
  let message = api?.message ?? (error instanceof Error ? error.message : "Unexpected error");

  if (status === 401) {
    icon = <Lock className="h-5 w-5 text-warning" />;
    title = "Session expired";
    message = "Please sign in again to continue.";
  } else if (status === 403) {
    icon = <ShieldAlert className="h-5 w-5 text-warning" />;
    title = "Permission required";
    message = api?.message ?? "Your account does not have access to this resource.";
  } else if (status === 404) {
    icon = <Ban className="h-5 w-5 text-muted-foreground" />;
    title = `${resource ?? "Resource"} not found`;
  } else if (status === 422) {
    title = "Validation failed";
  } else if (status === 429) {
    icon = <Clock className="h-5 w-5 text-warning" />;
    title = "Rate limited";
    message = "Too many requests. Wait a moment and retry.";
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          {api?.errors?.length ? (
            <ul className="mt-3 space-y-1 text-sm text-destructive">
              {api.errors.map((fieldError) => (
                <li key={`${fieldError.field}-${fieldError.message}`}>
                  <span className="font-medium">{fieldError.field}</span>: {fieldError.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex gap-2">
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry
              </Button>
            ) : null}
            {status === 401 && loginTo ? (
              <Button size="sm" asChild>
                <AppLink to={loginTo}>Sign in</AppLink>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InlineFieldErrors({ error }: { error: unknown }) {
  const api = error instanceof ApiError ? error : null;
  if (!api?.errors?.length) return null;
  return (
    <ul className="space-y-1 text-sm text-destructive" role="alert">
      {api.errors.map((fieldError) => (
        <li key={`${fieldError.field}-${fieldError.message}`}>
          {fieldError.field}: {fieldError.message}
        </li>
      ))}
    </ul>
  );
}
