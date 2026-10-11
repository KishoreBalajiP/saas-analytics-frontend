import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Brand } from "@/components/common/Brand";
import { TenantSessionProvider } from "@/lib/auth/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in - Analivo" },
      { name: "description", content: "Sign in to your Analivo tenant workspace." },
      { property: "og:title", content: "Sign in - Analivo" },
      { property: "og:description", content: "Sign in to your Analivo tenant workspace." },
    ],
  }),
  component: LoginLayout,
});

function LoginLayout() {
  return (
    <TenantSessionProvider>
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
        <div className="mb-8">
          <Brand />
        </div>
        <Outlet />
      </div>
    </TenantSessionProvider>
  );
}
