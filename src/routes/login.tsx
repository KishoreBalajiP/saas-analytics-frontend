import { Outlet, createFileRoute } from "@tanstack/react-router";

import { Brand } from "@/components/common/Brand";
import { TenantSessionProvider } from "@/lib/auth/session";
import { PublicFooter } from "@/components/common/PublicFooter";

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
      <div className="min-h-screen bg-background">
        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 sm:px-8">
          <div className="mb-8">
            <Brand />
          </div>
          <div className="w-full max-w-md">
            <Outlet />
          </div>
          <div className="mt-8 w-full max-w-md sm:mt-10">
            <PublicFooter />
          </div>
        </main>
      </div>
    </TenantSessionProvider>
  );
}
