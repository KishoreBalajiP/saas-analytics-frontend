/** Node.js example a sender can paste; the secret stays a placeholder. */
export function signingExample(url: string) {
  return [
    'import crypto from "node:crypto";',
    "",
    'const body = JSON.stringify({ events: [{ id: "evt_1", amount: 1200 }] });',
    "const timestamp = Math.floor(Date.now() / 1000); // seconds",
    "const signature = crypto",
    '  .createHmac("sha256", process.env.WEBHOOK_SIGNING_SECRET)',
    "  .update(`${timestamp}.${body}`)",
    '  .digest("hex");',
    "",
    `await fetch("${url}", {`,
    '  method: "POST",',
    "  headers: {",
    '    "Content-Type": "application/json",',
    '    "X-Saas-Timestamp": String(timestamp),',
    '    "X-Saas-Signature": `v2=${signature}`,',
    "  },",
    "  body,",
    "});",
  ].join("\n");
}
