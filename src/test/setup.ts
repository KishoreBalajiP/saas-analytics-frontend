import "@testing-library/jest-dom/vitest";

// Node 22+ ships its own Web Storage globals. Without --localstorage-file
// Node's `localStorage` getter returns undefined and shadows jsdom's, so
// storage writes silently fail in tests. Point both globals back at the
// jsdom window's working Storage objects.
{
  const dom = (globalThis as { jsdom?: { window: Window } }).jsdom;
  if (dom) {
    for (const key of ["localStorage", "sessionStorage"] as const) {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: true,
        get: () => dom.window[key],
      });
    }
  }
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(target: Element) {
      queueMicrotask(() => {
        this.cb(
          [
            {
              target,
              contentRect: { width: 500, height: 300, top: 0, left: 0, right: 500, bottom: 300 },
              borderBoxSize: [{ inlineSize: 500, blockSize: 300 }],
              devicePixelContentBoxSize: [],
            },
          ] as unknown as ResizeObserverEntry[],
          this as unknown as ResizeObserver,
        );
      });
    }
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = (() => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia;
}
