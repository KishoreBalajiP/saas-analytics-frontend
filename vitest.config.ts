import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    css: false,
    // The full 131-file suite runs concurrently and can starve jsdom/user-event
    // timers on constrained CI runners; preserve assertions while allowing the
    // same interactions the isolated tests complete within their normal duration.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
