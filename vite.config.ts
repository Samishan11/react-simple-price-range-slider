import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Playground dev server: `npm run dev`. Tailwind powers the "unstyled" demo (playground/tailwind.css).
export default defineConfig({ root: "playground", plugins: [react(), tailwindcss()] });
