import type { Obj, Project, Scene, Settings } from '../model';

// ---------- Carga eléctrica ----------
export function lightWatts(o: Obj, s: Settings): number {
  if (o.kind !== 'light' || !o.fixture) return 0;
  const w = o.fixture.watts;
  return s.scaleByIntensity ? w * ((o.intensity ?? 100) / 100) : w;
}

export interface CircuitLoad {
  id: string; name: string; breaker: number; watts: number; amps: number;
  pct: number; status: 'ok' | 'warn' | 'over' | 'none'; lights: Obj[];
}

export function circuitLoads(scene: Scene, s: Settings): { circuits: CircuitLoad[]; totalW: number; totalA: number } {
  const lights = scene.objects.filter(o => o.kind === 'light' && (o.fixture?.watts ?? 0) > 0);
  const defs = [...s.circuits, { id: '', name: 'Sin circuito', amps: 0 }];
  const circuits = defs.map(c => {
    const ls = lights.filter(l => (l.circuit || '') === c.id || (c.id === '' && !s.circuits.some(x => x.id === l.circuit)));
    const watts = ls.reduce((a, l) => a + lightWatts(l, s), 0);
    const amps = watts / s.voltage;
    const pct = c.amps ? (amps / c.amps) * 100 : 0;
    const status: CircuitLoad['status'] = !c.id ? 'none' : pct > 100 ? 'over' : pct > 80 ? 'warn' : 'ok';
    return { id: c.id, name: c.name, breaker: c.amps, watts, amps, pct, status, lights: ls };
  }).filter(c => c.id !== '' || c.lights.length > 0);
  const totalW = circuits.reduce((a, c) => a + c.watts, 0);
  return { circuits, totalW, totalA: totalW / s.voltage };
}

// ---------- Fotometría simple ----------
export function luxAtThrow(o: Obj): number | null {
  if (o.kind !== 'light' || !o.fixture?.lux1m || !o.throw) return null;
  const diffLoss = o.diffusion ? 0.6 : 1;
  return Math.round((o.fixture.lux1m * (o.intensity ?? 100) / 100 * diffLoss) / (o.throw * o.throw));
}

// ---------- Gear list ----------
export interface GearRow { group: string; item: string; qty: number }

function sceneGear(scene: Scene): Map<string, GearRow> {
  const m = new Map<string, GearRow>();
  const add = (group: string, item: string, n = 1) => {
    const k = group + '|' + item;
    const r = m.get(k) ?? { group, item, qty: 0 };
    r.qty += n;
    m.set(k, r);
  };
  let stands = 0, cstands = 0;
  for (const o of scene.objects) {
    if (o.kind === 'light' && o.fixture) {
      add('Luces', `${o.fixture.brand} ${o.fixture.model}`);
      if (o.fixture.type !== 'sun' && o.fixture.type !== 'practical') stands++;
      if (o.gel) add('Gelatinas y difusión', `Gel ${o.gel}`);
      if (o.diffusion) add('Gelatinas y difusión', `Difusión ${o.diffusion}`);
    } else if (o.kind === 'modifier') {
      add('Grip', o.label || o.sub + (o.material ? ` (${o.material})` : ''));
      if (o.sub === 'frame' || o.sub === 'neg') cstands += 2; else if (o.sub !== 'softbox' && o.sub !== 'lantern') cstands++;
    } else if (o.kind === 'camera') {
      add('Cámara', o.label || 'Cámara');
    } else if (o.kind === 'power') {
      add('Eléctrico', o.label || 'Distro');
    }
  }
  if (stands) add('Soportes (estimado)', 'Stands para luces', stands);
  if (cstands) add('Soportes (estimado)', 'C-stands', cstands);
  const cables = scene.objects.filter(o => o.kind === 'light' && (o.fixture?.watts ?? 0) > 0).length;
  if (cables) add('Eléctrico', 'Extensiones (estimado)', cables);
  return m;
}

export function gearForScene(scene: Scene): GearRow[] {
  return sortGear([...sceneGear(scene).values()]);
}

// Total del proyecto = máximo usado al mismo tiempo en cualquier escena.
export function gearForProject(p: Project): GearRow[] {
  const total = new Map<string, GearRow>();
  for (const s of p.scenes) {
    for (const [k, r] of sceneGear(s)) {
      const t = total.get(k);
      if (!t || t.qty < r.qty) total.set(k, { ...r });
    }
  }
  return sortGear([...total.values()]);
}

const ORDER = ['Luces', 'Gelatinas y difusión', 'Grip', 'Soportes (estimado)', 'Eléctrico', 'Cámara'];
function sortGear(rows: GearRow[]) {
  return rows.sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || a.item.localeCompare(b.item));
}

export function gearAsText(title: string, rows: GearRow[]): string {
  let out = `${title}\n`;
  let g = '';
  for (const r of rows) {
    if (r.group !== g) { g = r.group; out += `\n${g}\n`; }
    out += `  ${r.qty} × ${r.item}\n`;
  }
  return out;
}

// ---------- Cámara ----------
export function cameraFov(o: Obj): number {
  const f = o.lens ?? 35, w = o.sensor ?? 24.9;
  return (2 * Math.atan(w / (2 * f)) * 180) / Math.PI;
}
