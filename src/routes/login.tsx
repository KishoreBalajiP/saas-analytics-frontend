import { Outlet, createFileRoute } from "@tanstack/react-router";

import { PublicAuthLayout } from "@/components/common/PublicAuthLayout";
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
      <PublicAuthLayout contentClassName="max-w-xl">
        <Outlet />
      </PublicAuthLayout>
    </TenantSessionProvider>
  );
}
