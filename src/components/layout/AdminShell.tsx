import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  FileCheck,
  Headphones,
  Inbox,
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
import { Permissions, hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: Permissions.MONITORING_VIEW,
    description: "Admin overview and system monitoring",
  },
  {
    to: "/admin/tenants",
    label: "Tenants",
    icon: Building2,
    permission: Permissions.IAM_TENANTS_VIEW,
    description: "Manage workspace tenants and members",
  },
  {
    to: "/admin/access-requests",
    label: "Access requests",
    description: "Review workspace access requests",
    icon: Inbox,
    permission: Permissions.IAM_TENANTS_VIEW,
  },
  {
    to: "/admin/admins",
    label: "Admins",
    icon: Shield,
    permission: Permissions.IAM_ADMINS_VIEW,
    description: "Manage administrator accounts",
  },
  {
    to: "/admin/roles",
    label: "Roles",
    icon: UserCog,
    permission: Permissions.IAM_ROLES_VIEW,
    description: "Manage roles and permissions",
  },
  {
    to: "/admin/plans",
    label: "Plans",
    icon: BadgeDollarSign,
    permission: Permissions.BILLING_PLANS_VIEW,
    description: "View and manage pricing plans",
  },
  {
    to: "/admin/subscriptions",
    label: "Subscriptions",
    icon: BadgeDollarSign,
    permission: Permissions.BILLING_SUBSCRIPTIONS_VIEW,
    description: "View and manage subscriptions",
  },
  {
    to: "/admin/entitlements",
    label: "Entitlements",
    icon: BadgeDollarSign,
    permission: Permissions.BILLING_ENTITLEMENTS_OVERRIDE,
    description: "Manage entitlements and overrides",
  },
  {
    to: "/admin/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    permission: Permissions.AUDIT_LOGS_VIEW,
    description: "View audit trail and logs",
  },
  {
    to: "/admin/access-logs",
    label: "Access Logs",
    icon: Activity,
    permission: Permissions.ACCESS_LOGS_VIEW,
    description: "View access logs and activity history",
  },
  {
    to: "/admin/compliance",
    label: "Compliance",
    icon: FileCheck,
    permission: Permissions.COMPLIANCE_VIEW,
    description: "View compliance reports and settings",
  },
  {
    to: "/admin/support",
    label: "Support",
    icon: Headphones,
    permission: Permissions.SUPPORT_LOOKUP,
    description: "Access support tools and lookup",
  },
  {
    to: "/admin/monitoring",
    label: "Monitoring",
    icon: Monitor,
    permission: Permissions.MONITORING_VIEW,
    description: "Monitor system health and metrics",
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { status, me, permissions, signOut } = useAdminSession();
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
          {ADMIN_NAV.filter((item) => hasPermission(permissions, item.permission)).map((item) => {
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
                <span className="truncate">{item.label}</span>
                {item.description && (
                  <p className="text-xs text-sidebar-foreground/60 truncate mt-0.5">
                    {item.description}
                  </p>
                )}
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
        <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 lg:px-8 backdrop-blur">
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
            <div className="text-sm text-muted-foreground">Admin portal</div>
            <span className="text-foreground font-medium">{me?.adminType ?? "admin"}</span>
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
        </div>
        <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
