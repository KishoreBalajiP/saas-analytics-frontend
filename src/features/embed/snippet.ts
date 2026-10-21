/** Split a comma/whitespace separated origin list. */
export function parseOrigins(value: string) {
  return value
    .split(/[\s,]+/)
    .map((o) => o.trim())
    .filter(Boolean);
}

/** Host-page snippet for the embed SDK. */
export function sdkSnippet(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return [
    `<div id="analivo-embed"></div>`,
    `<script src="${origin}/embed-sdk.js"></script>`,
    `<script>`,
    `  AnalivoEmbed.mount({ container: document.getElementById("analivo-embed"), token: "${token}" });`,
    `</script>`,
  ].join("\n");
}
