/**
 * Minimal Markdown subset for the bundled legal drafts (headings, paragraphs,
 * bullet lists, **bold** and `code`). Content is our own repo files; output
 * is a typed block list rendered by React (no HTML injection).
 */
export type Inline = { kind: "text" | "bold" | "code"; text: string };
export type Block =
  { kind: "h1" | "h2" | "p"; inlines: Inline[] } | { kind: "ul"; items: Inline[][] };

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ kind: "text", text: text.slice(last, m.index) });
    const token = m[0];
    out.push(
      token.startsWith("**")
        ? { kind: "bold", text: token.slice(2, -2) }
        : { kind: "code", text: token.slice(1, -1) },
    );
    last = m.index + token.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: Inline[][] | null = null;
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", inlines: parseInline(para.join(" ")) });
    para = [];
    if (list) blocks.push({ kind: "ul", items: list });
    list = null;
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
    } else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "h2", inlines: parseInline(line.slice(3)) });
    } else if (line.startsWith("# ")) {
      flush();
      blocks.push({ kind: "h1", inlines: parseInline(line.slice(2)) });
    } else if (line.startsWith("- ")) {
      if (para.length) {
        blocks.push({ kind: "p", inlines: parseInline(para.join(" ")) });
        para = [];
      }
      list = list ?? [];
      list.push(parseInline(line.slice(2)));
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}
