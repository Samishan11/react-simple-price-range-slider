// Checks the built dist/ before publishing (run after `npm run build`):
//   - both bundles start with "use client" (React Server Components / Next.js App Router)
//   - style.layer.css holds style.css inside `@layer components`
//   - minified + gzipped sizes stay within budget (react is external, like in apps)
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const BUDGETS = [
  { file: "dist/index.js", limit: 8 * 1024, label: "JS (ESM)" },
  { file: "dist/style.css", limit: 4 * 1024, label: "CSS" },
];

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};

for (const file of ["dist/index.js", "dist/index.cjs"]) {
  if (/^\s*["']use client["']/.test(readFileSync(file, "utf8"))) console.log(`✓ ${file} starts with "use client"`);
  else fail(`${file} must start with "use client"`);
}

const layered = readFileSync("dist/style.layer.css", "utf8");
if (layered.startsWith("@layer components {") && layered.includes(readFileSync("dist/style.css", "utf8")))
  console.log("✓ dist/style.layer.css wraps style.css in @layer components");
else fail("dist/style.layer.css must wrap style.css in @layer components");

for (const { file, limit, label } of BUDGETS) {
  const result = await build({
    entryPoints: [file],
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    external: ["react", "react-dom"],
    logLevel: "silent",
  });
  const size = gzipSync(result.outputFiles[0].contents, { level: 9 }).length;
  const line = `${label}: ${(size / 1024).toFixed(2)} kB min+gzip (budget ${(limit / 1024).toFixed(0)} kB)`;
  if (size <= limit) console.log(`✓ ${line}`);
  else fail(line);
}

if (failed) process.exit(1);
