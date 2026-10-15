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
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-end sm:justify-between lg:px-8">
        <div className="space-y-2">
          <Brand />
          <p className="max-w-sm text-sm text-muted-foreground">
            Analytics for teams that want a clearer view of the work.
          </p>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Analivo</p>
        </div>
        <nav aria-label="Policy and information" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {policyLinks.map(([label, to]) => (
            <AppLink
              key={to}
              to={to}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              {label}
            </AppLink>
          ))}
          <AppLink
            to="/request-access"
            className="text-muted-foreground hover:text-foreground hover:underline"
          >
            Contact / access
          </AppLink>
        </nav>
      </div>
    </footer>
  );
}
