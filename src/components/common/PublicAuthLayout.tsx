import type { ReactNode } from "react";

import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { PublicFooter } from "@/components/common/PublicFooter";
import { cn } from "@/lib/utils";

export function PublicAuthLayout({
  children,
  contentClassName,
}: {
  children: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-background/95">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-4 text-sm" aria-label="Account navigation">
            <AppLink
              to="/login"
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Sign in
            </AppLink>
            <AppLink
              to="/register"
              className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground hover:opacity-90"
            >
              Create workspace
            </AppLink>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:py-16">
        <div className={cn("w-full", contentClassName)}>{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}
