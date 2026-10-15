import type { ReactNode } from "react";
import { Brand } from "@/components/common/Brand";
import { AppLink } from "@/components/common/AppLink";

const policyLinks = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Cookies", "/cookies"],
  ["Acceptable use", "/acceptable-use"],
  ["Security", "/security"],
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-card/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-sm text-sm leading-6 text-muted-foreground">
            A focused analytics workspace for turning business data into decisions.
          </p>
        </div>
        <FooterGroup title="Product">
          <a href="/#features">Features</a>
          <a href="/#data-sources">Supported data sources</a>
          <a href="/#security">Security</a>
        </FooterGroup>
        <FooterGroup title="Account">
          <AppLink to="/login">Sign in</AppLink>
          <AppLink to="/register">Create workspace</AppLink>
          <AppLink to="/request-access">Request access</AppLink>
        </FooterGroup>
        <FooterGroup title="Legal">
          {policyLinks.map(([label, to]) => (
            <AppLink key={to} to={to}>
              {label}
            </AppLink>
          ))}
        </FooterGroup>
      </div>
      <div className="mx-auto max-w-7xl border-t border-border px-5 py-5 text-xs text-muted-foreground lg:px-8">
        © {new Date().getFullYear()} Analivo. All rights reserved.
      </div>
    </footer>
  );
}

function FooterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <div className="flex flex-col gap-2 [&_a]:hover:text-foreground [&_a]:hover:underline">
        {children}
      </div>
    </nav>
  );
}
