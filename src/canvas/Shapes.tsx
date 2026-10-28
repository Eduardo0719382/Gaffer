// Dibujo de cada tipo de objeto. Coordenadas locales en metros; el frente (hacia donde
// apunta una luz, cámara o actor) es el eje +x. Íconos genéricos, propios.
import { Arc, Circle, Ellipse, Group, Line, Rect, Text, Wedge } from 'react-konva';
import type { Obj } from '../model';
import { beamColor, rgba } from '../lib/color';

const SW = 0.02; // grosor de línea estándar (m)

export function LightIcon({ o, stroke }: { o: Obj; stroke: string }) {
  const t = o.fixture?.type ?? 'cob';
  const w = o.w, h = o.h;
  const body = '#2b2f36';
  switch (t) {
    case 'panel':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={body} stroke={stroke} strokeWidth={SW} cornerRadius={0.02} />
        <Rect x={w / 2 - 0.03} y={-h / 2 + 0.03} width={0.03} height={h - 0.06} fill="#f8fafc" />
      </Group>;
    case 'tube':
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#e5e7eb" stroke={stroke} strokeWidth={SW} cornerRadius={0.03} />;
    case 'fresnel':
    case 'hmi':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w * 0.8} height={h} fill={body} stroke={stroke} strokeWidth={SW} cornerRadius={0.03} />
        <Rect x={w * 0.3} y={-h / 2 + 0.04} width={0.05} height={h - 0.08} fill="#bfdbfe" />
        <Line points={[w * 0.35, -h / 2, w * 0.55, -h / 2 - 0.12]} stroke={body} strokeWidth={0.03} />
        <Line points={[w * 0.35, h / 2, w * 0.55, h / 2 + 0.12]} stroke={body} strokeWidth={0.03} />
        {t === 'hmi' && <Text x={-w / 2 + 0.04} y={-0.07} text="HMI" fontSize={0.13} fontStyle="bold" fill="#fff" />}
      </Group>;
    case 'practical':
      return <Group>
        <Circle radius={w / 2} fill="#fde68a" stroke={stroke} strokeWidth={SW} />
        <Circle radius={w / 5} fill="#f59e0b" />
      </Group>;
    case 'mini':
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={body} stroke={stroke} strokeWidth={SW} cornerRadius={0.01} />;
    case 'sun':
      return <Group>
        <Circle radius={0.16} fill="#fcd34d" stroke="#b45309" strokeWidth={SW} />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <Line key={i} points={[Math.cos(a) * 0.2, Math.sin(a) * 0.2, Math.cos(a) * 0.27, Math.sin(a) * 0.27]} stroke="#b45309" strokeWidth={0.025} />;
        })}
      </Group>;
    default: // cob con reflector
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w * 0.6} height={h} fill={body} stroke={stroke} strokeWidth={SW} cornerRadius={0.03} />
        <Line closed points={[w * 0.1, -h * 0.3, w / 2, -h * 0.55, w / 2, h * 0.55, w * 0.1, h * 0.3]} fill="#9ca3af" stroke={body} strokeWidth={SW} />
      </Group>;
  }
}

export function Beam({ o }: { o: Obj }) {
  const c = beamColor(o);
  const ang = o.beamAngle ?? 50;
  const r = o.throw ?? 4;
  const alpha = (o.diffusion ? 0.35 : 0.5) * (0.35 + 0.65 * ((o.intensity ?? 100) / 100));
  return <Wedge
    angle={Math.min(ang, 359)} radius={r} rotation={-Math.min(ang, 359) / 2}
    fillRadialGradientStartPoint={{ x: 0, y: 0 }} fillRadialGradientEndPoint={{ x: 0, y: 0 }}
    fillRadialGradientStartRadius={0} fillRadialGradientEndRadius={r}
    fillRadialGradientColorStops={[0, rgba(c, alpha), 0.7, rgba(c, alpha * 0.45), 1, rgba(c, 0)]}
    stroke={rgba(c, 0.55)} strokeWidth={0.015} dash={[0.08, 0.06]} listening={false}
  />;
}

export function CameraFov({ o, fov }: { o: Obj; fov: number }) {
  const r = o.throw ?? 4;
  return <Wedge angle={fov} radius={r} rotation={-fov / 2} fill="rgba(30,41,59,0.06)" stroke="#334155" strokeWidth={0.02} dash={[0.15, 0.1]} listening={false} />;
}

export function ObjShape({ o }: { o: Obj }) {
  const { w, h, color } = o;
  switch (o.kind) {
    case 'light':
      return <LightIcon o={o} stroke={rgba(beamColor(o), 1)} />;
    case 'camera':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w * 0.75} height={h} fill={color} cornerRadius={0.03} />
        <Rect x={w * 0.25} y={-h * 0.3} width={w * 0.25} height={h * 0.6} fill="#475569" />
        <Circle x={-w * 0.15} y={-h / 2 - 0.04} radius={0.05} fill={color} />
      </Group>;
    case 'actor':
      return <Group>
        <Ellipse radiusX={w / 2} radiusY={h / 2} fill={color} stroke="#7c2d12" strokeWidth={SW} />
        <Circle radius={0.12} fill="#fde7c7" stroke="#7c2d12" strokeWidth={SW} />
        <Line closed points={[0.13, -0.05, 0.22, 0, 0.13, 0.05]} fill="#7c2d12" />
      </Group>;
    case 'modifier':
      return <ModifierShape o={o} />;
    case 'prop':
      return <PropShape o={o} />;
    case 'wall':
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={color} />;
    case 'door':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#ffffff" />
        <Line points={[-w / 2, 0, -w / 2, -w]} stroke={color} strokeWidth={0.04} />
        <Arc x={-w / 2} y={0} innerRadius={w} outerRadius={w} angle={90} rotation={-90} stroke={color} strokeWidth={0.015} dash={[0.06, 0.05]} />
      </Group>;
    case 'window':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#e0f2fe" stroke="#0369a1" strokeWidth={SW} />
        <Line points={[-w / 2, 0, w / 2, 0]} stroke="#0369a1" strokeWidth={SW} />
      </Group>;
    case 'power':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={color} stroke="#713f12" strokeWidth={SW} cornerRadius={0.04} />
        <Line closed points={[0.03, -0.15, -0.08, 0.02, 0, 0.02, -0.03, 0.15, 0.08, -0.02, 0, -0.02]} fill="#713f12" />
      </Group>;
    case 'text':
      return <Text text={o.text ?? ''} fontSize={o.fontSize ?? 0.3} fill={color} fontStyle="bold" />;
  }
}

function ModifierShape({ o }: { o: Obj }) {
  const { w, h } = o;
  switch (o.sub) {
    case 'lantern':
      return <Circle radius={w / 2} fill="rgba(255,255,255,0.85)" stroke="#64748b" strokeWidth={SW} />;
    case 'softbox':
      return <Line closed points={[-w / 2, -h * 0.2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h * 0.2]} fill="#1f2937" stroke="#1f2937" strokeWidth={SW}
        shadowForStrokeEnabled={false} />;
    case 'flag': case 'neg':
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#111" />;
    case 'net':
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#6b7280" stroke="#111" strokeWidth={0.01} dash={[0.04, 0.03]} />;
    case 'bounce':
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#fff" stroke="#64748b" strokeWidth={SW} dash={[0.05, 0.04]} />;
    default: // frame
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="rgba(255,255,255,0.9)" stroke="#475569" strokeWidth={SW} />
        <Circle y={-h / 2} radius={0.05} fill="#475569" />
        <Circle y={h / 2} radius={0.05} fill="#475569" />
      </Group>;
  }
}

function PropShape({ o }: { o: Obj }) {
  const { w, h, color } = o;
  const stroke = '#6b5b45';
  switch (o.sub) {
    case 'round':
      return <Circle radius={w / 2} fill={color} stroke={stroke} strokeWidth={SW} />;
    case 'plant':
      return <Group>
        <Circle radius={w / 2} fill={color} opacity={0.85} />
        <Circle radius={w / 5} fill="#365314" />
      </Group>;
    case 'chair':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={color} stroke={stroke} strokeWidth={SW} cornerRadius={0.04} />
        <Rect x={-w / 2} y={-h / 2} width={0.08} height={h} fill={stroke} />
      </Group>;
    case 'sofa':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={color} stroke={stroke} strokeWidth={SW} cornerRadius={0.1} />
        <Rect x={-w / 2} y={-h / 2} width={w} height={0.22} fill={stroke} cornerRadius={0.08} />
      </Group>;
    case 'bed':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#f1f5f9" stroke={stroke} strokeWidth={SW} />
        <Rect x={-w / 2 + 0.05} y={-h / 2 + 0.1} width={0.35} height={h - 0.2} fill="#ffffff" stroke="#cbd5e1" strokeWidth={0.01} cornerRadius={0.05} />
        <Rect x={-w / 2 + 0.5} y={-h / 2} width={w - 0.5} height={h} fill={color} opacity={0.6} />
      </Group>;
    case 'car':
      return <Group>
        <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#64748b" stroke="#1e293b" strokeWidth={0.03} cornerRadius={0.35} />
        <Rect x={w * 0.05} y={-h / 2 + 0.15} width={w * 0.18} height={h - 0.3} fill="#bae6fd" cornerRadius={0.08} />
        <Rect x={-w * 0.33} y={-h / 2 + 0.15} width={w * 0.14} height={h - 0.3} fill="#bae6fd" cornerRadius={0.08} />
      </Group>;
    default:
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={color} stroke={stroke} strokeWidth={SW} cornerRadius={0.03} />;
  }
}
