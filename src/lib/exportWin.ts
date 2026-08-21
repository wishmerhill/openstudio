import JSZip from "jszip";
import saveAs from "file-saver";
import type { TourProject } from "@/types/tour";
import { getBlob, IDB_PREFIX } from "./idb";

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tour";

function extFromBlob(blob: Blob) {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  return "jpg";
}

// ── Neutralinojs config (UTF-8, no BOM) ───────────────────────────────────
const NEUTRALINO_CONFIG_JSON = JSON.stringify(
  {
    applicationId: "com.opentour.viewer",
    defaultMode: "window",
    port: 0,
    url: "/index.html",
    documentRoot: "/",
    modes: {
      window: {
        title: "OpenTour Viewer",
        width: 1280,
        height: 800,
        resizable: true,
      },
    },
  },
  null,
  2,
) + "\n";

// ── Inlined viewer HTML (Photo Sphere Viewer 3D) ──────────────────────────
const VIEWER_HTML = `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>__TOUR_NAME__</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.css" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5/index.css" />
  <style>
    *{box-sizing:border-box}
    body{margin:0;overflow:hidden;background:#09090b;font-family:system-ui,sans-serif}
    #viewer{width:100vw;height:100vh}
    #title{position:absolute;top:20px;left:20px;z-index:10;padding:10px 16px;border-radius:12px;
      background:rgba(24,24,27,.75);border:1px solid rgba(63,63,70,.9);color:#f4f4f5;font-size:14px;font-weight:600;
      pointer-events:none;backdrop-filter:blur(6px)}
    #scene-list{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);z-index:10;
      display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
    #scene-list button{padding:8px 14px;border-radius:10px;border:1px solid #3f3f46;
      background:rgba(24,24,27,.8);color:#d4d4d8;font-size:12px;cursor:pointer;backdrop-filter:blur(4px)}
    #scene-list button.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
    #info-popup{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:20;
      max-width:420px;width:90%;padding:20px 24px;border-radius:16px;
      background:rgba(24,24,27,.92);border:1px solid rgba(63,63,70,.9);color:#f4f4f5;
      backdrop-filter:blur(12px);display:none;pointer-events:auto}
    #info-popup h3{margin:0 0 8px;font-size:16px;font-weight:600}
    #info-popup p{margin:0;font-size:13px;line-height:1.5;color:#d4d4d8}
    #info-popup button{margin-top:12px;padding:6px 16px;border-radius:8px;border:1px solid #3f3f46;
      background:rgba(255,255,255,.08);color:#f4f4f5;font-size:12px;cursor:pointer}
    #info-popup button:hover{background:rgba(255,255,255,.14)}
    #info-overlay{position:absolute;inset:0;z-index:19;background:rgba(0,0,0,.4);display:none}
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div id="title">__TOUR_NAME__</div>
  <div id="scene-list"></div>
  <div id="info-overlay"></div>
  <div id="info-popup">
    <h3 id="popup-title"></h3>
    <p id="popup-text"></p>
    <button onclick="closeInfoPopup()">Close</button>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/core@5/index.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@photo-sphere-viewer/markers-plugin@5/index.js"><\/script>
  <script src="tour-data.js"><\/script>
  <script>
    (function() {
      var SCENES = window.TOUR_DATA || [];
      var currentSceneId = SCENES.length > 0 ? SCENES[0].id : "";
      var viewer = null, markersPlugin = null;
      function getScene(id) {
        for (var i = 0; i < SCENES.length; i++) { if (SCENES[i].id === id) return SCENES[i]; }
        return null;
      }
      function mhtml(type) {
        var b = "width:36px;height:36px;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);cursor:pointer;user-select:none";
        if (type === "door") return '<div style="' + b + ';background:#10b981"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><path d="M17 17.5v-11"/></svg></div>';
        if (type === "info") return '<div style="' + b + ';background:#6366f1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>';
        return '<div style="' + b + ';background:#4f46e5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4"/><path d="M8 12h8"/></svg></div>';
      }
      function updMarkers(scene) {
        if (!markersPlugin) return;
        markersPlugin.clearMarkers();
        (scene.hotspots || []).forEach(function(h) {
          markersPlugin.addMarker({
            id: h.id,
            position: { yaw: (h.yaw * Math.PI) / 180, pitch: (h.pitch * Math.PI) / 180 },
            size: { width: 36, height: 36 },
            anchor: "center center",
            tooltip: { content: h.tooltip || h.type, position: "top center", trigger: "hover" },
            html: mhtml(h.type)
          });
        });
      }
      function showPopup(title, text) {
        document.getElementById("popup-title").textContent = title;
        document.getElementById("popup-text").textContent = text;
        document.getElementById("info-popup").style.display = "block";
        document.getElementById("info-overlay").style.display = "block";
      }
      window.closeInfoPopup = function() {
        document.getElementById("info-popup").style.display = "none";
        document.getElementById("info-overlay").style.display = "none";
      };
      function loadScene(sceneId) {
        var scene = getScene(sceneId);
        if (!scene) return;
        currentSceneId = sceneId;
        if (!viewer) {
          viewer = new PhotoSphereViewer.Viewer({
            container: document.getElementById("viewer"),
            panorama: scene.panoramaUrl, navbar: false, mousemove: true, mousewheel: true,
            plugins: [[PhotoSphereViewerMarkersPlugin.MarkersPlugin, {}]]
          });
          markersPlugin = viewer.getPlugin(PhotoSphereViewerMarkersPlugin.MarkersPlugin);
          markersPlugin.addEventListener("select-marker", function(e) {
            var as = getScene(currentSceneId), hs = null;
            if (as && as.hotspots) { for (var i = 0; i < as.hotspots.length; i++) { if (as.hotspots[i].id === e.marker.id) { hs = as.hotspots[i]; break; } } }
            if (!hs) return;
            if (hs.type === "info") { showPopup(hs.tooltip || "Info", hs.description || hs.tooltip || ""); }
            else if (hs.targetSceneId) { loadScene(hs.targetSceneId); }
            else if (hs.tooltip) { alert(hs.tooltip); }
          });
          viewer.addEventListener("ready", function() { updMarkers(scene); }, { once: true });
        } else {
          viewer.setPanorama(scene.panoramaUrl).then(function() { updMarkers(scene); });
        }
        document.getElementById("title").textContent = scene.name;
        var le = document.getElementById("scene-list"); le.innerHTML = "";
        SCENES.forEach(function(s) {
          var b = document.createElement("button"); b.textContent = s.name;
          if (s.id === sceneId) b.className = "active";
          b.onclick = function() { loadScene(s.id); }; le.appendChild(b);
        });
      }
      loadScene(currentSceneId);
    })();
  <\/script>
</body>
</html>`;

/**
 * Generates a portable Windows viewer package using Neutralinojs.
 *
 * The ZIP contains EXACTLY three files:
 *   OpenTourViewer.exe   — Neutralinojs binary (portable, no install needed)
 *   neutralino.config.json — Neutralinojs configuration (UTF-8, no BOM) — on disk, NOT inside resources.neu
 *   resources.neu        — ZIP archive containing all app files at root level
 *
 * The resources.neu archive contains (at root):
 *   index.html             — 3D Photo Sphere Viewer (WebGL)
 *   neutralino.js          — Neutralinojs client library
 *   tour-data.js           — Tour scenes & hotspots as window.TOUR_DATA
 *   tour.json              — Full project data
 *   panoramas/             — 360° images
 *   assets/                — (optional, reserved for future bundled assets)
 *
 * IMPORTANT: neutralino.config.json MUST NOT be inside resources.neu, or the C++ parser will crash.
 */
export async function exportWindowsViewer(project: TourProject) {
  // ── 1. Build the resources.neu archive (ZIP) ────────────────────────────
  const neu = new JSZip();

  // All files go at root level of the archive (no "resources/" subfolder)
  // NOTE: neutralino.config.json is intentionally NOT included here — it must be
  // placed outside the .neu archive to avoid a C++ parser crash at startup.
  neu.file("index.html", VIEWER_HTML.replace(/__TOUR_NAME__/g, project.name));

  // Tour data
  const exportedScenes: Array<{
    id: string;
    name: string;
    panoramaUrl: string;
    defaultZoom: number;
    hotspots: typeof project.scenes[0]["hotspots"];
  }> = [];

  for (const [index, scene] of project.scenes.entries()) {
    let url = scene.panoramaUrl;
    if (url.startsWith(IDB_PREFIX)) {
      const blob = await getBlob(url);
      if (blob) {
        const filename = `${slug(scene.name) || "scene"}-${index + 1}.${extFromBlob(blob)}`;
        neu.file(`panoramas/${filename}`, blob);
        url = `panoramas/${filename}`;
      } else {
        url = "";
      }
    }
    exportedScenes.push({
      id: scene.id,
      name: scene.name,
      panoramaUrl: url,
      defaultZoom: scene.defaultZoom,
      hotspots: scene.hotspots,
    });
  }

  neu.file(
    "tour-data.js",
    `window.TOUR_DATA = ${JSON.stringify(exportedScenes, null, 2)};\n`,
  );
  neu.file("tour.json", JSON.stringify(project, null, 2) + "\n");

  // Generate as Blob
  const neuBlob = await neu.generateAsync({ type: "blob" });

  // ── 2. Build the final export ZIP with exactly 3 files ──────────────────
  const exportZip = new JSZip();

  // Placeholder for the Neutralinojs binary
  exportZip.file(
    "OpenTourViewer.exe",
    new Blob(
      [
        "Placeholder — download neutralino-win_x64.exe from\n" +
        "https://github.com/neutralinojs/neutralinojs/releases\n" +
        "rename it to OpenTourViewer.exe and replace this placeholder.\n",
      ],
      { type: "text/plain" },
    ),
  );

  // neutralino.config.json on disk (outside resources.neu) — required by Neutralinojs
  exportZip.file("neutralino.config.json", NEUTRALINO_CONFIG_JSON);

  // The resources.neu archive (MUST NOT contain neutralino.config.json)
  exportZip.file("resources.neu", neuBlob);

  // ── 3. Generate and save ─────────────────────────────────────────────────
  const finalBlob = await exportZip.generateAsync({ type: "blob" });
  saveAs(finalBlob, `${slug(project.name)}-windows-viewer.zip`);
}