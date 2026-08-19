import { Trash2 } from "lucide-react";
import type { Hotspot, HotspotType, Scene } from "@/types/tour";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  scene: Scene | null;
  scenes: Scene[];
  hotspot: Hotspot | null;
  onSceneChange: (patch: Partial<Scene>) => void;
  onHotspotChange: (patch: Partial<Hotspot>) => void;
  onDeleteHotspot: () => void;
}

export function PropertiesPanel({
  scene,
  scenes,
  hotspot,
  onSceneChange,
  onHotspotChange,
  onDeleteHotspot,
}: Props) {
  return (
    <aside className="flex w-76 shrink-0 flex-col overflow-y-auto border-l border-border bg-sidebar">
      <div className="border-b border-border px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Scene properties
        </h2>
      </div>

      {scene ? (
        <div className="space-y-4 border-b border-border p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              className="h-8 text-xs"
              value={scene.name}
              onChange={(e) => onSceneChange({ name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Default zoom</Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {scene.defaultZoom.toFixed(1)}x
              </span>
            </div>
            <Slider
              min={0.6}
              max={3}
              step={0.1}
              value={[scene.defaultZoom]}
              onValueChange={([v]) => onSceneChange({ defaultZoom: Number((v ?? 1).toFixed(1)) })}
            />
          </div>
          <div className="rounded-md border border-border bg-panel px-2.5 py-2 text-[11px] text-muted-foreground">
            {scene.hotspots.length} hotspot{scene.hotspots.length === 1 ? "" : "s"} in this scene
          </div>
        </div>
      ) : (
        <p className="border-b border-border p-3 text-xs text-muted-foreground">
          No scene selected.
        </p>
      )}

      <div className="border-b border-border px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Hotspot properties
        </h2>
      </div>

      {hotspot ? (
        <div className="space-y-4 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              value={hotspot.type}
              onValueChange={(v) => onHotspotChange({ type: v as HotspotType })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="door">Door (navigate)</SelectItem>
                <SelectItem value="arrow">Arrow (navigate)</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tooltip</Label>
            <Input
              className="h-8 text-xs"
              value={hotspot.tooltip}
              onChange={(e) => onHotspotChange({ tooltip: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Pitch</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={hotspot.pitch}
                onChange={(e) => onHotspotChange({ pitch: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Yaw</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={hotspot.yaw}
                onChange={(e) => onHotspotChange({ yaw: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Target scene</Label>
            <Select
              value={hotspot.targetSceneId ?? "none"}
              onValueChange={(v) => onHotspotChange({ targetSceneId: v === "none" ? null : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {scenes
                  .filter((s) => s.id !== scene?.id)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="destructive" size="sm" className="w-full" onClick={onDeleteHotspot}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete hotspot
          </Button>
        </div>
      ) : (
        <p className="p-3 text-xs text-muted-foreground">
          Select a hotspot on the canvas, or use “Add Hotspot” to place a new one.
        </p>
      )}
    </aside>
  );
}