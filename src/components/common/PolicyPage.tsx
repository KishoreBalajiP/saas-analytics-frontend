import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { PublicFooter } from "@/components/common/PublicFooter";

export type PolicySection = { heading: string; body: string };

export function PolicyPage({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: PolicySection[];
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <AppLink
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Back to Analivo
          </AppLink>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Analivo information
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">{summary}</p>
        <div className="mt-10 rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
          Publication note: this page describes current application behavior. The operator has not
          published a legal entity, governing jurisdiction, privacy or security contact, retention
          schedule, or commercial terms here. Those deployment-specific items require business and
          legal approval before this page can serve as final legal terms.
        </div>
        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              <p className="mt-2 leading-7 text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
