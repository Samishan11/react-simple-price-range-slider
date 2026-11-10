import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Playground dev server: `npm run dev`
export default defineConfig({ root: "playground", plugins: [react()] });
