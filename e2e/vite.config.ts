import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Serves the e2e fixture pages straight from src/ (Playwright starts it, see playwright.config.ts).
// Tailwind only processes the stylesheets that import it (the /tailwind.html fixture).
export default defineConfig({
  root: fileURLToPath(new URL("./fixtures", import.meta.url)),
  plugins: [react(), tailwindcss()],
  logLevel: "warn",
});
