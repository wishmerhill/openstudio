import JSZip from "jszip";
import saveAs from 'file-saver';
import type { TourProject } from "@/types/tour";
import { getBlob, IDB_PREFIX } from "./idb";

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tour";

export function exportJson(project: TourProject) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  saveAs(blob, `${slug(project.name)}.json`);
}

function viewerHtml(project: TourProject) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${project.name}</title>
    <style>
      *{box-sizing:border-box}
      body{margin:0;background:#09090b;color:#f4f4f5;font-family:system-ui,sans-serif;overflow:hidden}
      #stage{position:relative;width:100vw;height:100vh;overflow:hidden;cursor:grab;background-repeat:no-repeat}
      #stage.dragging{cursor:grabbing}
      .hs{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;
        padding:6px 10px;border-radius:999px;border:1px solid rgba(129,140,248,.6);
        background:rgba(24,24,27,.82);color:#e0e7ff;font-size:12px;cursor:pointer;backdrop-filter:blur(6px)}
      .hs:hover{background:rgba(79,70,229,.85);color:#fff}
      #title{position:absolute;top:20px;left:20px;padding:10px 16px;border-radius:12px;
        background:rgba(24,24,27,.75);border:1px solid rgba(63,63,70,.9);font-size:14px;font-weight:600}
      #scenes{position:absolute;bottom:20px;left:20px;display:flex;gap:8px;flex-wrap:wrap}
      #scenes button{padding:8px 12px;border-radius:10px;border:1px solid #3f3f46;background:rgba(24,24,27,.8);
        color:#d4d4d8;font-size:12px;cursor:pointer}
      #scenes button.active{background:#4f46e5;color:#fff;border-color:#4f46e5}
    </style>
  </head>
  <body>
    <div id="stage"></div>
    <div id="title"></div>
    <div id="scenes"></div>
    <script src="tour-data.js"></script>
    <script>
      var data = window.TOUR_DATA;
      var stage = document.getElementById("stage");
      var titleEl = document.getElementById("title");
      var scenesEl = document.getElementById("scenes");
      var current = data.initialSceneId || (data.scenes[0] && data.scenes[0].id);
      var view = { yaw: 0, pitch: 0, zoom: 1 };

      function scene() { return data.scenes.filter(function (s) { return s.id === current; })[0]; }

      function render() {
        var s = scene();
        if (!s) return;
        var W = stage.clientWidth, H = stage.clientHeight;
        var fov = 110 / view.zoom, vfov = fov * (H / W);
        stage.style.backgroundImage = 'url("' + s.panoramaUrl + '")';
        var bgW = W * 360 / fov, bgH = H * 180 / vfov;
        stage.style.backgroundSize = bgW + "px " + bgH + "px";
        stage.style.backgroundPosition =
          (W / 2 - ((view.yaw + 180) / 360) * bgW) + "px " + (H / 2 - ((90 - view.pitch) / 180) * bgH) + "px";
        titleEl.textContent = data.theme && data.theme.showTitleOverlay ? data.name + " — " + s.name : "";
        stage.innerHTML = "";
        (s.hotspots || []).forEach(function (h) {
          var el = document.createElement("div");
          el.className = "hs";
          el.textContent = (h.type === "info" ? "i " : h.type === "arrow" ? "-> " : "[] ") + (h.tooltip || h.type);
          el.style.left = (W / 2 + ((h.yaw - view.yaw) / fov) * W) + "px";
          el.style.top = (H / 2 - ((h.pitch - view.pitch) / vfov) * H) + "px";
          el.onclick = function () {
            if (h.targetSceneId) { current = h.targetSceneId; view.yaw = 0; view.pitch = 0; draw(); }
            else if (h.tooltip) alert(h.tooltip);
          };
          stage.appendChild(el);
        });
      }

      function draw() {
        render();
        scenesEl.innerHTML = "";
        data.scenes.forEach(function (s) {
          var b = document.createElement("button");
          b.textContent = s.name;
          if (s.id === current) b.className = "active";
          b.onclick = function () { current = s.id; view.yaw = 0; view.pitch = 0; draw(); };
          scenesEl.appendChild(b);
        });
      }

      var dragging = false, last = null;
      stage.addEventListener("pointerdown", function (e) { dragging = true; last = e; stage.classList.add("dragging"); });
      window.addEventListener("pointerup", function () { dragging = false; stage.classList.remove("dragging"); });
      window.addEventListener("pointermove", function (e) {
        if (!dragging || !last) return;
        var fov = 110 / view.zoom;
        view.yaw = Math.max(-180, Math.min(180, view.yaw - ((e.clientX - last.clientX) / stage.clientWidth) * fov));
        view.pitch = Math.max(-80, Math.min(80, view.pitch + ((e.clientY - last.clientY) / stage.clientHeight) * fov * (stage.clientHeight / stage.clientWidth)));
        last = e;
        render();
      });
      window.addEventListener("wheel", function (e) {
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

export async function exportZip(project: TourProject) {
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

  zip.file("tour-data.js", `window.TOUR_DATA = ${JSON.stringify(exported, null, 2)};\n`);
  zip.file("tour.json", JSON.stringify(project, null, 2));
  zip.file("index.html", viewerHtml(exported));
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${slug(project.name)}-tour.zip`);
}