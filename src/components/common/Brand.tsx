import { AppLink } from "@/components/common/AppLink";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <AppLink
      to="/"
      className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img src="/analivo-mark.svg" alt="" className={compact ? "h-7 w-7" : "h-8 w-8"} />
      <span className="font-display text-lg font-bold tracking-tight text-foreground">Analivo</span>
    </AppLink>
  );
}
