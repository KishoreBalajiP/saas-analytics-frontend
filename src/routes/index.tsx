import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Check,
  Database,
  FileDown,
  LockKeyhole,
  Menu,
  PanelsTopLeft,
  ShieldCheck,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { useState } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { Button } from "@/components/ui/button";
import { TenantSessionProvider, useTenantSession } from "@/lib/auth/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Analivo - Analytics Platform" },
      {
        name: "description",
        content:
          "Bring your business data together, explore meaningful analytics, and share insights through interactive dashboards and reports.",
      },
    ],
  }),
  component: HomePage,
});

export function HomePage() {
  return (
    <TenantSessionProvider>
      <PublicHome />
    </TenantSessionProvider>
  );
}

function PublicHome() {
  const { status } = useTenantSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const sources = [
    { icon: Database, name: "CSV" },
    { icon: Table2, name: "XLSX" },
    { icon: Database, name: "MongoDB" },
    { icon: BellRing, name: "Webhooks" },
  ];
  const primaryPath = status === "authenticated" ? "/dashboard" : "/request-access";
  const primaryLabel = status === "authenticated" ? "Open dashboard" : "Get started";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <nav
            className={`${menuOpen ? "absolute left-0 right-0 top-[4.5rem] flex" : "hidden"} flex-col gap-5 border-b border-border bg-background px-5 py-5 md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0`}
            aria-label="Primary navigation"
          >
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </a>
            <a href="#data-sources" className="text-sm text-muted-foreground hover:text-foreground">
              Data sources
            </a>
            <a href="#security" className="text-sm text-muted-foreground hover:text-foreground">
              Security
            </a>
            <AppLink to="/login" className="text-sm font-medium text-foreground hover:text-primary">
              Sign in
            </AppLink>
            <Button asChild size="sm">
              <AppLink to={primaryPath}>
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </AppLink>
            </Button>
          </nav>
        </div>
      </header>
      <main>
        <section className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-20 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-28">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Clarity for every decision
            </div>
            <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Turn your data into <span className="text-primary">decisions.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              Bring your business data together, explore meaningful analytics, and share insights
              through interactive dashboards and reports.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <AppLink to={primaryPath}>
                  {primaryLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </AppLink>
              </Button>
              <Button asChild size="lg" variant="outline">
                <AppLink to="/login">Sign in</AppLink>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Invitation-only workspaces keep access intentional and secure.
            </p>
          </div>
          <DashboardPreview />
        </section>
        <section id="features" className="border-y border-border/70 bg-card/50 px-5 py-20 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <SectionIntro
              eyebrow="One place to see the signal"
              title="From raw rows to confident action."
              description="Analivo gives teams a focused workspace for connecting data, exploring trends, and sharing the view that matters."
            />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Feature
                icon={PanelsTopLeft}
                title="Dashboards"
                text="Compose live KPI cards and widgets into focused dashboards."
              />
              <Feature
                icon={BarChart3}
                title="Analytics"
                text="Query datasets with filters, metrics, grouping, and history."
              />
              <Feature
                icon={FileDown}
                title="Reports"
                text="Build reports, export results, and schedule recurring runs."
              />
              <Feature
                icon={BellRing}
                title="Alerts"
                text="Monitor thresholds and notify authorized workspace users."
              />
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <SectionIntro
            eyebrow="How it works"
            title="A clear path from data to insight."
            description="Keep the workflow simple: connect what you have, understand what it says, then share it with the right people."
          />
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              ["01", "Connect or import", "Bring in CSV, XLSX, MongoDB, or signed webhook data."],
              ["02", "Explore", "Query rows with the analytics builder and inspect results."],
              ["03", "Compose", "Turn useful metrics into dashboards and reports."],
              [
                "04",
                "Share safely",
                "Use alerts, exports, and tenant-scoped access to distribute insight.",
              ],
            ].map(([number, title, text]) => (
              <div key={number} className="relative border-l-2 border-primary/30 pl-5">
                <span className="text-sm font-bold text-primary">{number}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="data-sources" className="bg-slate-950 px-5 py-20 text-white lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-300">
                Data sources
              </p>
              <h2 className="mt-4 text-4xl font-bold tracking-tight">
                Work with the data you already have.
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-slate-300">
                Use the connectors currently supported by the platform, with ingestion status and
                field mapping visible inside the tenant workspace.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sources.map(({ icon: Icon, name }) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <Icon className="h-6 w-6 text-teal-300" />
                  <p className="mt-6 font-semibold">{name}</p>
                  <p className="mt-1 text-xs text-slate-400">Supported connector</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="security" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <SectionIntro
            eyebrow="Security and access"
            title="Insight with boundaries built in."
            description="Analivo keeps workspace access explicit so teams can move quickly without losing control of who can see or change data."
          />
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <SecurityItem
              icon={LockKeyhole}
              title="Tenant isolation"
              text="Tenant context is derived from authenticated sessions and enforced across workspace data."
            />
            <SecurityItem
              icon={ShieldCheck}
              title="Role-based access"
              text="Permissions govern analytics, connectors, dashboards, reports, alerts, and exports."
            />
            <SecurityItem
              icon={Check}
              title="Secure account flows"
              text="Protected sessions and password recovery support safer access. TOTP MFA is available for platform administrators; tenant-user MFA is not yet available."
            />
          </div>
        </section>
        <section className="mx-5 mb-20 rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-10 lg:mx-auto lg:max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Make every report more useful.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
            Analivo is ready when your workspace administrator sends an invitation.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" variant="secondary">
              <AppLink to={primaryPath}>
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </AppLink>
            </Button>
          </div>
        </section>
      </main>
      <footer className="border-t border-border px-5 py-10 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <Brand compact />
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
              A focused analytics workspace for turning business data into decisions.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Product</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground">
                Features
              </a>
              <a href="#data-sources" className="hover:text-foreground">
                Data sources
              </a>
              <a href="#security" className="hover:text-foreground">
                Security
              </a>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Workspace</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <AppLink to="/login" className="hover:text-foreground">
                Sign in
              </AppLink>
              <AppLink to="/request-access" className="hover:text-foreground">
                Request access
              </AppLink>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-border pt-5 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Analivo. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <p className="mt-4 leading-7 text-muted-foreground">{description}</p>
    </div>
  );
}
function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof BarChart3;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
function SecurityItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof LockKeyhole;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-6">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}
function DashboardPreview() {
  return (
    <div className="relative rounded-3xl border border-border bg-card p-3 shadow-lifted">
      <div className="rounded-2xl bg-slate-950 p-4 text-white sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Workspace overview</p>
            <p className="mt-1 text-lg font-semibold">Performance snapshot</p>
          </div>
          <span className="rounded-lg bg-white/10 px-2 py-1 text-[10px] text-teal-200">
            Live view
          </span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[10px] text-slate-400">Revenue</p>
            <p className="mt-2 text-lg font-semibold">$84.2k</p>
            <p className="mt-1 text-[10px] text-teal-300">+12.8%</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[10px] text-slate-400">Orders</p>
            <p className="mt-2 text-lg font-semibold">2,481</p>
            <p className="mt-1 text-[10px] text-teal-300">+8.4%</p>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[10px] text-slate-400">Conversion</p>
            <p className="mt-2 text-lg font-semibold">4.82%</p>
            <p className="mt-1 text-[10px] text-amber-300">+1.2%</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_.7fr]">
          <div className="rounded-xl bg-white/10 p-3">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Trend</span>
              <span>Last 30 days</span>
            </div>
            <div className="mt-4 flex h-28 items-end gap-1.5">
              {[30, 44, 38, 58, 48, 74, 68, 82, 64, 92, 78, 100].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t bg-teal-300/80"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white/10 p-3">
            <p className="text-[10px] text-slate-400">Top segments</p>
            <div className="mt-4 space-y-3">
              {[
                ["Enterprise", "48%"],
                ["Growth", "31%"],
                ["Starter", "21%"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{label}</span>
                  <span className="font-semibold text-teal-200">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
