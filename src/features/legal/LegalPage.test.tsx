import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/common/AppLink", () => ({
  AppLink: ({ children, to }: { children: React.ReactNode; to?: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/components/common/PublicFooter", () => ({ PublicFooter: () => <footer /> }));
vi.mock("@/components/common/Brand", () => ({ Brand: () => <span>Analivo</span> }));

import cookies from "@/content/legal/cookies.md?raw";
import privacy from "@/content/legal/privacy.md?raw";
import terms from "@/content/legal/terms.md?raw";
import { LEGAL_DOCUMENT_VERSION } from "@/content/legal/version";

import { LegalPage } from "./LegalPage";
import { parseMarkdown } from "./markdown";

describe("legal pages (onboarding)", () => {
  for (const [name, source, title] of [
    ["terms", terms, "Terms of Service"],
    ["privacy", privacy, "Privacy Policy"],
    ["cookies", cookies, "Cookie Policy"],
  ] as const) {
    it(`${name} renders from markdown with the draft banner`, () => {
      render(<LegalPage source={source} />);
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
      const note = screen.getByRole("note");
      expect(note).toHaveTextContent("Draft pending legal review");
      expect(note).toHaveTextContent(LEGAL_DOCUMENT_VERSION);
      expect(screen.getByText(/To be completed after legal review/)).toBeInTheDocument();
    });
  }

  it("parses headings, lists, bold and code without HTML", () => {
    const blocks = parseMarkdown("# T\n\nHello **bold** and `x`.\n\n- a\n- b <script>");
    expect(blocks.map((b) => b.kind)).toEqual(["h1", "p", "ul"]);
    render(<LegalPage source={"# T\n\n- b <img src=x onerror=alert(1)>"} />);
    expect(document.querySelector("img")).toBeNull();
  });
});
