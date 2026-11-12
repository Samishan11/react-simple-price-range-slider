import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom"],
  // The slider uses hooks, so it must be a client module in React Server Components
  // (Next.js App Router). Without this, rendering it from a Server Component fails.
  banner: { js: '"use client";' },
});
