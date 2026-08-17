import "@testing-library/jest-dom/vitest";

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
