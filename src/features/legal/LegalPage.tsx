import { AppLink } from "@/components/common/AppLink";
import { Brand } from "@/components/common/Brand";
import { PublicFooter } from "@/components/common/PublicFooter";

import { parseMarkdown, type Inline } from "./markdown";

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((part, i) =>
        part.kind === "bold" ? (
          <strong key={i}>{part.text}</strong>
        ) : part.kind === "code" ? (
          <code key={i} className="rounded bg-muted px-1 text-sm">
            {part.text}
          </code>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

/**
 * A legal document rendered from a bundled Markdown file.
 */
export function LegalPage({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
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
        <article className="space-y-5">
          {blocks.map((block, i) => {
            if (block.kind === "h1")
              return (
                <h1 key={i} className="text-4xl font-bold tracking-tight sm:text-5xl">
                  <Inlines inlines={block.inlines} />
                </h1>
              );
            if (block.kind === "h2")
              return (
                <h2 key={i} className="pt-4 text-xl font-semibold">
                  <Inlines inlines={block.inlines} />
                </h2>
              );
            if (block.kind === "ul")
              return (
                <ul key={i} className="list-disc space-y-1 pl-6 leading-7 text-muted-foreground">
                  {block.items.map((item, j) => (
                    <li key={j}>
                      <Inlines inlines={item} />
                    </li>
                  ))}
                </ul>
              );
            return (
              <p key={i} className="leading-7 text-muted-foreground">
                <Inlines inlines={block.inlines} />
              </p>
            );
          })}
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
