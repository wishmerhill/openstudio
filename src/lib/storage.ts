import { type TourProject, uid, defaultTheme } from "@/types/tour";

const KEY = "opentour.projects.v1";

export function loadProjects(): TourProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TourProject[]) : [];
  } catch {
    return [];
  }
}

export function saveProjects(projects: TourProject[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(projects));
}

export function getProject(id: string): TourProject | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function upsertProject(project: TourProject) {
  const projects = loadProjects();
  const next = { ...project, updatedAt: new Date().toISOString() };
  const i = projects.findIndex((p) => p.id === project.id);
  if (i === -1) projects.unshift(next);
  else projects[i] = next;
  saveProjects(projects);
  return next;
}

export function deleteProject(id: string) {
  saveProjects(loadProjects().filter((p) => p.id !== id));
}

export function duplicateProject(id: string): TourProject | null {
  const source = getProject(id);
  if (!source) return null;
  const copy = cloneWithNewIds({ ...source, name: `${source.name} (copy)` });
  const projects = loadProjects();
  projects.unshift(copy);
  saveProjects(projects);
  return copy;
}

export function cloneWithNewIds(project: TourProject): TourProject {
  const now = new Date().toISOString();
  const sceneIdMap = new Map<string, string>();
  project.scenes.forEach((s) => sceneIdMap.set(s.id, uid("scene")));
  return {
    ...project,
    id: uid("tour"),
    createdAt: now,
    updatedAt: now,
    theme: { ...defaultTheme(), ...project.theme },
    floorplans: project.floorplans ?? [],
    initialSceneId: project.initialSceneId
      ? sceneIdMap.get(project.initialSceneId) ?? null
      : null,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      id: sceneIdMap.get(scene.id)!,
      hotspots: (scene.hotspots ?? []).map((h) => ({
        ...h,
        id: uid("hs"),
        targetSceneId: h.targetSceneId ? sceneIdMap.get(h.targetSceneId) ?? null : null,
      })),
    })),
  };
}

export function normalizeImported(raw: unknown): TourProject | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<TourProject>;
  if (!Array.isArray(candidate.scenes) || typeof candidate.name !== "string") return null;
  return cloneWithNewIds({
    ...(candidate as TourProject),
    scenes: candidate.scenes.map((s) => ({
      ...s,
      defaultZoom: s.defaultZoom ?? 1,
      hotspots: s.hotspots ?? [],
    })),
  });
}