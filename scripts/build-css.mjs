// Writes the stylesheets to dist/ (run by `npm run build` after tsup):
//   style.css        the default look, as written
//   style.layer.css  the same rules inside `@layer components`. Imported after
//                    `@import "tailwindcss"` (v4), they join Tailwind's components layer, so
//                    utility classes (the utilities layer) override them without `!important`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const css = readFileSync("src/styles.css", "utf8");
mkdirSync("dist", { recursive: true });
writeFileSync("dist/style.css", css);
writeFileSync("dist/style.layer.css", `@layer components {\n${css}\n}\n`);
console.log("dist/style.css, dist/style.layer.css");
