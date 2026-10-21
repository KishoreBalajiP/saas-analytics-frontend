// delivery: roadmap 3.4 - split a free-text recipient list into emails.
export function parseEmails(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}
