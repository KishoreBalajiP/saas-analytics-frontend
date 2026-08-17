import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  FileText,
  Key,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Settings,
  ShieldAlert,
  User,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
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
import * as notificationsApi from "@/lib/api/notifications";
import { useTenantSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboards", label: "Dashboards", icon: Activity },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/alerts", label: "Alerts", icon: ShieldAlert },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/api-keys", label: "API keys", icon: Key },
  { to: "/embed", label: "Embed", icon: MonitorSmartphone },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function TenantShell({ children }: { children: ReactNode }) {
  const { status, me, tenantSlug, signOut } = useTenantSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === "anonymous") void navigate({ to: "/login" });
  }, [status, navigate]);

  const unread = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationsApi.unreadCount,
    enabled: status === "authenticated",
    refetchInterval: 60_000,
    retry: false,
  });

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <p className="text-sm text-muted-foreground">Restoring your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <BarChart3 className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-sm font-semibold tracking-tight">
            Analytics Console
          </span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            return (
              <AppLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.to === "/notifications" && (unread.data?.count ?? 0) > 0 ? (
                  <Badge className="ml-auto" variant="secondary">
                    {unread.data?.count}
                  </Badge>
                ) : null}
              </AppLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/70">
          Tenant: <span className="font-medium">{tenantSlug ?? me?.tenantId ?? "—"}</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="text-sm text-muted-foreground">
            Tenant portal · <span className="text-foreground">{tenantSlug}</span>
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
                <DropdownMenuItem asChild>
                  <AppLink to="/admin/login">Admin portal</AppLink>
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
        </header>
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
