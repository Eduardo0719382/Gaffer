// Plantillas de escenas típicas. Coordenadas en metros; la cámara suele estar a la izquierda.
import { FIXTURES } from './library';
import {
  Obj, Scene, makeActor, makeCamera, makeDoor, makeLight, makeModifier, makeProp, makeWall, makeWindow, newScene,
} from './model';

const fx = (model: string) => FIXTURES.find(f => f.model === model)!;

function at<T extends Obj>(o: T, x: number, y: number, rot = 0): T {
  o.x = x; o.y = y; o.rot = rot; return o;
}
// Gira el objeto para que apunte a (tx, ty).
function aim<T extends Obj>(o: T, tx: number, ty: number): T {
  o.rot = Math.round((Math.atan2(ty - o.y, tx - o.x) * 180) / Math.PI);
  o.throw = Math.max(1.5, Math.round((Math.hypot(tx - o.x, ty - o.y) + 0.8) * 10) / 10);
  return o;
}
function light(model: string, label: string, x: number, y: number, tx: number, ty: number, patch: Partial<Obj> = {}) {
  return Object.assign(aim(at(makeLight(fx(model), label), x, y), tx, ty), patch);
}
function wall(x1: number, y1: number, x2: number, y2: number) {
  const w = makeWall(Math.hypot(x2 - x1, y2 - y1));
  return at(w, (x1 + x2) / 2, (y1 + y2) / 2, Math.round((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI));
}
// Modificador entre la luz y el sujeto, perpendicular al haz.
function modBetween(m: Obj, l: Obj, t = 0.35) {
  const a = (l.rot * Math.PI) / 180;
  return at(m, l.x + Math.cos(a) * (l.w / 2 + t), l.y + Math.sin(a) * (l.w / 2 + t), l.rot);
}

export interface Template { id: string; name: string; desc: string; build: () => Scene }

export const TEMPLATES: Template[] = [
  {
    id: 'interview', name: 'Entrevista 3 puntos', desc: 'Key con softbox, relleno con rebote y contraluz.',
    build: () => {
      const key = light('LS 300d II', 'KEY', -1.6, -1.7, 0, 0);
      const back = light('PavoTube II 30X', 'BACK', 1.7, -1.4, 0, 0, { cct: 4300 });
      const bg = light('Práctica (foco 60 W)', 'PRÁCTICA', 2.2, 1.6, 2.2, 1.6, { beamOn: false, circuit: 'B' });
      return newScene('Entrevista', [
        wall(3, -3, 3, 3),
        at(makeCamera('CAM A'), -3.2, 0, 0),
        at(makeActor('Entrevistado'), 0, 0, 180),
        at(makeProp('chair', 0.45, 0.45, 'Silla'), 0.15, 0, 180),
        key, modBetween(makeModifier('softbox', 0.35, 0.9, 'Softbox', 'Difusión'), key, 0.45),
        aim(at(makeModifier('bounce', 0.05, 1.2, 'Rebote', 'Bead board'), -1.5, 1.6), 0, 0),
        back, bg,
      ]);
    },
  },
  {
    id: 'interview2', name: 'Entrevista 2 cámaras', desc: 'Dos personas frente a frente, cámaras cruzadas.',
    build: () => {
      const k1 = light('LS 600d Pro', 'KEY A', 0, -2.6, -1.1, 0);
      const k2 = light('LS 300d II', 'KEY B', 0, 2.6, 1.1, 0);
      return newScene('Entrevista 2 cámaras', [
        at(makeActor('Persona A'), -1.1, 0, 0), at(makeActor('Persona B'), 1.1, 0, 180),
        aim(at(makeCamera('CAM A'), 2.6, 0.9), -1.1, 0), aim(at(makeCamera('CAM B'), -2.6, -0.9), 1.1, 0),
        k1, modBetween(makeModifier('frame', 0.06, 1.8, '6x6', 'Full grid'), k1, 0.9),
        k2, modBetween(makeModifier('lantern', 0.65, 0.65, 'Lantern'), k2, 0.4),
        light('Titan Tube', 'BACK A', -2.6, 1.6, -1.1, 0, { cct: 4500, circuit: 'B' }),
        light('Titan Tube', 'BACK B', 2.6, -1.6, 1.1, 0, { cct: 4500, circuit: 'B' }),
      ]);
    },
  },
  {
    id: 'table', name: 'Mesa / comida', desc: 'Mesa con lantern encima, key por ventana y negativo.',
    build: () => {
      const key = light('LS 1200d Pro', 'KEY VENTANA', 0, -4.6, 0, 0, { throw: 5 });
      return newScene('Mesa', [
        wall(-4, -3, 4, -3), wall(-4, -3, -4, 3), wall(4, -3, 4, 3),
        at(makeWindow(), 0, -3, 0),
        at(makeProp('round', 1.2, 1.2, 'Mesa'), 0, 0),
        at(makeActor('A'), -0.9, 0, 0), at(makeActor('B'), 0.9, 0, 180), at(makeActor('C'), 0, 0.9, -90),
        at(makeModifier('lantern', 0.65, 0.65, 'Lantern'), 0, 0),
        key, at(makeModifier('frame', 0.06, 2.4, '8x8', 'Full grid'), 0, -3.5, -90),
        at(makeModifier('neg', 0.06, 2.4, 'Negativo', 'Duvetyne'), 0, 2.2, 90),
        at(makeCamera('CAM A'), -3, 2, -30),
      ]);
    },
  },
  {
    id: 'window', name: 'Interior día con ventana', desc: 'Cuarto con HMI por la ventana a través de difusión.',
    build: () => {
      const sun = light('HMI 4 kW', 'SOL', -1, -5.5, 0.5, 0, { throw: 7, circuit: '' });
      return newScene('Interior día', [
        wall(-3, -3, 3, -3), wall(3, -3, 3, 3), wall(3, 3, -3, 3), wall(-3, 3, -3, -3),
        at(makeWindow(), -0.5, -3, 0), at(makeDoor(), 3, 1.8, 90),
        at(makeProp('sofa', 2, 0.9, 'Sillón'), 0.6, 1.9, 0),
        at(makeActor('Actor'), 0.5, 0.2, 180),
        sun, at(makeModifier('frame', 0.06, 3.6, '12x12', 'Full grid'), -0.8, -4.2, -90),
        aim(at(makeModifier('bounce', 0.05, 1.2, 'Rebote', 'Bead board'), 1.8, 1.2), 0.5, 0.2),
        at(makeCamera('CAM A'), -2.2, 1.4, -20),
        light('Práctica (foco 60 W)', 'LÁMPARA', 2.4, 2.4, 2.4, 2.4, { beamOn: false }),
      ]);
    },
  },
  {
    id: 'car', name: 'Auto de noche', desc: 'Interior de auto con tubos y luz de paso.',
    build: () => {
      const car = at(makeProp('car', 4.5, 1.8, 'Auto'), 0, 0);
      return newScene('Auto noche', [
        car,
        at(makeActor('Conductor'), -0.3, -0.4, 0), at(makeActor('Copiloto'), -0.3, 0.4, 0),
        light('PavoTube II 30X', 'TABLERO', 0.7, 0, -0.3, 0, { throw: 1.5, cct: 4000, intensity: 30 }),
        light('INFINIBAR PB12', 'PASO', -2.2, -2.2, -0.3, -0.4, { beamColor: '#ff8a3d', intensity: 70 }),
        light('LS 300x', 'LUNA', 2, 2.5, -0.3, 0.4, { cct: 6500, intensity: 40 }),
        at(makeCamera('CAM A'), 3.2, -0.4, 180),
      ]);
    },
  },
];
