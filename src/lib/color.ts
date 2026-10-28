import { GELS } from '../library';
import type { Obj } from '../model';

// Aproximación de temperatura de color (K) a RGB (algoritmo de Tanner Helland).
export function cctToRgb(k: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, k)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  return [c(r), c(g), c(b)];
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// CCT efectivo después del gel de corrección (desplazamiento en mireds).
export function effectiveCct(o: Obj): number {
  const gel = GELS.find(g => g.name === o.gel);
  const cct = o.cct ?? 5600;
  if (!gel?.mired) return cct;
  return Math.round(1e6 / (1e6 / cct + gel.mired));
}

// Color con el que se dibuja el haz.
export function beamColor(o: Obj): [number, number, number] {
  if (o.beamColor) return hexToRgb(o.beamColor);
  const gel = GELS.find(g => g.name === o.gel);
  if (gel?.color) return hexToRgb(gel.color);
  const rgb = cctToRgb(effectiveCct(o));
  // Exagera un poco el tono para que cálido/frío se distinga en el plano.
  const [r, g, b] = rgb;
  const k = effectiveCct(o);
  return k < 4500 ? [255, Math.round(g * 0.85), Math.round(b * 0.55)] : k > 6500 ? [Math.round(r * 0.75), Math.round(g * 0.9), 255] : [r, g, b];
}

export const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r},${g},${b},${a})`;
