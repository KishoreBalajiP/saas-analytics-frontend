import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  CreditCard,
  Database,
  FileText,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  MonitorSmartphone,
  Settings,
  Sigma,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import * as notificationsApi from "@/features/notifications/api";
import { useTenantSession } from "@/lib/auth/session";
import { forgetWorkspace } from "@/lib/auth/workspaceSlug";
// support: read-only support session banner (roadmap 2.3).
import { SupportSessionBanner } from "@/features/support/components/SupportSessionBanner";
import { consumeSupportExit } from "@/lib/auth/supportSession";
import { cn } from "@/lib/utils";

const NAV = [
  {
    to: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Home dashboard with setup status",
  },
  {
    to: "/datasets",
    label: "Datasets",
    icon: Database,
    description: "Connect and manage data sources",
  },
  // ai-ask: natural-language questions (the page shows a fallback when AI is off).
  { to: "/ask", label: "Ask", icon: MessageSquare, description: "Ask a question about your data" },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    description: "Query and explore your data",
  },
  // ai-catalogue: metric catalogue.
  { to: "/metrics", label: "Metrics", icon: Sigma, description: "Define business metrics" },
  {
    to: "/dashboards",
    label: "Dashboards",
    icon: Activity,
    description: "Visualize metrics in real time",
  },
  { to: "/reports", label: "Reports", icon: FileText, description: "Schedule and export reports" },
  {
    to: "/alerts",
    label: "Alerts",
    icon: ShieldAlert,
    description: "Monitor conditions and get notified",
  },
  { to: "/notifications", label: "Notifications", icon: Bell, description: "View notifications" },
  { to: "/api-keys", label: "API keys", icon: Key, description: "Manage API access keys" },
  {
    to: "/embed",
    label: "Embed",
    icon: MonitorSmartphone,
    description: "Embed analytics externally",
  },
  {
    to: "/billing",
    label: "Subscription",
    icon: CreditCard,
    description: "Manage subscription and billing",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Configure workspace preferences",
  },
];

const dismissedMfaRecommendations = new Set<string>();

export function TenantShell({ children }: { children: ReactNode }) {
  const { status, me, tenantSlug, signOut } = useTenantSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mfaRecommendationDismissed, setMfaRecommendationDismissed] = useState(true);
  const userId = me?.id ?? me?._id ?? null;
  const mfaRecommendationKey = userId ? `analivo:mfa-recommendation-dismissed:${userId}` : null;

  // mfa-tenant: an enrolment-only session may only set up MFA.
  const mustEnrolMfa = status === "authenticated" && Boolean(me?.mfa?.enrollmentRequired);
  useEffect(() => {
    // support: an ended support session returns the operator to the console.
    if (status === "anonymous")
      void navigate({ to: consumeSupportExit() ? "/admin/support" : "/login" });
    else if (mustEnrolMfa) void navigate({ to: "/mfa-setup" });
  }, [status, mustEnrolMfa, navigate]);

  useEffect(() => {
    if (!mfaRecommendationKey) return;
    try {
      setMfaRecommendationDismissed(
        dismissedMfaRecommendations.has(mfaRecommendationKey) ||
          window.localStorage.getItem(mfaRecommendationKey) === "true",
      );
    } catch {
      setMfaRecommendationDismissed(dismissedMfaRecommendations.has(mfaRecommendationKey));
    }
  }, [mfaRecommendationKey]);

  const showMfaRecommendation =
    status === "authenticated" &&
    !mustEnrolMfa &&
    !me?.mfa?.enabled &&
    !me?.mfa?.required &&
    !mfaRecommendationDismissed;

  const dismissMfaRecommendation = () => {
    if (mfaRecommendationKey) {
      dismissedMfaRecommendations.add(mfaRecommendationKey);
      try {
        window.localStorage.setItem(mfaRecommendationKey, "true");
      } catch {
        // Keep the dismissal for this browser session if storage is unavailable.
      }
    }
    setMfaRecommendationDismissed(true);
  };

  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationsApi.unreadCount,
    enabled: status === "authenticated" && !mustEnrolMfa,
    refetchInterval: 60_000,
    retry: false,
  });

  if (status !== "authenticated" || mustEnrolMfa) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <p className="sr-only" role="status">
            Loading workspace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-transform lg:static lg:h-full lg:shrink-0 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <Brand compact />
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <AppLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex min-w-0 items-start gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate whitespace-nowrap">{item.label}</span>
                  {item.description && (
                    <span className="mt-0.5 block truncate whitespace-nowrap text-xs text-sidebar-foreground/60">
                      {item.description}
                    </span>
                  )}
                </span>
                {item.to === "/notifications" && (unread.data?.count ?? 0) > 0 ? (
                  <Badge className="ml-auto shrink-0" variant="secondary">
                    {unread.data?.count}
                  </Badge>
                ) : null}
              </AppLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
          Tenant: <span className="font-medium">{tenantSlug ?? me?.tenantId ?? "—"}</span>
          {/* onboarding: sign out and pick another workspace on the sign-in page. */}
          <button
            type="button"
            className="mt-1 block font-medium text-primary hover:underline"
            onClick={async () => {
              await signOut();
              forgetWorkspace();
              void navigate({ to: "/login" });
            }}
          >
            Switch workspace
          </button>
          <div className="mt-2 flex gap-2">
            <AppLink to="/terms" className="hover:underline">
              Terms
            </AppLink>
            <AppLink to="/privacy" className="hover:underline">
              Privacy
            </AppLink>
            <AppLink to="/cookies" className="hover:underline">
              Cookies
            </AppLink>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">Tenant portal</div>
            <span className="text-foreground font-medium">{tenantSlug ?? me?.tenantId ?? "—"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild aria-label="Notifications">
              <AppLink to="/notifications" className="relative">
                <Bell className="h-4 w-4" />
                {(unread.data?.count ?? 0) > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                ) : null}
              </AppLink>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="max-w-[10rem] truncate">{me?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{me?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <AppLink to="/profile">Profile & security</AppLink>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    void navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="shrink-0">
          <SupportSessionBanner />
        </div>
        {showMfaRecommendation ? (
          <section
            role="region"
            aria-label="Security recommendation"
            className="flex flex-wrap items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-3 lg:px-8"
          >
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Add an extra layer of account protection</p>
              <p className="text-sm text-muted-foreground">
                Use an authenticator app to help keep your Analivo account secure.
              </p>
            </div>
            <Button size="sm" asChild>
              <AppLink to="/profile">Set up MFA</AppLink>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Dismiss security recommendation"
              onClick={dismissMfaRecommendation}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </section>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
