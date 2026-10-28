import { create } from 'zustand';
import { LayerId, LAYERS, Obj, Project, Scene, newScene, uid } from './model';

const MAX_HISTORY = 100;

export type Tool = 'select' | 'wall';
export type Panel = 'library' | 'props' | 'layers' | 'gear' | 'power' | 'scene' | null;

interface State {
  project: Project | null;
  sceneId: string;
  selectedId: string | null;
  tool: Tool;
  panel: Panel; // panel abierto en pantallas chicas
  hidden: Record<LayerId, boolean>;
  locked: Record<LayerId, boolean>;
  past: Project[];
  future: Project[];
  dirty: number; // contador que sube con cada cambio (para autoguardado)

  open(p: Project): void;
  close(): void;
  commit(fn: (p: Project, scene: Scene) => void, mergeKey?: string): void;
  undo(): void;
  redo(): void;
  select(id: string | null): void;
  setTool(t: Tool): void;
  setPanel(p: Panel): void;
  setScene(id: string): void;
  toggleHidden(l: LayerId): void;
  toggleLocked(l: LayerId): void;

  addObject(o: Obj): void;
  updateObject(id: string, patch: Partial<Obj>): void;
  removeObject(id: string): void;
  duplicateObject(id: string): void;
  addScene(s?: Scene): void;
  duplicateScene(id: string): void;
  removeScene(id: string): void;
}

let lastKey: string | undefined;
let lastTime = 0;

const flags = (v: boolean) => Object.fromEntries(LAYERS.map(l => [l.id, v])) as Record<LayerId, boolean>;

export const useStore = create<State>((set, get) => ({
  project: null,
  sceneId: '',
  selectedId: null,
  tool: 'select',
  panel: null,
  hidden: flags(false),
  locked: flags(false),
  past: [],
  future: [],
  dirty: 0,

  open: p => set({ project: p, sceneId: p.scenes[0].id, selectedId: null, past: [], future: [], tool: 'select', panel: null }),
  close: () => set({ project: null, selectedId: null, past: [], future: [] }),

  // mergeKey: cambios seguidos del mismo campo (p. ej. un slider) cuentan como un solo paso de deshacer.
  commit: (fn, mergeKey) => {
    const { project, sceneId, past } = get();
    if (!project) return;
    const next = structuredClone(project);
    const scene = next.scenes.find(s => s.id === sceneId) ?? next.scenes[0];
    fn(next, scene);
    next.updated = Date.now();
    const merge = !!mergeKey && mergeKey === lastKey && Date.now() - lastTime < 1500 && past.length > 0;
    lastKey = mergeKey; lastTime = Date.now();
    set({ project: next, past: merge ? past : [...past, project].slice(-MAX_HISTORY), future: [], dirty: get().dirty + 1 });
  },

  undo: () => {
    const { past, project, future, sceneId } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    set({
      project: prev, past: past.slice(0, -1), future: [project, ...future], dirty: get().dirty + 1,
      sceneId: prev.scenes.some(s => s.id === sceneId) ? sceneId : prev.scenes[0].id,
    });
  },
  redo: () => {
    const { past, project, future, sceneId } = get();
    if (!future.length || !project) return;
    const next = future[0];
    set({
      project: next, past: [...past, project], future: future.slice(1), dirty: get().dirty + 1,
      sceneId: next.scenes.some(s => s.id === sceneId) ? sceneId : next.scenes[0].id,
    });
  },

  select: id => set({ selectedId: id }),
  setTool: t => set({ tool: t, selectedId: null }),
  setPanel: p => set({ panel: p }),
  setScene: id => set({ sceneId: id, selectedId: null }),
  toggleHidden: l => set({ hidden: { ...get().hidden, [l]: !get().hidden[l] } }),
  toggleLocked: l => set({ locked: { ...get().locked, [l]: !get().locked[l] } }),

  addObject: o => {
    get().commit((_, s) => { s.objects.push(o); });
    set({ selectedId: o.id });
  },
  updateObject: (id, patch) => get().commit((_, s) => {
    const o = s.objects.find(x => x.id === id);
    if (o) Object.assign(o, patch);
  }, id + ':' + Object.keys(patch).join(',')),
  removeObject: id => {
    get().commit((_, s) => { s.objects = s.objects.filter(o => o.id !== id); });
    if (get().selectedId === id) set({ selectedId: null });
  },
  duplicateObject: id => {
    const s = currentScene(get());
    const o = s?.objects.find(x => x.id === id);
    if (!o) return;
    const c: Obj = { ...structuredClone(o), id: uid(), x: o.x + 0.5, y: o.y + 0.5 };
    get().addObject(c);
  },
  addScene: sc => {
    const { project } = get();
    if (!project) return;
    const s = sc ?? newScene(`Escena ${project.scenes.length + 1}`);
    get().commit(p => { p.scenes.push(s); });
    set({ sceneId: s.id, selectedId: null });
  },
  duplicateScene: id => {
    const { project } = get();
    const src = project?.scenes.find(s => s.id === id);
    if (!src) return;
    const s: Scene = { ...structuredClone(src), id: uid(), name: src.name + ' (copia)' };
    s.objects.forEach(o => { o.id = uid(); });
    get().addScene(s);
  },
  removeScene: id => {
    const { project } = get();
    if (!project || project.scenes.length <= 1) return;
    get().commit(p => { p.scenes = p.scenes.filter(s => s.id !== id); });
    const p = get().project!;
    if (!p.scenes.some(s => s.id === get().sceneId)) set({ sceneId: p.scenes[0].id });
  },
}));

export function currentScene(st: Pick<State, 'project' | 'sceneId'>): Scene | undefined {
  return st.project?.scenes.find(s => s.id === st.sceneId) ?? st.project?.scenes[0];
}

export const useScene = () => useStore(s => currentScene(s));
export const useSelected = () => useStore(s => currentScene(s)?.objects.find(o => o.id === s.selectedId));
