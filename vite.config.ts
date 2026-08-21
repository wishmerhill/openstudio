// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  readdirSync,
  statSync,
} from "fs";
import { join, resolve } from "path";
import JSZip from "jszip";

// ── Vite middleware plugin: /api/export-neutralino ──────────────────────────
function neutralinoExportPlugin(): any {
  return {
    name: "vite-plugin-neutralino-export",
    configureServer(server: any) {
      server.middlewares.use(
        "/api/export-neutralino",
        async (req: any, res: any) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            return res.end(
              JSON.stringify({ error: "Method not allowed" }),
            );
          }

          let body = "";
          req.on("data", (chunk: string) => {
            body += chunk;
          });
          req.on("end", async () => {
            try {
              const payload = JSON.parse(body);
              const {
                projectName,
                tourJson,
                scenes,
                panoramas,
              } = payload;
              const appName =
                (projectName as string)
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, "") || "tour";

              // ── Paths ──────────────────────────────────────────────
              const VIEWER_DIR = resolve(process.cwd(), "viewer");
              const VIEWER_HTML_PATH = join(VIEWER_DIR, "index.html");
              const VIEWER_CONFIG_PATH = join(
                VIEWER_DIR,
                "neutralino.config.json",
              );

              // Backup originali
              const originalHtml = readFileSync(VIEWER_HTML_PATH, "utf-8");
              const originalConfig = JSON.parse(
                readFileSync(VIEWER_CONFIG_PATH, "utf-8"),
              );

              try {
                // ── 1. Prepara resources/ ────────────────────────────
                const resourcesDir = join(VIEWER_DIR, "resources");
                const panoramasDir = join(resourcesDir, "panoramas");

                if (existsSync(resourcesDir)) {
                  rmSync(resourcesDir, {
                    recursive: true,
                    force: true,
                  });
                }
                mkdirSync(panoramasDir, { recursive: true });

                // index.html con __TOUR_NAME__ sostituito
                let html = originalHtml.replace(
                  /__TOUR_NAME__/g,
                  projectName as string,
                );
                // Rendi relativi tutti i path in resources/index.html
                // (escluso neutralino.js che deve rimanere assoluto /neutralino.js)
                html = html.replace(/(src|href)="\/(?!neutralino\.js)/g, '$1="./');
                // Inject neutralino.js per il runtime Neutralinojs (file protocol)
                html = html.replace(
                  /<\/head>/i,
                  '<script src="/neutralino.js"></script></head>',
                );
                writeFileSync(
                  join(resourcesDir, "index.html"),
                  html,
                  "utf-8",
                );

                // tour.json
                writeFileSync(
                  join(resourcesDir, "tour.json"),
                  tourJson as string,
                  "utf-8",
                );

                // tour-data.js
                const tourDataScenes = (scenes as any[]).map(
                  (scene: any) => ({
                    id: scene.id,
                    name: scene.name,
                    panoramaUrl:
                      (scene.panoramaFilename as string).startsWith(
                        "http",
                      ) ||
                      (scene.panoramaFilename as string).startsWith(
                        "data:",
                      ) ||
                      (scene.panoramaFilename as string) === ""
                        ? scene.panoramaFilename
                        : `panoramas/${scene.panoramaFilename}`,
                    defaultZoom: scene.defaultZoom,
                    hotspots: scene.hotspots,
                  }),
                );
                const tourDataJs = `window.TOUR_DATA = ${JSON.stringify(tourDataScenes, null, 2)};\n`;
                writeFileSync(
                  join(resourcesDir, "tour-data.js"),
                  tourDataJs,
                  "utf-8",
                );

                // Panorami
                if (panoramas) {
                  for (const pano of panoramas as any[]) {
                    let buffer: Buffer;
                    if ((pano.data as string).startsWith("data:")) {
                      const base64 =
                        (pano.data as string).split(",")[1] ?? pano.data;
                      buffer = Buffer.from(base64, "base64");
                    } else {
                      buffer = Buffer.from(pano.data as string, "base64");
                    }
                    writeFileSync(
                      join(panoramasDir, pano.filename as string),
                      buffer,
                    );
                  }
                }

                // ── 2. Aggiorna neutralino.config.json ───────────────
                const config = {
                  ...originalConfig,
                  documentRoot: "/",
                  tokenSecurity: "one-time",
                  applicationId: `com.opentour.${appName}`,
                  cli: {
                    binaryName: appName,
                    resourcesPath: "/resources/",
                  },
                  modes: {
                    ...(originalConfig.modes || {}),
                    window: {
                      ...((originalConfig.modes && originalConfig.modes.window) || {}),
                      title: projectName,
                      width: 1000,
                      height: 700,
                      enableInspector: true,
                      url: "/index.html",
                    },
                  },
                  url: "/index.html",
                  globalVariables: {
                    NL_MODE: "window",
                    NL_ARGS: [],
                  },
                } as Record<string, any>;
                writeFileSync(
                  VIEWER_CONFIG_PATH,
                  JSON.stringify(config, null, 2) + "\n",
                  "utf-8",
                );

                // ── 3. neu update ────────────────────────────────────
                const neuBin = join(
                  VIEWER_DIR,
                  "node_modules",
                  "@neutralinojs",
                  "neu",
                  "bin",
                  "neu.js",
                );

                if (!existsSync(join(VIEWER_DIR, "bin"))) {
                  console.log(
                    "[neutralinoBuild] Downloading Neutralinojs binaries...",
                  );
                  const updateStdout = execSync(
                    `node "${neuBin}" update`,
                    {
                      cwd: VIEWER_DIR,
                      encoding: "utf-8",
                      stdio: "pipe",
                      timeout: 120_000,
                    },
                  );
                  console.log(
                    "[Neutralino Update Output]:",
                    updateStdout,
                  );
                }

                // ── 4. neu build --release ───────────────────────────
                console.log(
                  `[neutralinoBuild] Building ${appName} with neu CLI...`,
                );

                const buildStdout = execSync(
                  `node "${neuBin}" build --release`,
                  {
                    cwd: VIEWER_DIR,
                    encoding: "utf-8",
                    stdio: "pipe",
                    timeout: 120_000,
                  },
                );
                console.log(
                  "[Neutralino Build Output]:",
                  buildStdout,
                );

                // ── 5. Trova output in dist/ ─────────────────────────
                const distDir = join(VIEWER_DIR, "dist");
                if (!existsSync(distDir)) {
                  throw new Error(
                    "Build completata ma la cartella dist/ non esiste.",
                  );
                }

                let appDistDir = join(distDir, appName);
                if (!existsSync(appDistDir)) {
                  const distEntries = readdirSync(distDir);
                  const found = distEntries
                    .map((entry) => join(distDir, entry))
                    .find(
                      (p) =>
                        existsSync(p) && statSync(p).isDirectory(),
                    );
                  if (!found) {
                    throw new Error(
                      `Nessuna cartella di output trovata in ${distDir}. Contenuto: ${distEntries.join(", ")}`,
                    );
                  }
                  appDistDir = found;
                }

                // ── 6. Imposta permessi d'esecuzione sui binari ──────
                console.log(
                  "[neutralinoBuild] Impostazione permessi esecuzione sui binari...",
                );
                execSync(`chmod -R +x "${appDistDir}"`, {
                  encoding: "utf-8",
                  stdio: "pipe",
                });

                // ── 7. Comprimi in ZIP ───────────────────────────────
                const zip = new JSZip();
                await addDirToZip(zip, appDistDir, "");
                const zipBuffer = await zip.generateAsync({
                  type: "nodebuffer",
                });

                // Verifica che resources.neu sia presente nello ZIP
                const zipForCheck = await JSZip.loadAsync(zipBuffer);
                const zipFiles = Object.keys(zipForCheck.files);
                const hasResourcesNeu = zipFiles.some((f) =>
                  f.endsWith("resources.neu"),
                );
                const hasBinaries = zipFiles.some((f) => {
                  const lower = f.toLowerCase();
                  return (
                    lower.includes(appName) &&
                    (lower.includes("mac_arm64") ||
                      lower.includes("mac_x64") ||
                      lower.includes("win_x64") ||
                      lower.includes("linux_x64") ||
                      lower.includes("linux_arm") ||
                      lower.endsWith(".exe"))
                  );
                });
                if (!hasResourcesNeu) {
                  console.warn(
                    "[neutralinoBuild] ATTENZIONE: resources.neu non trovato nello ZIP!",
                  );
                }
                if (!hasBinaries) {
                  console.warn(
                    "[neutralinoBuild] ATTENZIONE: Nessun binario trovato nello ZIP!",
                  );
                }
                console.log(
                  "[neutralinoBuild] ZIP creato con",
                  zipFiles.length,
                  "file:",
                  zipFiles.join(", "),
                );

                // ── 8. Rispondi con base64 ───────────────────────────
                res.setHeader("Content-Type", "application/json");
                return res.end(
                  JSON.stringify({
                    zipBase64: zipBuffer.toString("base64"),
                    filename: `${appName}-neutralino.zip`,
                  }),
                );
              } catch (buildErr: any) {
                console.error(
                  "[Neutralino Build STDOUT]:",
                  buildErr.stdout?.toString(),
                );
                console.error(
                  "[Neutralino Build STDERR]:",
                  buildErr.stderr?.toString(),
                );
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                return res.end(
                  JSON.stringify({
                    error: `Neutralino CLI Build Failed: ${buildErr.stderr?.toString() || buildErr.message}`,
                  }),
                );
              } finally {
                // Cleanup: ripristina file originali
                try {
                  rmSync(join(VIEWER_DIR, "resources"), {
                    recursive: true,
                    force: true,
                  });
                  writeFileSync(
                    VIEWER_HTML_PATH,
                    originalHtml,
                    "utf-8",
                  );
                  writeFileSync(
                    VIEWER_CONFIG_PATH,
                    JSON.stringify(originalConfig, null, 2) + "\n",
                    "utf-8",
                  );
                } catch {
                  // Ignora errori di cleanup
                }
              }
            } catch (parseErr: any) {
              console.error(
                "[Neutralino Build Error]:",
                parseErr,
              );
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              return res.end(
                JSON.stringify({
                  error: parseErr.message || "Build fallita",
                }),
              );
            }
          });
        },
      );
    },
  };
}

// ── Helper: aggiunge ricorsivamente file a un JSZip ─────────────────────────
async function addDirToZip(
  zip: JSZip,
  dirPath: string,
  zipPath: string,
) {
  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const entryZipPath = zipPath ? `${zipPath}/${entry}` : entry;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const folder = zip.folder(entryZipPath);
      if (folder)
        await addDirToZip(
          folder as unknown as JSZip,
          fullPath,
          entryZipPath,
        );
    } else {
      zip.file(entryZipPath, readFileSync(fullPath));
    }
  }
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    base: "./",
    server: {
      port: 3000,
      strictPort: true,
    },
    plugins: [neutralinoExportPlugin()],
  },
  nitro: {
    prerender: {
      routes: ["/"],
      crawlLinks: true,
    },
  } as any,
});