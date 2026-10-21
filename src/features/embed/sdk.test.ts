import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

type Sdk = {
  mount: (o: Record<string, unknown>) => {
    iframe: HTMLIFrameElement;
    setFilters: (f: unknown) => void;
    destroy: () => void;
  };
};

const FRAME = "https://app.analivo.test";

beforeAll(() => {
  const src = readFileSync(resolve(__dirname, "../../../public/embed-sdk.js"), "utf8");
  new Function(src).call(window);
});
afterEach(() => {
  document.body.innerHTML = "";
});

function sdk() {
  return (window as unknown as { AnalivoEmbed: Sdk }).AnalivoEmbed;
}

function fromFrame(iframe: HTMLIFrameElement, data: unknown, origin = FRAME) {
  window.dispatchEvent(new MessageEvent("message", { data, origin, source: iframe.contentWindow }));
}

describe("embed SDK", () => {
  it("creates the iframe without the token in its URL and sends it on ready", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const embed = sdk().mount({ container, token: "signed.jwt", origin: FRAME, theme: "dark" });
    expect(embed.iframe.src).toBe(`${FRAME}/embedded`);
    expect(embed.iframe.src).not.toContain("signed.jwt");
    const post = vi.spyOn(embed.iframe.contentWindow as Window, "postMessage");

    fromFrame(embed.iframe, { type: "analivo:ready" });
    expect(post).toHaveBeenCalledWith(
      { type: "analivo:init", token: "signed.jwt", theme: "dark" },
      FRAME,
    );
    fromFrame(embed.iframe, { type: "analivo:ready" });
    expect(post).toHaveBeenCalledTimes(1);

    embed.setFilters({ filters: [] });
    expect(post).toHaveBeenLastCalledWith(
      { type: "analivo:set-filters", filters: { filters: [] } },
      FRAME,
    );
  });

  it("resizes and forwards events; ignores other origins and sources", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const onEvent = vi.fn();
    const embed = sdk().mount({ container, token: "t", origin: FRAME, onEvent });
    const post = vi.spyOn(embed.iframe.contentWindow as Window, "postMessage");

    fromFrame(embed.iframe, { type: "analivo:resize", height: 321 });
    expect(embed.iframe.style.height).toBe("321px");
    expect(onEvent).toHaveBeenCalledWith("resize", { height: 321 });

    fromFrame(embed.iframe, { type: "analivo:ready" }, "https://evil.test");
    fromFrame(embed.iframe, { type: "analivo:error", code: "X" }, "https://evil.test");
    expect(post).not.toHaveBeenCalled();
    expect(onEvent).toHaveBeenCalledTimes(1);

    fromFrame(embed.iframe, { type: "analivo:error", code: "EMBED_TOKEN_INVALID" });
    expect(onEvent).toHaveBeenLastCalledWith("error", { code: "EMBED_TOKEN_INVALID" });

    embed.destroy();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("requires a container and a token", () => {
    expect(() => sdk().mount({ token: "t" })).toThrow(/container/);
    expect(() => sdk().mount({ container: document.body })).toThrow(/token/);
  });
});
