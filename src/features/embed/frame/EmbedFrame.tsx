import { useCallback, useEffect, useRef, useState } from "react";

import { WidgetView } from "@/components/common/WidgetView";
import * as embedApi from "@/features/embed/api";
import type { EmbedFilterEnvelope, EmbedTheme, EmbedView } from "@/features/embed/api";
import { ApiError } from "@/lib/api/client";

import { EMBED_MESSAGES, isEmbedMessage } from "./protocol";

type State =
  | { status: "waiting" }
  | { status: "loading" }
  | { status: "ready"; view: EmbedView }
  | { status: "error"; code: string; message: string };

function errorOf(e: unknown) {
  if (e instanceof ApiError) return { code: e.code ?? `HTTP_${e.statusCode}`, message: e.message };
  return { code: "EMBED_FAILED", message: "The embedded content could not be loaded." };
}

/**
 * Chrome-less embed page. Waits for the host's `analivo:init` message,
 * locks onto that sender's origin (browser-verified `event.origin`),
 * exchanges the signed token for an embed session and renders the
 * dashboard. Uses only the embed session; no tenant cookies or tokens.
 */
export function EmbedFrame({ win = window }: { win?: Window }) {
  const [state, setState] = useState<State>({ status: "waiting" });
  const [theme, setTheme] = useState<EmbedTheme>("auto");
  const parentOrigin = useRef<string | null>(null);
  const session = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const post = useCallback(
    (message: Record<string, unknown>) => {
      if (parentOrigin.current) win.parent.postMessage(message, parentOrigin.current);
    },
    [win],
  );

  const fail = useCallback(
    (e: unknown) => {
      const err = errorOf(e);
      setState({ status: "error", ...err });
      post({ type: EMBED_MESSAGES.ERROR, ...err });
    },
    [post],
  );

  const load = useCallback(
    async (filters?: EmbedFilterEnvelope) => {
      if (!session.current || !parentOrigin.current) return;
      setState({ status: "loading" });
      try {
        const view = await embedApi.viewEmbed(session.current, parentOrigin.current, filters);
        setState({ status: "ready", view });
        post({ type: EMBED_MESSAGES.LOADED });
        if (filters) post({ type: EMBED_MESSAGES.FILTERS, filters });
      } catch (e) {
        fail(e);
      }
    },
    [fail, post],
  );

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      if (event.source !== win.parent || !isEmbedMessage(event.data)) return;
      const data = event.data;
      if (data.type === EMBED_MESSAGES.INIT) {
        // Only the first init counts; later ones (other origins) are ignored.
        if (parentOrigin.current || typeof data.token !== "string") return;
        parentOrigin.current = event.origin;
        if (data.theme === "light" || data.theme === "dark") setTheme(data.theme);
        setState({ status: "loading" });
        try {
          const s = await embedApi.exchangeSession(data.token, event.origin);
          session.current = s.sessionToken;
          if (!(data.theme === "light" || data.theme === "dark")) setTheme(s.theme);
          await load();
        } catch (e) {
          fail(e);
        }
        return;
      }
      if (data.type === EMBED_MESSAGES.SET_FILTERS && event.origin === parentOrigin.current) {
        await load((data.filters ?? undefined) as EmbedFilterEnvelope | undefined);
      }
    }
    const listener = (event: MessageEvent) => void onMessage(event);
    win.addEventListener("message", listener);
    // Tell the host we are listening. No secrets in this message.
    win.parent.postMessage({ type: EMBED_MESSAGES.READY }, "*");
    return () => win.removeEventListener("message", listener);
  }, [fail, load, win]);

  // Auto-resize: report the content height to the host.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      post({ type: EMBED_MESSAGES.RESIZE, height: Math.ceil(el.scrollHeight) }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post]);

  const dark =
    theme === "dark" ||
    (theme === "auto" && win.matchMedia?.("(prefers-color-scheme: dark)").matches);

  return (
    <div
      ref={rootRef}
      className={
        dark ? "dark bg-background p-3 text-foreground" : "bg-background p-3 text-foreground"
      }
      data-theme={dark ? "dark" : "light"}
    >
      {state.status === "waiting" || state.status === "loading" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      ) : null}
      {state.status === "error" ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
          <p className="font-medium text-destructive">{state.message}</p>
          <p className="text-xs text-muted-foreground">{state.code}</p>
        </div>
      ) : null}
      {state.status === "ready" ? (
        <div className="space-y-3">
          {state.view.dashboard ? (
            <h1 className="text-base font-semibold">{state.view.dashboard.name}</h1>
          ) : null}
          {state.view.widgets.map((w) => (
            <section key={w.widgetId} className="rounded-md border p-3">
              <h2 className="mb-2 text-sm font-medium">{w.name}</h2>
              {w.error || !w.result ? (
                <p className="text-sm text-muted-foreground">This widget could not be rendered.</p>
              ) : (
                <WidgetView type={w.type} result={w.result} />
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
