// Installs the PACKED package (what npm users get, not src/) into a real consumer and checks:
//   1. Node ESM `import` and CJS `require` resolve, and the CSS export resolves
//   2. a Next.js App Router Server Component can render the slider ("use client" in dist)
// Usage: npm run build && npm run test:consumer
import { execSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const work = mkdtempSync(join(tmpdir(), "rs-consumer-"));
const run = (cmd, cwd) =>
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });

// A component is a function, or an object with $$typeof (forwardRef / memo).
const isComponent = `(c) => typeof c === "function" || (typeof c === "object" && c !== null && "$$typeof" in c)`;
const esmCheck = `import S, { MultiRangeSlider, RangeSlider, useRangeSlider } from "react-multi-input-rangeslider";
const isComponent = ${isComponent};
if (!isComponent(S) || S !== MultiRangeSlider || !isComponent(RangeSlider) || typeof useRangeSlider !== "function")
  throw new Error("ESM exports are wrong");
console.log("ESM import OK");`;
const cjsCheck = `const m = require("react-multi-input-rangeslider");
const isComponent = ${isComponent};
if (!isComponent(m.default) || m.default !== m.MultiRangeSlider || !isComponent(m.RangeSlider)) throw new Error("CJS exports are wrong");
require.resolve("react-multi-input-rangeslider/style.css");
require.resolve("react-multi-input-rangeslider/style.layer.css");
console.log("CJS require + CSS exports OK");`;

try {
  run(`npm pack --silent --pack-destination "${work}"`, root);
  const tarball = join(work, readdirSync(work).find((f) => f.endsWith(".tgz")));
  const app = join(work, "next-app");
  cpSync(join(root, "e2e/consumers/next-app"), app, { recursive: true });
  run(`npm install --no-audit --no-fund --loglevel=error "${tarball}"`, app);
  run(`node --input-type=module -e '${esmCheck}'`, app);
  run(`node -e '${cjsCheck}'`, app);
  run("npx next build", app);
  console.log("\nConsumer smoke test passed.");
} finally {
  rmSync(work, { recursive: true, force: true });
}
