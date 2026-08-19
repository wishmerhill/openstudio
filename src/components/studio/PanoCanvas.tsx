import { useCallback, useEffect, useRef, useState } from "react";
import { DoorOpen, Info, MoveRight, Minus, Plus, Crosshair } from "lucide-react";
import type { Scene } from "@/types/tour";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/markers-plugin/index.css";

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
  const [zoom, setZoom] = useState(scene?.defaultZoom ?? 1);
  const [toast, setToast] = useState<string | null>(null);

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
      mousewheel: false,
      mousemove: true,
      useXmpData: false,
      autorotateSpeed: 0,       // <-- BLOCCA la rotazione automatica
      autorotateDelay: null,    // <-- DISABILITA il timer di autorotazione
      moveSpeed: 1,            // <-- Velocità di trascinamento normale
      plugins: [[MarkersPlugin]],
    });

    // Blocca qualsiasi tentativo di autorotazione residua
    try {
      if (viewer.isAutorotateEnabled?.()) {
        viewer.stopAutorotate?.();
      }
    } catch (e) {
      // ignore
    }

    viewerRef.current = viewer;

    const onClick = (e: any) => {
      const pitch = e?.pitch ?? e?.data?.pitch ?? 0;
      const yaw = e?.yaw ?? e?.data?.yaw ?? 0;
      if (mode === "editor") {
        if (placing) {
          onAddHotspot(Number(pitch.toFixed?.(1) ?? pitch), Number(yaw.toFixed?.(1) ?? yaw));
          return;
        }
        if (selectedHotspotId) {
          onMoveHotspot(selectedHotspotId, Number(pitch.toFixed?.(1) ?? pitch), Number(yaw.toFixed?.(1) ?? yaw));
          return;
        }
      }
    };
    viewer.on?.("click", onClick);

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
        viewer.off?.("click", onClick);
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

  // 2. Sincronizzazione Marker e Gestione Interazioni Hotspot
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const markers = viewer.getPlugin?.(MarkersPlugin) ?? null;
    markersRef.current = markers;

    const syncMarkers = () => {
      if (!markersRef.current) return;
      const markersList = (scene?.hotspots ?? []).map((h) => ({
        id: h.id,
        longitude: h.yaw,
        latitude: h.pitch,
        tooltip: h.tooltip ?? h.type,
        data: { hotspotId: h.id },
        style: { width: 28, height: 28 },
      }));
      try {
        markersRef.current.clearMarkers?.();
      } catch (e) {
        // ignore
      }
      if (markersRef.current.setMarkers) markersRef.current.setMarkers(markersList);
      else if (markersRef.current.addMarker) {
        for (const m of markersList) markersRef.current.addMarker(m);
      }
    };

    const onSelectMarker = (e: any) => {
      const markerId = e?.marker?.id ?? e?.id ?? null;
      if (!markerId) return;
      const hs = scene?.hotspots.find((h) => h.id === markerId) ?? null;
      if (!hs) return;
      if (mode === "editor") {
        onSelectHotspot(markerId);
        return;
      }
      if ((hs.type === "door" || hs.type === "arrow") && hs.targetSceneId) {
        onNavigate(hs.targetSceneId);
        return;
      }
      setToast(hs.tooltip || "No information");
      window.setTimeout(() => setToast(null), 2600);
    };

    const alreadyLoaded = !!viewer.getPanorama?.();
    if (alreadyLoaded) syncMarkers();
    viewer.on?.("panorama-loaded", syncMarkers);

    try {
      markersRef.current?.on?.("select-marker", onSelectMarker);
      markersRef.current?.on?.("click-marker", onSelectMarker);
    } catch (e) {
      // ignore
    }

    return () => {
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
  }, [scene?.hotspots, imageUrl, mode]);

  // 3. Gestione Zoom e Resize
  const applyZoom = useCallback(
    (next: number) => {
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      setZoom(clamped);
      onZoomChange(Number(clamped.toFixed(2)));
    },
    [onZoomChange],
  );

  const zoomRef = useRef(applyZoom);
  zoomRef.current = applyZoom;
  const currentZoom = useRef(zoom);
  currentZoom.current = zoom;

  /* useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      zoomRef.current(currentZoom.current * Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []); */

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

      <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur z-10">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => applyZoom(zoom * 1.2)}>
          <Plus className="h-4 w-4" />
        </Button>
        <div className="px-1 text-center text-[10px] tabular-nums text-muted-foreground">
          {zoom.toFixed(1)}x
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => applyZoom(zoom / 1.2)}>
          <Minus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}