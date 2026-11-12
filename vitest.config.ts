import { defineConfig } from "vitest/config";

export default defineConfig({
  // Unit/component tests only; real-browser tests live in e2e/ and run with Playwright.
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"], include: ["tests/**/*.test.{ts,tsx}"] },
});
