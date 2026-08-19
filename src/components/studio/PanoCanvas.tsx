import { useCallback, useEffect, useRef, useState } from "react";
import { DoorOpen, Info, MoveRight, Minus, Plus, Crosshair } from "lucide-react";
import type { Hotspot, Scene } from "@/types/tour";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Viewer } from "@photo-sphere-viewer/core";
import { MarkersPlugin } from "@photo-sphere-viewer/markers-plugin";
// Photo Sphere Viewer types can be a bit loose depending on version; use `any` where necessary

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3;
const BASE_FOV = 110;

const icons = { door: DoorOpen, info: Info, arrow: MoveRight } as const;

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
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [view, setView] = useState({ yaw: 0, pitch: 0 });
  const [zoom, setZoom] = useState(scene?.defaultZoom ?? 1);
  const [toast, setToast] = useState<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; hotspotId?: string | undefined } | null>(null);

  useEffect(() => {
    setView({ yaw: 0, pitch: 0 });
    setZoom(scene?.defaultZoom ?? 1);
  }, [scene?.id, scene?.defaultZoom]);

  // Initialize / update Photo Sphere Viewer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // destroy previous viewer if exists
    if (viewerRef.current) {
      try {
        viewerRef.current.destroy();
      } catch (e) {
        // ignore
      }
      viewerRef.current = null;
      markersRef.current = null;
    }

    // If there's no image URL, nothing to mount
    if (!imageUrl) return;

    // Create viewer
    const viewer = new Viewer({
      container: el,
      panorama: imageUrl,
      defaultYaw: 0,
      defaultPitch: 0,
      navbar: false,
      mousewheel: false,
      useXmpData: false,
    });
    viewerRef.current = viewer;

    // attach markers plugin when available
    const markers = viewer.getPlugin?.(MarkersPlugin) ?? new MarkersPlugin(viewer);
    markersRef.current = markers;

    const syncMarkers = () => {
      if (!markersRef.current) return;
      // map scene hotspots to plugin markers
      const markersList = (scene?.hotspots ?? []).map((h) => ({
        id: h.id,
        longitude: h.yaw,
        latitude: h.pitch,
        tooltip: h.tooltip ?? h.type,
        data: { hotspotId: h.id },
        // use a simple circle for editor; plugin may style differently depending on version
        style: {
          width: 28,
          height: 28,
        },
      }));
      try {
        // clear then add to ensure sync
        markersRef.current.clearMarkers?.();
      } catch (e) {
        // ignore
      }
      // some versions accept setMarkers / addMarker
      if (markersRef.current.setMarkers) markersRef.current.setMarkers(markersList);
      else if (markersRef.current.addMarker) {
        for (const m of markersList) markersRef.current.addMarker(m);
      }
    };

    // wait for panorama to be fully loaded before syncing markers
    const onPanoramaLoaded = () => syncMarkers();
    viewer.on?.("panorama-loaded", onPanoramaLoaded);

    // click on viewer to create hotspot (editor mode + placing)
    const onClick = (e: any) => {
      const pitch = e?.pitch ?? e?.data?.pitch ?? 0;
      const yaw = e?.yaw ?? e?.data?.yaw ?? 0;
      if (mode === "editor") {
        if (placing) {
          onAddHotspot(Number(pitch.toFixed?.(1) ?? pitch), Number(yaw.toFixed?.(1) ?? yaw));
          return;
        }
        // move selected hotspot by clicking on new position
        if (selectedHotspotId) {
          onMoveHotspot(selectedHotspotId, Number(pitch.toFixed?.(1) ?? pitch), Number(yaw.toFixed?.(1) ?? yaw));
          return;
        }
      }
    };
    viewer.on?.("click", onClick);

    // marker click handling
    const onSelectMarker = (e: any) => {
      const markerId = e?.marker?.id ?? e?.id ?? null;
      if (!markerId) return;
      // find hotspot
      const hs = scene?.hotspots.find((h) => h.id === markerId) ?? null;
      if (!hs) return;
      if (mode === "editor") {
        onSelectHotspot(markerId);
        return;
      }
      if ((hs.type === "door" || hs.type === "arrow") && hs.targetSceneId) {
        // smooth navigation
        onNavigate(hs.targetSceneId);
        return;
      }
      setToast(hs.tooltip || "No information");
      window.setTimeout(() => setToast(null), 2600);
    };

    // plugin event subscription - different plugin versions emit different events
    try {
      markersRef.current.on?.("select-marker", onSelectMarker);
      markersRef.current.on?.("click-marker", onSelectMarker);
    } catch (e) {
      // ignore if plugin doesn't expose `.on`
    }

    // expose viewer zoom changes
    try {
      viewer.on?.("zoom-updated", (ev: any) => {
        const z = ev?.ratio ?? ev?.zoom ?? 1;
        setZoom(z);
        onZoomChange(Number(z));
      });
    } catch (e) {
      // ignore
    }

    return () => {
      try {
        markersRef.current?.off?.("select-marker", onSelectMarker);
        viewer.off?.("panorama-loaded", onPanoramaLoaded);
        viewer.off?.("click", onClick);
        viewer.destroy?.();
      } catch (e) {
        // ignore
      }
      viewerRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, scene?.id, mode, placing, selectedHotspotId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth || 1, h: el.clientHeight || 1 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fov = BASE_FOV / zoom;
  const vfov = fov * (size.h / size.w);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      zoomRef.current(currentZoom.current * Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden bg-background">
      <div ref={containerRef} className={cn("absolute inset-0 touch-none select-none")} />

      {placing && mode === "editor" && (
        <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/60 bg-card/90 px-3 py-1.5 text-xs text-foreground">
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          Click on the panorama to place the hotspot
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 max-w-sm -translate-x-1/2 rounded-lg border border-border bg-card/95 px-4 py-2.5 text-sm text-foreground shadow-lg">
          {toast}
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-lg border border-border bg-card/90 p-1 backdrop-blur">
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}