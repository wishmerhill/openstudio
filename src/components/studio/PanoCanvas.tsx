import { useCallback, useEffect, useRef, useState } from "react";
import { DoorOpen, Info, MoveRight, Minus, Plus, Crosshair, X } from "lucide-react";
import type { Scene } from "@/types/tour";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";
import ReactMarkdown from "react-markdown";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;

interface Props {
  scene: Scene | null;
  imageUrl: string;
  mode: "editor" | "preview";
  placing: boolean;
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string | null) => void;
  onAddHotspot: (pitch: number, yaw: number) => void;
  onMoveHotspot: (id: string, pitch: number, yaw: number) => void;
  onNavigate: (sceneId: string) => void;
  onZoomChange: (zoom: number) => void;
}

export function PanoCanvas({
  scene,
  imageUrl,
  mode,
  placing,
  selectedHotspotId,
  onSelectHotspot,
  onAddHotspot,
  onMoveHotspot,
  onNavigate,
  onZoomChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any | null>(null);
  const markersRef = useRef<any | null>(null);
  // Mappa che tiene traccia della posizione corrente di ogni marker in radianti
  const markerPositionsRef = useRef<Map<string, { yaw: number; pitch: number }>>(new Map());
  // refs to avoid stale closures in viewer event handlers
  const placingRef = useRef(placing);
  placingRef.current = placing;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const selectedHotspotIdRef = useRef<string | null>(selectedHotspotId);
  selectedHotspotIdRef.current = selectedHotspotId;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [zoom, setZoom] = useState(scene?.defaultZoom ?? 1);
  const [toast, setToast] = useState<string | null>(null);
  const [infoPopup, setInfoPopup] = useState<{ title: string; content: string } | null>(null);

  // 1. Inizializzazione Viewer (Eseguito una sola volta per URL immagine)
  useEffect(() => {
    const currentSceneUrl = imageUrl;
    const el = containerRef.current;
    if (!el || !currentSceneUrl) return;

    if (viewerRef.current) {
      try {
        const existing = viewerRef.current.getPanorama?.();
        if (existing === currentSceneUrl) return;
      } catch (e) {
        // ignore
      }
      try {
        viewerRef.current.destroy();
      } catch (e) {
        // ignore
      }
      viewerRef.current = null;
      markersRef.current = null;
    }

    console.log("Inizializzazione Viewer per:", currentSceneUrl);

    const viewer = new Viewer({
      container: el,
      panorama: currentSceneUrl,
      defaultYaw: 0,
      defaultPitch: 0,
      navbar: false,
      mousewheel: true,
      mousewheelCtrlKey: false,
      zoomSpeed: 1,
      minFov: 30,
      maxFov: 90,
      defaultZoomLvl: 1,
      mousemove: true,
      moveSpeed: 1,
      plugins: [MarkersPlugin],
    });

    try {
      if (viewer.isAutorotateEnabled?.()) {
        viewer.stopAutorotate?.();
      }
    } catch (e) {
      // ignore
    }

    viewerRef.current = viewer;

    const onClick = (data: any) => {
      const pitchRad = data?.latitude ?? data?.pitch ?? data?.data?.latitude ?? data?.data?.pitch ?? 0;
      const yawRad = data?.longitude ?? data?.yaw ?? data?.data?.longitude ?? data?.data?.yaw ?? 0;

      const pitch = (pitchRad * 180) / Math.PI;
      const yaw = (yawRad * 180) / Math.PI;

      if (modeRef.current === "editor") {
        if (placingRef.current) {
          onAddHotspot(Number(pitch.toFixed?.(3) ?? pitch), Number(yaw.toFixed?.(3) ?? yaw));
          return;
        }
        // Se c'è un marker selezionato e clicchiamo sulla scena, deseleziona
        if (selectedHotspotIdRef.current) {
          onSelectHotspot(null);
          return;
        }
      }
    };

    if (viewer.addEventListener) viewer.addEventListener("click", onClick);
    else viewer.on?.("click", onClick);

    const onZoom = (ev: any) => {
      const z = ev?.ratio ?? ev?.zoom ?? 1;
      setZoom(z);
      onZoomChange(Number(z));
    };
    viewer.on?.("zoom-updated", onZoom);

    setTimeout(() => {
      try {
        viewer.needsUpdate?.();
      } catch (e) {
        try {
          viewer.resize?.();
        } catch (er) {
          // ignore
        }
      }
    }, 100);

    return () => {
      console.log("Distruzione istanza Viewer per:", currentSceneUrl);
      try {
        if (viewer.removeEventListener) viewer.removeEventListener("click", onClick);
        else viewer.off?.("click", onClick);
        viewer.off?.("zoom-updated", onZoom);
        viewer.destroy?.();
      } catch (e) {
        // ignore
      }
      viewerRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // Helper per generare l'HTML del marker in base al tipo e allo stato di selezione
  const getMarkerHtml = (type: string, selected: boolean = false): string => {
    const borderColor = selected ? "#ff69b4" : "#fff";
    const glow = selected ? "0 0 12px 4px rgba(255,105,180,0.7),0 10px 15px -3px rgba(0,0,0,0.3)" : "0 10px 15px -3px rgba(0,0,0,0.3)";
    const baseStyle = `width:36px;height:36px;border:3px solid ${borderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:${glow};cursor:grab;user-select:none`;

    switch (type) {
      case "door":
        return `<div style="${baseStyle};background:#10b981"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/><path d="M17 17.5v-11"/></svg></div>`;
      case "info":
        return `<div style="${baseStyle};background:#6366f1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>`;
      case "arrow":
      default:
        return `<div style="${baseStyle};background:#4f46e5"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4"/><path d="M8 12h8"/></svg></div>`;
    }
  };

  // 2. Sincronizzazione Marker e Gestione Interazioni Hotspot
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let markers = null;
    try {
      markers = viewer.getPlugin(MarkersPlugin);
    } catch (e) {
      console.log("getPlugin(MarkersPlugin) fallito", e);
    }
    markersRef.current = markers;

    const dragState: {
      markerId: string | null;
      dragging: boolean;
      initYawRad: number;
      initPitchRad: number;
      mouseStartX: number;
      mouseStartY: number;
      finalYawRad?: number;
      finalPitchRad?: number;
    } = { markerId: null, dragging: false, initYawRad: 0, initPitchRad: 0, mouseStartX: 0, mouseStartY: 0 };

    const syncMarkers = () => {
      if (!markersRef.current) return;

      const hotspots = scene?.hotspots ?? [];
      const posMap = markerPositionsRef.current;

      try {
        markersRef.current.clearMarkers();
      } catch (e) {
        // ignore
      }

      hotspots.forEach((h) => {
        const pitchDeg = typeof h.pitch === "number" ? h.pitch : parseFloat(h.pitch || "0");
        const yawDeg = typeof h.yaw === "number" ? h.yaw : parseFloat(h.yaw || "0");
        const pitchRad = (pitchDeg * Math.PI) / 180;
        const yawRad = (yawDeg * Math.PI) / 180;

        // Aggiorna la mappa delle posizioni con i dati correnti della scena
        posMap.set(h.id, { yaw: yawRad, pitch: pitchRad });

        try {
          markersRef.current.addMarker({
            id: h.id,
            position: { yaw: yawRad, pitch: pitchRad },
            size: { width: 36, height: 36 },
            anchor: "center center",
            tooltip: {
              content: h.tooltip || h.type,
              position: "top center",
              trigger: "hover",
            },
            data: { hotspotId: h.id },
            html: getMarkerHtml(h.type, h.id === selectedHotspotId),
          });
        } catch (err) {
          console.error("Errore aggiunta marker:", err);
        }
      });
    };

    const onSelectMarker = (e: any) => {
      const markerId = e?.marker?.id ?? e?.id ?? null;
      if (!markerId) return;
      // Usa sceneRef per evitare stale closure
      const currentScene = sceneRef.current;
      if (!currentScene) return;
      const hs = currentScene.hotspots.find((h) => h.id === markerId) ?? null;
      if (!hs) return;

      if (modeRef.current === "editor") {
        onSelectHotspot(markerId);
        return;
      }

      // Preview mode
      if (hs.type === "info") {
        // Info marker: show popup with Markdown content
        if (hs.content) {
          setInfoPopup({ title: hs.tooltip || "Info", content: hs.content });
        } else {
          setToast(hs.tooltip || "No information");
          window.setTimeout(() => setToast(null), 2600);
        }
        return;
      }

      // Navigation markers (door, arrow)
      if (hs.targetSceneId) {
        onNavigate(hs.targetSceneId);
        return;
      }
      setToast(hs.tooltip || "No information");
      window.setTimeout(() => setToast(null), 2600);
    };

    // Sincronizza i marker dopo un breve ritardo per assicurare che il panorama sia caricato
    const initialSyncTimer = window.setTimeout(() => {
      syncMarkers();

      // Dopo aver creato i marker, attacha i listener in base alla modalità
      if (markersRef.current) {
        try {
          const allMarkers = markersRef.current.getMarkers?.();
          if (allMarkers) {
            allMarkers.forEach((m: any) => {
              const el = m.element as HTMLElement | undefined;
              if (!el) return;

              if (modeRef.current === "editor") {
                el.style.cursor = "grab";

                el.addEventListener("mousedown", (e: MouseEvent) => {
                  if (modeRef.current !== "editor") return;
                  e.stopPropagation();
                  e.preventDefault();

                  // Seleziona il marker — apre la sidebar
                  onSelectHotspot(m.id);

                  const viewer = viewerRef.current;
                  if (!viewer) return;

                  // Disabilita la rotazione della camera durante il drag
                  try {
                    viewer.setOption('mousemove', false);
                  } catch (_) {}

                  // Leggi posizione corrente dalla mappa (ref, sempre aggiornata)
                  const saved = markerPositionsRef.current.get(m.id);
                  const initYawRad = saved?.yaw ?? 0;
                  const initPitchRad = saved?.pitch ?? 0;

                  // Salva stato iniziale
                  dragState.markerId = m.id;
                  dragState.dragging = true;
                  dragState.initYawRad = initYawRad;
                  dragState.initPitchRad = initPitchRad;
                  dragState.mouseStartX = e.clientX;
                  dragState.mouseStartY = e.clientY;

                  // Sensibilità: 0.3° per pixel di movimento mouse
                  const radPerPx = (0.3 * Math.PI) / 180;

                  const onMouseMove = (ev: MouseEvent) => {
                    if (!dragState.dragging || !dragState.markerId || !containerRef.current) return;

                    const dx = ev.clientX - dragState.mouseStartX;
                    const dy = ev.clientY - dragState.mouseStartY;

                    const containerWidth = containerRef.current.clientWidth || 1000;
                    const containerHeight = containerRef.current.clientHeight || 600;

                    const viewer = viewerRef.current;
                    if (!viewer) return;

                    // 1. Recupera il FOV verticale REALE corrente di PSV v5 (in radianti)
                    let vFovRad = Math.PI / 3; // Fallback ~60°
                    try {
                      const defaultFovDeg = viewer.getOption?.("defaultFov") ?? 60;
                      vFovRad = viewer.state?.vFov ?? (defaultFovDeg * Math.PI) / 180;
                    } catch (_) {}

                    // 2. Calcolo trigonomerico dell'angolo di spostamento esatto
                    const halfH = containerHeight / 2;
                    const tanHalfVFov = Math.tan(vFovRad / 2);

                    const yawDelta = Math.atan((dx / halfH) * tanHalfVFov);
                    const pitchDelta = Math.atan((dy / halfH) * tanHalfVFov);

                    // 3. Nuove coordinate traslate
                    const newYawRad = dragState.initYawRad + yawDelta;
                    const newPitchRad = Math.max(
                      -Math.PI / 2 + 0.01,
                      Math.min(Math.PI / 2 - 0.01, dragState.initPitchRad - pitchDelta)
                    );

                    try {
                      markersRef.current?.updateMarker?.({
                        id: dragState.markerId,
                        position: { yaw: newYawRad, pitch: newPitchRad },
                      });

                      markerPositionsRef.current.set(dragState.markerId, {
                        yaw: newYawRad,
                        pitch: newPitchRad,
                      });
                      dragState.finalYawRad = newYawRad;
                      dragState.finalPitchRad = newPitchRad;
                    } catch (er) {
                      // ignore
                    }
                  };

                  const onMouseUp = () => {
                    dragState.dragging = false;

                    // Riabilita la rotazione della camera
                    try {
                      viewer.setOption('mousemove', true);
                    } catch (_) {}

                    if (dragState.markerId && dragState.finalYawRad !== undefined && dragState.finalPitchRad !== undefined) {
                      const yawDeg = (dragState.finalYawRad * 180) / Math.PI;
                      const pitchDeg = (dragState.finalPitchRad * 180) / Math.PI;
                      onMoveHotspot(dragState.markerId, Number(pitchDeg.toFixed(3)), Number(yawDeg.toFixed(3)));
                    }
                    dragState.markerId = null;
                    delete dragState.finalYawRad;
                    delete dragState.finalPitchRad;
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                  };

                  window.addEventListener("mousemove", onMouseMove);
                  window.addEventListener("mouseup", onMouseUp);
                });
              } else {
                // Preview mode: cursore pointer su qualsiasi marker
                el.style.cursor = "pointer";

                // Hover glow in preview: evidenzia il marker con bordo glow azzurro
                el.addEventListener("mouseenter", () => {
                  el.style.filter = "brightness(1.3) drop-shadow(0 0 6px rgba(59,130,246,0.9))";
                });
                el.addEventListener("mouseleave", () => {
                  el.style.filter = "";
                });

                // Click diretto sul marker in preview per navigare
                // (fallback nel caso select-marker di PSV non venga emesso)
                el.addEventListener("click", (e: MouseEvent) => {
                  if (modeRef.current !== "preview") return;
                  e.stopPropagation();
                  e.preventDefault();

                  const currentScene = sceneRef.current;
                  if (!currentScene) return;
                  const hs = currentScene.hotspots.find((h) => h.id === m.id);
                  if (!hs) return;

                  if (hs.type === "info") {
                    // Info marker: show popup with Markdown content
                    if (hs.content) {
                      setInfoPopup({ title: hs.tooltip || "Info", content: hs.content });
                    } else {
                      setToast(hs.tooltip || "No information");
                      window.setTimeout(() => setToast(null), 2600);
                    }
                    return;
                  }

                  if (hs.targetSceneId) {
                    onNavigate(hs.targetSceneId);
                  } else {
                    setToast(hs.tooltip || "No information");
                    window.setTimeout(() => setToast(null), 2600);
                  }
                });
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }
    }, 500);
    viewer.on?.("panorama-loaded", syncMarkers);

    try {
      markersRef.current?.on?.("select-marker", onSelectMarker);
      markersRef.current?.on?.("click-marker", onSelectMarker);
    } catch (e) {
      // ignore
    }

    return () => {
      window.clearTimeout(initialSyncTimer);
      dragState.dragging = false;
      dragState.markerId = null;
      try {
        markersRef.current?.off?.("select-marker", onSelectMarker);
        markersRef.current?.off?.("click-marker", onSelectMarker);
        viewer.off?.("panorama-loaded", syncMarkers);
      } catch (e) {
        // ignore
      }
      try {
        markersRef.current?.clearMarkers?.();
      } catch (e) {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.hotspots, imageUrl, mode, selectedHotspotId]);

  // 3b. Chiusura popup info con tasto ESC
  useEffect(() => {
    if (!infoPopup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInfoPopup(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [infoPopup]);

  // 4. Gestione Zoom e Resize
  const zoomIn = useCallback(() => {
    try {
      const v = viewerRef.current;
      if (!v) return;
      v.zoomIn(15);
      const newZoom = v.getZoomLevel?.() ?? 1;
      setZoom(newZoom);
      onZoomChange(Number(newZoom));
    } catch (e) {
      // ignore
    }
  }, [onZoomChange]);

  const zoomOut = useCallback(() => {
    try {
      const v = viewerRef.current;
      if (!v) return;
      v.zoomOut(15);
      const newZoom = v.getZoomLevel?.() ?? 1;
      setZoom(newZoom);
      onZoomChange(Number(newZoom));
    } catch (e) {
      // ignore
    }
  }, [onZoomChange]);

  const zoomRef = useRef(zoomIn);
  zoomRef.current = zoomIn;
  const currentZoom = useRef(zoom);
  currentZoom.current = zoom;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      const v = viewerRef.current;
      if (!v) return;
      if (dy < 0) {
        v.zoomIn(15);
      } else {
        v.zoomOut(15);
      }
      const newZoom = v.getZoomLevel?.() ?? 1;
      setZoom(newZoom);
      onZoomChange(Number(newZoom));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onZoomChange]);

  return (
    <div className="relative flex-1 overflow-hidden bg-background">
      <div
        ref={containerRef}
        className={cn(
          "relative w-full h-full min-h-[500px] overflow-hidden touch-none select-none",
        )}
      />

      {placing && mode === "editor" && (
        <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/60 bg-card/90 px-3 py-1.5 text-xs text-foreground z-10">
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          Click on the panorama to place the hotspot
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 max-w-sm -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-2.5 text-sm text-foreground shadow-lg z-10">
          {toast}
        </div>
      )}

      {/* Info marker popup */}
      {infoPopup && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/40"
          onClick={() => setInfoPopup(null)}
        >
          <div
            className="mx-4 max-h-[80vh] max-w-lg overflow-y-auto rounded-xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">{infoPopup.title}</h3>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setInfoPopup(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="prose prose-sm prose-invert max-w-none px-4 py-3">
              <ReactMarkdown>{infoPopup.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur z-10">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={zoomIn}>
          <Plus className="h-4 w-4" />
        </Button>
        <div className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">
          {zoom.toFixed(1)}x
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={zoomOut}>
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}