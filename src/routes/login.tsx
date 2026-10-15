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
      <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <Brand />
          <div className="max-w-xl space-y-6">
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-cyan-300">
              Analytics with a point of view
            </p>
            <h1 className="font-display text-5xl font-semibold leading-tight tracking-tight">
              See the signal. Move with confidence.
            </h1>
            <p className="max-w-md text-lg leading-8 text-slate-300">
              Analivo brings your workspace data together so every team can make faster, clearer
              decisions.
            </p>
            <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
              <span className="rounded-xl border border-white/10 bg-white/5 p-4">Connect data</span>
              <span className="rounded-xl border border-white/10 bg-white/5 p-4">
                Build insight
              </span>
              <span className="rounded-xl border border-white/10 bg-white/5 p-4">Act sooner</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">Trusted workspace access, built for teams.</p>
        </section>
        <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="mb-10 lg:hidden">
            <Brand />
          </div>
          <div className="w-full max-w-md">
            <Outlet />
          </div>
          <div className="mt-10 w-full max-w-md">
            <PublicFooter />
          </div>
        </main>
      </div>
    </TenantSessionProvider>
  );
}
