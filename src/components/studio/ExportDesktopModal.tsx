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
import { Monitor, Package, Terminal } from "lucide-react";
import type { TourProject } from "@/types/tour";

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

  const handleBuild = () => {
    // Istruzioni per la build locale — Tauri richiede l'esecuzione da terminale
    const cmd = `npm run tauri:build`;
    const instructions = [
      "Per compilare l'applicazione desktop nativa:",
      "",
      `1. Apri il terminale nella cartella del progetto`,
      `2. Esegui: ${cmd}`,
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

    // Copia le istruzioni negli appunti
    navigator.clipboard.writeText(instructions).then(() => {
      // Non chiudiamo il modal, l'utente può copiare
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Applicazione Desktop Nativa (Tauri)
          </DialogTitle>
          <DialogDescription>
            Configura e compila il tour come applicazione desktop per macOS, Windows e Linux.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Nome App */}
          <div className="grid gap-2">
            <Label htmlFor="app-name">Titolo finestra / Nome App</Label>
            <Input
              id="app-name"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="OpenTour Studio"
            />
          </div>

          {/* Scena iniziale */}
          <div className="grid gap-2">
            <Label htmlFor="initial-scene">Scena di avvio predefinita</Label>
            <Select value={initialSceneId} onValueChange={setInitialSceneId}>
              <SelectTrigger id="initial-scene">
                <SelectValue placeholder="Seleziona scena" />
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

          {/* Risoluzione finestra */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="win-width">Larghezza (px)</Label>
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
              <Label htmlFor="win-height">Altezza (px)</Label>
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

          {/* Schermo intero */}
          <div className="flex items-center gap-3">
            <Switch
              id="fullscreen"
              checked={fullscreen}
              onCheckedChange={setFullscreen}
            />
            <Label htmlFor="fullscreen" className="cursor-pointer">
              Avvio a schermo intero
            </Label>
          </div>

          {/* Istruzioni build */}
          <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Terminal className="h-4 w-4" />
              Build locale
            </div>
            <code className="block rounded bg-background px-3 py-2 text-xs text-muted-foreground">
              npm run tauri:build
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              I pacchetti generati si troveranno in{" "}
              <code className="rounded bg-background px-1">src-tauri/target/release/bundle/</code>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
          <Button onClick={handleBuild}>
            <Package className="mr-1.5 h-4 w-4" />
            Copia istruzioni build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}