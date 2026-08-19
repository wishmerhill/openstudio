export type HotspotType = "door" | "info" | "arrow";

export interface Hotspot {
  id: string;
  type: HotspotType;
  /** degrees, -90 (down) .. 90 (up) */
  pitch: number;
  /** degrees, -180 .. 180 */
  yaw: number;
  tooltip: string;
  targetSceneId?: string | null;
}

export interface Scene {
  id: string;
  name: string;
  /** http(s) url, data url, or "idb:<key>" reference to a locally stored image */
  panoramaUrl: string;
  defaultZoom: number;
  hotspots: Hotspot[];
}

export interface Theme {
  showNavbar: boolean;
  showTitleOverlay: boolean;
  logoUrl: string;
}

export interface Floorplan {
  id: string;
  name: string;
  imageUrl: string;
}

export interface TourProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  initialSceneId: string | null;
  scenes: Scene[];
  theme: Theme;
  floorplans: Floorplan[];
}

export const uid = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const defaultTheme = (): Theme => ({
  showNavbar: true,
  showTitleOverlay: true,
  logoUrl: "",
});

export const createProject = (name = "Untitled Tour"): TourProject => {
  const now = new Date().toISOString();
  return {
    id: uid("tour"),
    name,
    createdAt: now,
    updatedAt: now,
    initialSceneId: null,
    scenes: [],
    theme: defaultTheme(),
    floorplans: [],
  };
};