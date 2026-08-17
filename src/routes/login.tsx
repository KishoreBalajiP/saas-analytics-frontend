import { Outlet, createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { TenantSessionProvider } from "@/lib/auth/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Analytics Console" },
      {
        name: "description",
        content: "Sign in to your tenant workspace to manage datasets, dashboards and alerts.",
      },
      { property: "og:title", content: "Sign in — Analytics Console" },
      {
        property: "og:description",
        content: "Sign in to your tenant workspace to manage datasets, dashboards and alerts.",
      },
    ],
  }),
  component: LoginLayout,
});

function LoginLayout() {
  return (
    <TenantSessionProvider>
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
        <div className="mb-8 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">
            Analytics Console
          </span>
        </div>
        <Outlet />
        <p className="mt-8 text-xs text-muted-foreground">
          Platform staff?{" "}
          <a className="underline" href="/admin/login">
            Admin sign in
          </a>
        </p>
      </div>
    </TenantSessionProvider>
  );
}
