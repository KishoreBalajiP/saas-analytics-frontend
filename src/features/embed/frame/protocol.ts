/**
 * postMessage protocol between the host page (public/embed-sdk.js) and the
 * Analivo embed iframe (/embedded). Keep in step with the SDK.
 *
 * host -> frame: analivo:init { token, theme? }   (once; the token never
 *                                                   travels in a URL)
 *                analivo:set-filters { filters }
 * frame -> host: analivo:ready, analivo:loaded, analivo:resize { height },
 *                analivo:filters { filters }, analivo:error { code, message }
 */

export const EMBED_MESSAGES = {
  INIT: "analivo:init",
  SET_FILTERS: "analivo:set-filters",
  READY: "analivo:ready",
  LOADED: "analivo:loaded",
  RESIZE: "analivo:resize",
  FILTERS: "analivo:filters",
  ERROR: "analivo:error",
} as const;

export interface EmbedMessage {
  type: string;
  token?: unknown;
  theme?: unknown;
  filters?: unknown;
}

export function isEmbedMessage(data: unknown): data is EmbedMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as { type?: unknown }).type === "string" &&
    (data as { type: string }).type.startsWith("analivo:")
  );
}
