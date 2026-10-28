// Modelo de datos del proyecto. Todas las medidas en METROS y grados.
// Si cambias la forma de estos datos, sube SCHEMA y agrega una migración en lib/migrate.ts.

export const SCHEMA = 1;

export type LayerId = 'set' | 'props' | 'grip' | 'talent' | 'lights' | 'beams' | 'labels';

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'set', name: 'Escenografía' },
  { id: 'props', name: 'Utilería' },
  { id: 'grip', name: 'Grip / modificadores' },
  { id: 'talent', name: 'Cámara y talento' },
  { id: 'lights', name: 'Luces' },
  { id: 'beams', name: 'Haces' },
  { id: 'labels', name: 'Etiquetas y textos' },
];

export type FixtureType = 'cob' | 'fresnel' | 'panel' | 'tube' | 'hmi' | 'practical' | 'mini' | 'sun';

export interface Fixture {
  id: string;
  brand: string;
  model: string;
  type: FixtureType;
  watts: number; // consumo aproximado
  beamAngle: number; // grados
  lux1m: number; // lux a 1 m al 100 % (aprox.)
  cctMin: number;
  cctMax: number;
  rgb: boolean;
  custom?: boolean;
}

export type ObjKind =
  | 'light' | 'modifier' | 'camera' | 'actor' | 'prop'
  | 'wall' | 'door' | 'window' | 'text' | 'power';

export interface Obj {
  id: string;
  kind: ObjKind;
  sub: string; // subtipo: tipo de modificador, de utilería, etc.
  x: number;
  y: number;
  rot: number; // 0 = apunta a la derecha; positivo = sentido horario
  w: number; // largo (eje local x)
  h: number; // ancho (eje local y)
  label: string;
  showLabel: boolean;
  labelDx: number;
  labelDy: number;
  color: string;
  // Luces
  fixture?: Fixture;
  beamOn?: boolean;
  beamAngle?: number;
  throw?: number;
  cct?: number;
  intensity?: number; // 0..100
  gel?: string;
  diffusion?: string;
  beamColor?: string; // color libre (RGB); vacío = automático por CCT/gel
  circuit?: string;
  notes?: string;
  // Cámara
  lens?: number; // mm
  sensor?: number; // ancho del sensor en mm
  // Modificadores
  material?: string;
  // Texto
  text?: string;
  fontSize?: number;
}

export interface Scene {
  id: string;
  name: string;
  notes: string;
  objects: Obj[];
}

export interface Circuit {
  id: string;
  name: string;
  amps: number; // breaker
}

export interface Settings {
  voltage: number;
  circuits: Circuit[];
  scaleByIntensity: boolean;
  snap: boolean;
  grid: number;
  labelDetail: 'simple' | 'full';
}

export interface Project {
  schema: number;
  id: string;
  name: string;
  created: number;
  updated: number;
  settings: Settings;
  scenes: Scene[];
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function layerOf(o: Obj): LayerId {
  switch (o.kind) {
    case 'wall': case 'door': case 'window': return 'set';
    case 'prop': case 'power': return 'props';
    case 'modifier': return 'grip';
    case 'camera': case 'actor': return 'talent';
    case 'light': return 'lights';
    case 'text': return 'labels';
  }
}

export function defaultSettings(): Settings {
  return {
    voltage: 120,
    circuits: [
      { id: 'A', name: 'Circuito A', amps: 20 },
      { id: 'B', name: 'Circuito B', amps: 20 },
      { id: 'C', name: 'Circuito C', amps: 20 },
    ],
    scaleByIntensity: false,
    snap: true,
    grid: 0.25,
    labelDetail: 'full',
  };
}

export function newScene(name = 'Escena 1', objects: Obj[] = []): Scene {
  return { id: uid(), name, notes: '', objects };
}

export function newProject(name = 'Proyecto nuevo'): Project {
  const now = Date.now();
  return {
    schema: SCHEMA, id: uid(), name, created: now, updated: now,
    settings: defaultSettings(), scenes: [newScene()],
  };
}

function base(kind: ObjKind, sub: string, w: number, h: number, label = ''): Obj {
  return {
    id: uid(), kind, sub, x: 0, y: 0, rot: 0, w, h,
    label, showLabel: !!label, labelDx: 0.6, labelDy: -0.9, color: '#8a8f98',
  };
}

const LIGHT_SIZE: Record<FixtureType, [number, number]> = {
  cob: [0.45, 0.3], fresnel: [0.45, 0.35], panel: [0.12, 0.6], tube: [0.06, 1.2],
  hmi: [0.55, 0.4], practical: [0.2, 0.2], mini: [0.12, 0.1], sun: [0.5, 0.5],
};

export function makeLight(f: Fixture, label = ''): Obj {
  const [w, h] = LIGHT_SIZE[f.type];
  const cct = f.cctMax >= 5600 && f.cctMin <= 5600 ? 5600 : f.cctMax;
  return {
    ...base('light', f.type, w, h, label),
    showLabel: true,
    fixture: { ...f },
    beamOn: true,
    beamAngle: f.beamAngle,
    throw: f.type === 'sun' ? 8 : 4,
    cct,
    intensity: 100,
    gel: '',
    diffusion: '',
    beamColor: '',
    circuit: f.watts > 0 ? 'A' : '',
    notes: '',
  };
}

export interface CatalogItem {
  key: string;
  name: string;
  hint?: string;
  make: () => Obj;
}

export function makeModifier(sub: string, w: number, h: number, name: string, material = ''): Obj {
  const o = base('modifier', sub, w, h, name);
  o.material = material;
  o.color = sub === 'flag' || sub === 'neg' ? '#111111' : '#ffffff';
  o.showLabel = true;
  o.labelDx = 0.4;
  o.labelDy = 0.8;
  return o;
}

export function makeCamera(label = 'CAM A'): Obj {
  const o = base('camera', 'camera', 0.35, 0.22, label);
  o.lens = 35;
  o.sensor = 24.9;
  o.throw = 4;
  o.beamOn = true;
  o.color = '#1f2937';
  return o;
}

export function makeActor(label = 'Actor'): Obj {
  const o = base('actor', 'actor', 0.3, 0.5, label);
  o.color = '#d97706';
  o.labelDx = 0.4;
  o.labelDy = 0.6;
  return o;
}

export function makeProp(sub: string, w: number, h: number, name: string): Obj {
  const o = base('prop', sub, w, h, name);
  o.showLabel = false;
  o.color = sub === 'plant' ? '#4d7c0f' : '#b8a48a';
  o.labelDx = 0;
  o.labelDy = 0;
  return o;
}

export function makeWall(length = 3): Obj {
  const o = base('wall', 'wall', length, 0.15);
  o.color = '#4b5563';
  return o;
}

export function makeDoor(): Obj {
  const o = base('door', 'door', 0.9, 0.12, 'Puerta');
  o.showLabel = false;
  o.color = '#92400e';
  return o;
}

export function makeWindow(): Obj {
  const o = base('window', 'window', 1.2, 0.15, 'Ventana');
  o.showLabel = false;
  o.color = '#7dd3fc';
  return o;
}

export function makeText(text = 'Texto'): Obj {
  const o = base('text', 'text', 2, 0.4);
  o.text = text;
  o.fontSize = 0.3;
  o.color = '#111827';
  return o;
}

export function makePower(label = 'Distro'): Obj {
  const o = base('power', 'power', 0.5, 0.4, label);
  o.color = '#facc15';
  o.showLabel = true;
  o.labelDx = 0.5;
  o.labelDy = -0.5;
  return o;
}
