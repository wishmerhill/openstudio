import JSZip from "jszip";
import saveAs from 'file-saver';
import type { TourProject, Hotspot } from "@/types/tour";
import { getBlob, IDB_PREFIX } from "./idb";

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tour";

export function exportJson(project: TourProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  saveAs(blob, `${slug(project.name)}.json`);
}

/** Genera l'HTML SVG per un marker in base al tipo (stessa logica dell'editor) */
function markerSvg(type: string): string {
  const baseStyle = "width:36px;height:36px;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);cursor:pointer;user-select:none";

  switch (type) {
    case "door":
      return `<div style="${baseStyle};background:#10b981"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><path d="M17 17.5v-11"/></svg></div>`;
    case "info":
      return `<div style="${baseStyle};background:#6366f1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>`;
    case "arrow":
    default:
      return `<div style="${baseStyle};background:#4f46e5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4"/><path d="M8 12h8"/></svg></div>`;
  }
}

// ─── Export 3D (Photo Sphere Viewer via ES Modules) ────────────────────────

function viewerHtml3D(project: TourProject) {
  const scenesJson = JSON.stringify(project.scenes.map((s) => ({
    id: s.id,
    name: s.name,
    panoramaUrl: s.panoramaUrl,
    defaultZoom: s.defaultZoom,
    hotspots: s.hotspots,
  })));

  const initialSceneId = project.initialSceneId || project.scenes[0]?.id || "";

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${project.name}</title>
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
  </style>
</head>
<body>
  <div id="viewer"></div>
  <div id="title">${project.name}</div>
  <div id="scene-list"></div>

  <script type="module">
    import { Viewer } from 'https://esm.sh/@photo-sphere-viewer/core@5';
    import { MarkersPlugin } from 'https://esm.sh/@photo-sphere-viewer/markers-plugin@5';

    const SCENES = ${scenesJson};
    let currentSceneId = "${initialSceneId}";
    let viewer = null;
    let markersPlugin = null;

    function getScene(id) {
      return SCENES.find(s => s.id === id) || null;
    }

    function markerHtml(type) {
      const baseStyle = "width:36px;height:36px;border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,0.3);cursor:pointer;user-select:none";
      if (type === "door") {
        return '<div style="' + baseStyle + ';background:#10b981"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><path d="M17 17.5v-11"/></svg></div>';
      }
      if (type === "info") {
        return '<div style="' + baseStyle + ';background:#6366f1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>';
      }
      return '<div style="' + baseStyle + ';background:#4f46e5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4"/><path d="M8 12h8"/></svg></div>';
    }

    function updateMarkers(scene) {
      if (!markersPlugin) return;
      markersPlugin.clearMarkers();
      (scene.hotspots || []).forEach(function(h) {
        markersPlugin.addMarker({
          id: h.id,
          position: { yaw: (h.yaw * Math.PI) / 180, pitch: (h.pitch * Math.PI) / 180 },
          size: { width: 36, height: 36 },
          anchor: "center center",
          tooltip: { content: h.tooltip || h.type, position: "top center", trigger: "hover" },
          html: markerHtml(h.type)
        });
      });
    }

    async function loadScene(sceneId) {
      const scene = getScene(sceneId);
      if (!scene) return;
      currentSceneId = sceneId;

      if (!viewer) {
        viewer = new Viewer({
          container: document.getElementById("viewer"),
          panorama: scene.panoramaUrl,
          navbar: false,
          mousemove: true,
          mousewheel: true,
          plugins: [[MarkersPlugin, {}]]
        });

        markersPlugin = viewer.getPlugin(MarkersPlugin);

        markersPlugin.addEventListener("select-marker", function(e) {
          const activeScene = getScene(currentSceneId);
          const hs = activeScene?.hotspots?.find(function(h) { return h.id === e.marker.id; });
          if (hs && hs.targetSceneId) {
            loadScene(hs.targetSceneId);
          } else if (hs && hs.tooltip) {
            alert(hs.tooltip);
          }
        });

        viewer.addEventListener("ready", function() { updateMarkers(scene); }, { once: true });
      } else {
        await viewer.setPanorama(scene.panoramaUrl);
        updateMarkers(scene);
      }

      document.getElementById("title").textContent = scene.name;

      const listEl = document.getElementById("scene-list");
      listEl.innerHTML = "";
      SCENES.forEach(function(s) {
        const btn = document.createElement("button");
        btn.textContent = s.name;
        if (s.id === sceneId) btn.className = "active";
        btn.onclick = function() { loadScene(s.id); };
        listEl.appendChild(btn);
      });
    }

    loadScene(currentSceneId);
  </script>
</body>
</html>
`;
}

// ─── Export 2D Offline (no external dependencies, works with file://) ──────

function viewerHtml2D(project: TourProject) {
  const scenesJson = JSON.stringify(project.scenes.map((s) => ({
    id: s.id,
    name: s.name,
    panoramaUrl: s.panoramaUrl,
    defaultZoom: s.defaultZoom,
    hotspots: s.hotspots,
  })));

  const initialSceneId = project.initialSceneId || project.scenes[0]?.id || "";

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${project.name}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui,sans-serif;overflow:hidden}
    #stage{position:relative;width:100vw;height:100vh;overflow:hidden;cursor:grab;background-repeat:no-repeat;background-color:#09090b}
    #stage.dragging{cursor:grabbing}
    .hs{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;
      padding:6px 10px;border-radius:999px;border:1px solid rgba(129,140,248,.6);
      background:rgba(24,24,27,.82);color:#e0e7ff;font-size:12px;cursor:pointer;backdrop-filter:blur(6px);
      white-space:nowrap;z-index:5}
    .hs:hover{background:rgba(79,70,229,.85);color:#fff}
    #title{position:absolute;top:20px;left:20px;z-index:10;padding:10px 16px;border-radius:12px;
      background:rgba(24,24,27,.75);border:1px solid rgba(63,63,70,.9);font-size:14px;font-weight:600;
      pointer-events:none;backdrop-filter:blur(6px)}
    #scene-list{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);z-index:10;
      display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
    #scene-list button{padding:8px 14px;border-radius:10px;border:1px solid #3f3f46;
      background:rgba(24,24,27,.8);color:#d4d4d8;font-size:12px;cursor:pointer;backdrop-filter:blur(4px)}
    #scene-list button.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
  </style>
</head>
<body>
  <div id="stage"></div>
  <div id="title">${project.name}</div>
  <div id="scene-list"></div>

  <script>
    var SCENES = ${scenesJson};
    var currentSceneId = "${initialSceneId}";
    var stage = document.getElementById("stage");
    var titleEl = document.getElementById("title");
    var scenesEl = document.getElementById("scene-list");
    var view = { yaw: 0, pitch: 0, zoom: 1 };

    function getScene(id) {
      for (var i = 0; i < SCENES.length; i++) {
        if (SCENES[i].id === id) return SCENES[i];
      }
      return null;
    }

    function render() {
      var s = getScene(currentSceneId);
      if (!s) return;
      var W = stage.clientWidth, H = stage.clientHeight;
      var fov = 110 / view.zoom, vfov = fov * (H / W);
      stage.style.backgroundImage = 'url("' + s.panoramaUrl + '")';
      var bgW = W * 360 / fov, bgH = H * 180 / vfov;
      stage.style.backgroundSize = bgW + "px " + bgH + "px";
      stage.style.backgroundPosition =
        (W / 2 - ((view.yaw + 180) / 360) * bgW) + "px " + (H / 2 - ((90 - view.pitch) / 180) * bgH) + "px";
      titleEl.textContent = s.name;

      // Hotspot
      stage.querySelectorAll(".hs").forEach(function(el) { el.remove(); });
      (s.hotspots || []).forEach(function(h) {
        var el = document.createElement("div");
        el.className = "hs";
        el.textContent = (h.type === "info" ? "i " : h.type === "arrow" ? "-> " : "[] ") + (h.tooltip || h.type);
        el.style.left = (W / 2 + ((h.yaw - view.yaw) / fov) * W) + "px";
        el.style.top = (H / 2 - ((h.pitch - view.pitch) / vfov) * H) + "px";
        el.onclick = function() {
          if (h.targetSceneId) { currentSceneId = h.targetSceneId; view.yaw = 0; view.pitch = 0; draw(); }
          else if (h.tooltip) alert(h.tooltip);
        };
        stage.appendChild(el);
      });
    }

    function draw() {
      render();
      scenesEl.innerHTML = "";
      SCENES.forEach(function(s) {
        var b = document.createElement("button");
        b.textContent = s.name;
        if (s.id === currentSceneId) b.className = "active";
        b.onclick = function() { currentSceneId = s.id; view.yaw = 0; view.pitch = 0; draw(); };
        scenesEl.appendChild(b);
      });
    }

    // Drag to pan
    var dragging = false, last = null;
    stage.addEventListener("pointerdown", function(e) { dragging = true; last = e; stage.classList.add("dragging"); });
    window.addEventListener("pointerup", function() { dragging = false; stage.classList.remove("dragging"); });
    window.addEventListener("pointermove", function(e) {
      if (!dragging || !last) return;
      var fov = 110 / view.zoom;
      view.yaw = Math.max(-180, Math.min(180, view.yaw - ((e.clientX - last.clientX) / stage.clientWidth) * fov));
      view.pitch = Math.max(-80, Math.min(80, view.pitch + ((e.clientY - last.clientY) / stage.clientHeight) * fov * (stage.clientHeight / stage.clientWidth)));
      last = e;
      render();
    });
    window.addEventListener("wheel", function(e) {
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      view.zoom = Math.max(0.6, Math.min(3, view.zoom * Math.exp(-dy * 0.0015)));
      render();
    }, { passive: false });
    window.addEventListener("resize", render);

    draw();
  </script>
</body>
</html>
`;
}

function extFromBlob(blob: Blob) {
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("webp")) return "webp";
  return "jpg";
}

async function buildZip(project: TourProject, htmlContent: string) {
  const zip = new JSZip();
  const panoramas = zip.folder("panoramas")!;
  const exported: TourProject = { ...project, scenes: [] };

  for (const [index, scene] of project.scenes.entries()) {
    let url = scene.panoramaUrl;
    if (url.startsWith(IDB_PREFIX)) {
      const blob = await getBlob(url);
      if (blob) {
        const filename = `${slug(scene.name) || "scene"}-${index + 1}.${extFromBlob(blob)}`;
        panoramas.file(filename, blob);
        url = `panoramas/${filename}`;
      } else {
        url = "";
      }
    }
    exported.scenes.push({ ...scene, panoramaUrl: url });
  }

  zip.file("index.html", htmlContent);
  return zip;
}

export async function exportZip3D(project: TourProject) {
  const exported: TourProject = { ...project, scenes: [] };
  const zip = new JSZip();
  const panoramas = zip.folder("panoramas")!;

  for (const [index, scene] of project.scenes.entries()) {
    let url = scene.panoramaUrl;
    if (url.startsWith(IDB_PREFIX)) {
      const blob = await getBlob(url);
      if (blob) {
        const filename = `${slug(scene.name) || "scene"}-${index + 1}.${extFromBlob(blob)}`;
        panoramas.file(filename, blob);
        url = `panoramas/${filename}`;
      } else {
        url = "";
      }
    }
    exported.scenes.push({ ...scene, panoramaUrl: url });
  }

  zip.file("index.html", viewerHtml3D(exported));
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${slug(project.name)}-tour-3d.zip`);
}

export async function exportZip2D(project: TourProject) {
  const exported: TourProject = { ...project, scenes: [] };
  const zip = new JSZip();
  const panoramas = zip.folder("panoramas")!;

  for (const [index, scene] of project.scenes.entries()) {
    let url = scene.panoramaUrl;
    if (url.startsWith(IDB_PREFIX)) {
      const blob = await getBlob(url);
      if (blob) {
        const filename = `${slug(scene.name) || "scene"}-${index + 1}.${extFromBlob(blob)}`;
        panoramas.file(filename, blob);
        url = `panoramas/${filename}`;
      } else {
        url = "";
      }
    }
    exported.scenes.push({ ...scene, panoramaUrl: url });
  }

  zip.file("index.html", viewerHtml2D(exported));
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${slug(project.name)}-tour-2d.zip`);
}

// Legacy alias
export const exportZip = exportZip3D;