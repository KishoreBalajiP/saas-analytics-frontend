import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { TenantSessionProvider, useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/")({
  component: RootEntry,
});

export function RootEntry() {
  return (
    <TenantSessionProvider>
      <RootEntryRedirect />
    </TenantSessionProvider>
  );
}

function RootEntryRedirect() {
  const { status } = useTenantSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "anonymous") void navigate({ to: "/login", replace: true });
    if (status === "authenticated") void navigate({ to: "/dashboard", replace: true });
  }, [status, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <p className="text-sm text-muted-foreground">Restoring your sessionâ€¦</p>
    </div>
  );
}
