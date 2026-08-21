import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Package, Terminal, Download } from "lucide-react";
import type { TourProject } from "@/types/tour";
import { getBlob, IDB_PREFIX } from "@/lib/idb";
import { toast } from "sonner";

interface ExportDesktopModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: TourProject;
}

export function ExportDesktopModal({ open, onOpenChange, project }: ExportDesktopModalProps) {
  const [appName, setAppName] = useState(project.name);
  const [initialSceneId, setInitialSceneId] = useState(
    project.initialSceneId || project.scenes[0]?.id || ""
  );
  const [windowWidth, setWindowWidth] = useState("1280");
  const [windowHeight, setWindowHeight] = useState("800");
  const [fullscreen, setFullscreen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleTauriBuild = () => {
    const instructions = [
      "Per compilare l'applicazione desktop nativa:",
      "",
      `1. Apri il terminale nella cartella del progetto`,
      `2. Esegui: npm run tauri:build`,
      "",
      "La build genererà i pacchetti in:",
      "  - src-tauri/target/release/bundle/",
      "",
      "Prima di buildare, aggiorna src-tauri/tauri.conf.json con:",
      `  - app.windows[0].title = "${appName}"`,
      `  - app.windows[0].width = ${windowWidth}`,
      `  - app.windows[0].height = ${windowHeight}`,
      `  - app.windows[0].fullscreen = ${fullscreen}`,
      "",
      "Per avviare in modalità sviluppo: npm run tauri:dev",
    ].join("\n");

    navigator.clipboard.writeText(instructions);
  };

  const handleWindowsExport = async () => {
    setExporting(true);
    try {
      // Slug del nome progetto per il filename
      const slug = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tour";

      const extFromBlob = (blob: Blob) => {
        if (blob.type.includes("png")) return "png";
        if (blob.type.includes("webp")) return "webp";
        return "jpg";
      };

      // Prepara le scene con i filename dei panorami
      const scenes: Array<{
        id: string;
        name: string;
        panoramaFilename: string;
        defaultZoom: number;
        hotspots: TourProject["scenes"][0]["hotspots"];
      }> = [];
      const panoramas: Array<{ filename: string; data: string }> = [];

      for (const [index, scene] of project.scenes.entries()) {
        let panoramaFilename = scene.panoramaUrl;
        if (scene.panoramaUrl.startsWith(IDB_PREFIX)) {
          const blob = await getBlob(scene.panoramaUrl);
          if (blob) {
            panoramaFilename = `${slug(scene.name) || "scene"}-${index + 1}.${extFromBlob(blob)}`;
            const base64 = await blobToBase64(blob);
            panoramas.push({ filename: panoramaFilename, data: base64 });
          } else {
            panoramaFilename = "";
          }
        }

        scenes.push({
          id: scene.id,
          name: scene.name,
          panoramaFilename,
          defaultZoom: scene.defaultZoom,
          hotspots: scene.hotspots,
        });
      }

      // Chiama il middleware Vite che esegue la build ufficiale Neutralino
      const response = await fetch("/api/export-neutralino", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: project.name,
          tourJson: JSON.stringify(project, null, 2) + "\n",
          scenes,
          panoramas,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Build fallita (HTTP ${response.status})`);
      }

      const result = await response.json();

      if (!result?.zipBase64) {
        throw new Error("Build fallita: nessun ZIP ricevuto dal server.");
      }

      // Decodifica base64 → Blob → download
      const binary = atob(result.zipBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || `${slug(project.name)}-neutralino.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Windows Viewer ZIP generato!");
    } catch (error) {
      console.error("[windows-export]", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Errore durante l'export Windows.";
      toast.error(errorMessage, { duration: 10_000 });
    } finally {
      setExporting(false);
    }
  };

  /** Converte un Blob in data URL base64 */
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Desktop Export
          </DialogTitle>
          <DialogDescription>
            Package your tour as a desktop application for macOS, Windows, or Linux.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="windows" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="windows" className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M0 0h11.5v11.5H0zm12.5 0H24v11.5H12.5zM0 12.5h11.5V24H0zm12.5 0H24V24H12.5z"/>
              </svg>
              Windows (Portable)
            </TabsTrigger>
            <TabsTrigger value="tauri" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Native (Tauri)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="windows" className="space-y-4 pt-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="mb-2 text-sm font-medium">Neutralinojs Portable Viewer</h4>
              <p className="text-xs text-muted-foreground">
                Generates a ZIP with a portable Windows executable, a{" "}
                <code>neutralino.config.json</code> (on disk), and a{" "}
                <code>resources.neu</code> archive containing the viewer and tour
                data. No installation or admin rights required — just unzip and
                run <code>OpenTourViewer.exe</code>.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                Uses the official{" "}
                <code>@neutralinojs/neu</code> CLI to build the app: it downloads
                the Neutralinojs binaries, packages the viewer with the tour data,
                and returns a ready-to-run ZIP.
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleWindowsExport} disabled={exporting}>
                <Download className="mr-1.5 h-4 w-4" />
                {exporting ? "Generating..." : "Download Windows Viewer ZIP"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="tauri" className="space-y-4 pt-4">
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="app-name">Window Title / App Name</Label>
                <Input
                  id="app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="OpenTour Studio"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="initial-scene">Default start scene</Label>
                <Select value={initialSceneId} onValueChange={setInitialSceneId}>
                  <SelectTrigger id="initial-scene">
                    <SelectValue placeholder="Select scene" />
                  </SelectTrigger>
                  <SelectContent>
                    {project.scenes.map((scene) => (
                      <SelectItem key={scene.id} value={scene.id}>
                        {scene.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="win-width">Width (px)</Label>
                  <Input
                    id="win-width"
                    type="number"
                    min={800}
                    max={3840}
                    value={windowWidth}
                    onChange={(e) => setWindowWidth(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="win-height">Height (px)</Label>
                  <Input
                    id="win-height"
                    type="number"
                    min={600}
                    max={2160}
                    value={windowHeight}
                    onChange={(e) => setWindowHeight(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="fullscreen"
                  checked={fullscreen}
                  onCheckedChange={setFullscreen}
                />
                <Label htmlFor="fullscreen" className="cursor-pointer">
                  Start in fullscreen
                </Label>
              </div>

              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Terminal className="h-4 w-4" />
                  Local build
                </div>
                <code className="block rounded bg-background px-3 py-2 text-xs text-muted-foreground">
                  npm run tauri:build
                </code>
                <p className="mt-2 text-xs text-muted-foreground">
                  Packages will be in{" "}
                  <code className="rounded bg-background px-1">src-tauri/target/release/bundle/</code>
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleTauriBuild}>
                <Package className="mr-1.5 h-4 w-4" />
                Copy build instructions
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}