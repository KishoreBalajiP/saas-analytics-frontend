import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  FileCheck,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  ScrollText,
  Shield,
  UserCog,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
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
import { useAdminSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/tenants", label: "Tenants", icon: Building2 },
  { to: "/admin/admins", label: "Admins", icon: Shield },
  { to: "/admin/roles", label: "Roles", icon: UserCog },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/access-logs", label: "Access Logs", icon: Activity },
  { to: "/admin/compliance", label: "Compliance", icon: FileCheck },
  { to: "/admin/support", label: "Support", icon: Headphones },
  { to: "/admin/monitoring", label: "Monitoring", icon: Monitor },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { status, me, signOut } = useAdminSession();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (status === "anonymous") void navigate({ to: "/admin/login" });
  }, [status, navigate]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <p className="text-sm text-muted-foreground">Restoring admin session…</p>
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
          <Shield className="h-5 w-5 text-sidebar-primary" />
          <span className="font-display text-sm font-semibold tracking-tight">Admin Portal</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin navigation">
          {ADMIN_NAV.map((item) => {
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
              </AppLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <AppLink
            to="/dashboard"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4 rotate-180" />
            Tenant portal
          </AppLink>
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
            Admin portal · <span className="text-foreground">{me?.adminType ?? "admin"}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="max-w-[10rem] truncate">{me?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{me?.email}</DropdownMenuLabel>
                <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
                  {me?.adminType ?? "admin"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut();
                    void navigate({ to: "/admin/login" });
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
