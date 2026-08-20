#!/usr/bin/env node
/**
 * Generates a minimal index.html in .output/public/ for Tauri production builds.
 * TanStack Start / Nitro renders via SSR, so no static index.html is emitted.
 * This shell loads the client-side JS bundle that Vite generates.
 */
import { readdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", ".output", "public");
const assetsDir = join(publicDir, "assets");

if (!existsSync(assetsDir)) {
  console.error("ERROR: .output/public/assets/ not found — did the build run?");
  process.exit(1);
}

// Find the JS entry file (starts with "index" and ends with .js)
const files = readdirSync(assetsDir);
const jsEntry = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const cssFiles = files.filter((f) => f.endsWith(".css"));

// NOTA: Slash iniziale fondamentale per il server di asset interno di Tauri
const scriptTag = `<script type="module" src="/assets/${jsEntry || "index.js"}"></script>`;
const cssTags = cssFiles.map((f) => `  <link rel="stylesheet" href="/assets/${f}" />`).join("\n");

// NOTA: Entrambi i div (#app e #root) per garantire il mount sia con TanStack Start che con Vite classico
const html = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenTour Studio</title>
${cssTags}
  ${scriptTag}
</head>
<body>
  <div id="app"></div>
  <div id="root"></div>
</body>
</html>
`;

writeFileSync(join(publicDir, "index.html"), html);
console.log("Generated .output/public/index.html for Tauri");
