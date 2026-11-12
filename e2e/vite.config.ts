import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Serves the e2e fixture page straight from src/ (Playwright starts it, see playwright.config.ts).
export default defineConfig({
  root: fileURLToPath(new URL("./fixtures", import.meta.url)),
  plugins: [react()],
  logLevel: "warn",
});
