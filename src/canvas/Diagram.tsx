import Konva from 'konva';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import { LayerId, Obj, Scene, layerOf, makeWall } from '../model';
import { currentScene, useStore } from '../store';
import { Beam, CameraFov, ObjShape } from './Shapes';
import { cameraFov } from '../lib/calc';
import { beamColor, effectiveCct, rgba } from '../lib/color';

Konva.hitOnDragEnabled = true;

const PX_PER_M = 50;
const MIN_SCALE = 8, MAX_SCALE = 600;

// API para que el resto de la app hable con el canvas (exportar, agregar al centro, encuadrar).
export const viewApi = {
  stage: null as Konva.Stage | null,
  center: () => ({ x: 0, y: 0 }),
  fit: () => {},
  zoom: (_f: number) => {},
  bounds: () => ({ x0: 0, y0: 0, x1: 1, y1: 1 }),
};

export function DiagramCanvas({ resolveItem }: { resolveItem: (key: string) => Obj | null }) {
  const scene = useStore(s => currentScene(s));
  const selectedId = useStore(s => s.selectedId);
  const tool = useStore(s => s.tool);
  const hidden = useStore(s => s.hidden);
  const locked = useStore(s => s.locked);
  const settings = useStore(s => s.project!.settings);
  const { select, updateObject, addObject, setPanel } = useStore.getState();

  const wrap = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [size, setSize] = useState({ w: 0, h: 0 }); // se mide antes de encuadrar
  const [view, setView] = useState({ x: 400, y: 300, scale: PX_PER_M });
  const [wallDraft, setWallDraft] = useState<{ a: P; b: P } | null>(null);
  const draftRef = useRef<{ a: P; b: P } | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const snapV = (v: number) => (settings.snap ? Math.round(v / settings.grid) * settings.grid : v);

  // ---- API externa ----
  useEffect(() => {
    viewApi.stage = stageRef.current;
    viewApi.center = () => {
      const st = stageRef.current!;
      return { x: snapV((size.w / 2 - st.x()) / st.scaleX()), y: snapV((size.h / 2 - st.y()) / st.scaleX()) };
    };
    viewApi.fit = () => setView(fitView(scene, size));
    viewApi.bounds = () => sceneBounds(scene, labelFont(stageRef.current!.scaleX()), settings.labelDetail);
    viewApi.zoom = f => {
      const st = stageRef.current!;
      zoomAt(st, { x: size.w / 2, y: size.h / 2 }, f);
      setView({ x: st.x(), y: st.y(), scale: st.scaleX() });
    };
  });

  // Encuadra al abrir/cambiar de escena.
  const sceneId = scene?.id;
  useEffect(() => { if (size.w > 10) setView(fitView(scene, size)); }, [sceneId, size.w > 10]); // eslint-disable-line

  // ---- Transformer sobre el seleccionado ----
  const selected = scene?.objects.find(o => o.id === selectedId);
  const selLocked = selected ? locked[layerOf(selected)] || hidden[layerOf(selected)] : true;
  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selected && !selLocked ? stageRef.current?.findOne('#obj-' + selected.id) : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  });

  const pinch = useRef<{ center: P | null; dist: number }>({ center: null, dist: 0 });
  const wallEnds = useMemo(() => (scene?.objects ?? []).filter(o => o.kind === 'wall').flatMap(wallEndpoints), [scene?.objects]);

  if (!scene) return null;

  // ---- Sincronizar haz/etiqueta mientras se arrastra o rota ----
  const syncSatellites = (o: Obj, node: Konva.Node) => {
    const st = stageRef.current!;
    const beam = st.findOne('#beam-' + o.id);
    beam?.position(node.position());
    beam?.rotation(node.rotation());
    const label = st.findOne('#label-' + o.id);
    if (label) {
      label.position({ x: node.x() + o.labelDx, y: node.y() + o.labelDy });
      updateLeader(st, o.id, node.position(), label);
    }
  };

  const onObjDragMove = (o: Obj) => (e: Konva.KonvaEventObject<DragEvent>) => {
    const n = e.target;
    if (settings.snap) n.position({ x: snapV(n.x()), y: snapV(n.y()) });
    syncSatellites(o, n);
  };
  const onObjDragEnd = (o: Obj) => (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateObject(o.id, { x: round(e.target.x()), y: round(e.target.y()) });
  };
  const onTransformEnd = (o: Obj) => (e: Konva.KonvaEventObject<Event>) => {
    const n = e.target;
    const patch: Partial<Obj> = { x: round(n.x()), y: round(n.y()), rot: Math.round(norm(n.rotation())) };
    if (n.scaleX() !== 1 || n.scaleY() !== 1) {
      patch.w = round(Math.max(0.05, o.w * Math.abs(n.scaleX())));
      patch.h = round(Math.max(0.03, o.h * Math.abs(n.scaleY())));
      n.scale({ x: 1, y: 1 });
    }
    updateObject(o.id, patch);
  };
  const onLabelDragMove = (o: Obj) => (e: Konva.KonvaEventObject<DragEvent>) => {
    updateLeader(stageRef.current!, o.id, { x: o.x, y: o.y }, e.target);
  };
  const onLabelDragEnd = (o: Obj) => (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    updateObject(o.id, { labelDx: round(e.target.x() - o.x), labelDy: round(e.target.y() - o.y) });
  };

  // ---- Zoom con rueda ----
  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const st = stageRef.current!;
    zoomAt(st, st.getPointerPosition()!, e.evt.deltaY > 0 ? 1 / 1.12 : 1.12);
    setView({ x: st.x(), y: st.y(), scale: st.scaleX() });
  };

  // ---- Pellizco (dos dedos) ----
  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches;
    if (t.length !== 2) return;
    e.evt.preventDefault();
    const st = stageRef.current!;
    if (st.isDragging()) st.stopDrag();
    st.find('.obj').forEach(n => { if (n.isDragging()) n.stopDrag(); });
    const r = st.container().getBoundingClientRect();
    const p1 = { x: t[0].clientX - r.left, y: t[0].clientY - r.top };
    const p2 = { x: t[1].clientX - r.left, y: t[1].clientY - r.top };
    const c = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const pr = pinch.current;
    if (!pr.center) { pr.center = c; pr.dist = d; return; }
    const old = st.scaleX();
    const scale = clamp(old * (d / pr.dist), MIN_SCALE, MAX_SCALE);
    const pointTo = { x: (c.x - st.x()) / old, y: (c.y - st.y()) / old };
    st.scale({ x: scale, y: scale });
    st.position({ x: c.x - pointTo.x * scale + (c.x - pr.center.x), y: c.y - pointTo.y * scale + (c.y - pr.center.y) });
    pr.center = c; pr.dist = d;
  };
  const onTouchEnd = () => {
    const pr = pinch.current;
    if (pr.center) {
      pr.center = null; pr.dist = 0;
      const st = stageRef.current!;
      setView({ x: st.x(), y: st.y(), scale: st.scaleX() });
    }
  };

  // ---- Herramienta Pared ----
  const snapWall = (p: P): P => {
    for (const q of wallEnds) if (Math.hypot(p.x - q.x, p.y - q.y) < 0.3) return q;
    return { x: snapV(p.x), y: snapV(p.y) };
  };
  // El borrador vive en una ref para que eventos seguidos no lean un estado viejo.
  const setDraft = (d: { a: P; b: P } | null) => { draftRef.current = d; setWallDraft(d); };
  const onPointerDown = (e: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool !== 'wall' || !e.evt.isPrimary) return;
    const p = snapWall(stageRef.current!.getRelativePointerPosition()!);
    setDraft({ a: p, b: p });
  };
  const onPointerMove = () => {
    const d = draftRef.current;
    if (!d) return;
    let b = snapWall(stageRef.current!.getRelativePointerPosition()!);
    if (settings.snap) b = snapAngle(d.a, b);
    setDraft({ a: d.a, b });
  };
  const onPointerUp = () => {
    const d = draftRef.current;
    if (!d) return;
    const { a, b } = d;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    setDraft(null);
    if (len < 0.2) return;
    const w = makeWall(round(len));
    w.x = round((a.x + b.x) / 2); w.y = round((a.y + b.y) / 2);
    w.rot = Math.round(norm((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI));
    addObject(w);
    useStore.getState().select(null);
  };

  const onStageTap = (e: Konva.KonvaEventObject<Event>) => {
    if (tool === 'select' && (e.target === stageRef.current || e.target.hasName('bg'))) select(null);
  };

  // ---- Soltar desde la librería (escritorio) ----
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData('text/gaffer');
    const o = key ? resolveItem(key) : null;
    const st = stageRef.current;
    if (!o || !st) return;
    st.setPointersPositions(e.nativeEvent);
    const p = st.getRelativePointerPosition()!;
    o.x = snapV(p.x); o.y = snapV(p.y);
    addObject(o);
  };

  const visible = (l: LayerId) => !hidden[l];
  const draggable = (o: Obj) => tool === 'select' && !locked[layerOf(o)];
  const minHit = 34 / view.scale;
  const objs = scene.objects;
  const order: LayerId[] = ['set', 'props', 'grip', 'talent', 'lights'];

  const renderObj = (o: Obj) => {
    const hw = Math.max(o.w, minHit), hh = Math.max(o.h, minHit);
    const isText = o.kind === 'text';
    const tap = () => { if (tool === 'select') select(o.id); };
    return (
      <Group key={o.id} id={'obj-' + o.id} name="obj" x={o.x} y={o.y} rotation={o.rot}
        draggable={draggable(o)} listening={draggable(o)}
        onClick={tap} onTap={tap} onDblClick={() => setPanel('props')} onDblTap={() => setPanel('props')}
        onDragStart={tap} onDragMove={onObjDragMove(o)} onDragEnd={onObjDragEnd(o)}
        onTransform={e => syncSatellites(o, e.target)} onTransformEnd={onTransformEnd(o)}>
        <Rect x={isText ? 0 : -hw / 2} y={isText ? 0 : -hh / 2} width={hw} height={hh} fill="rgba(0,0,0,0)" />
        <ObjShape o={o} />
      </Group>
    );
  };

  const trConfig = selected ? transformerFor(selected) : {};

  return (
    <div ref={wrap} className={'canvas-wrap' + (tool === 'wall' ? ' tool-wall' : '')}
      onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <Stage ref={stageRef} width={size.w} height={size.h} x={view.x} y={view.y} scaleX={view.scale} scaleY={view.scale}
        draggable={tool === 'select'}
        onDragEnd={e => { if (e.target === stageRef.current) setView({ x: e.target.x(), y: e.target.y(), scale: view.scale }); }}
        onWheel={onWheel} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onClick={onStageTap} onTap={onStageTap}>
        <Layer>
          <Grid view={view} size={size} />
        </Layer>
        <Layer>
          {order.slice(0, 2).filter(visible).map(l => <Group key={l}>{objs.filter(o => layerOf(o) === l).map(renderObj)}</Group>)}
          {visible('beams') && <Group>
            {objs.filter(o => o.kind === 'light' && o.beamOn && visible('lights')).map(o =>
              <Group key={o.id} id={'beam-' + o.id} x={o.x} y={o.y} rotation={o.rot} listening={false}><Beam o={o} /></Group>)}
            {objs.filter(o => o.kind === 'camera' && o.beamOn && visible('talent')).map(o =>
              <Group key={o.id} id={'beam-' + o.id} x={o.x} y={o.y} rotation={o.rot} listening={false}><CameraFov o={o} fov={cameraFov(o)} /></Group>)}
          </Group>}
          {order.slice(2).filter(visible).map(l => <Group key={l}>{objs.filter(o => layerOf(o) === l).map(renderObj)}</Group>)}
        </Layer>
        <Layer>
          {visible('labels') && objs.filter(o => o.showLabel && o.kind !== 'text' && visible(layerOf(o))).map(o =>
            <LabelNode key={o.id} o={o} detail={settings.labelDetail} fs={labelFont(view.scale)} draggable={tool === 'select' && !locked.labels}
              onDragMove={onLabelDragMove(o)} onDragEnd={onLabelDragEnd(o)} onTap={() => tool === 'select' && select(o.id)} />)}
          {wallDraft && <Line points={[wallDraft.a.x, wallDraft.a.y, wallDraft.b.x, wallDraft.b.y]} stroke="#2563eb" strokeWidth={0.15} lineCap="round" opacity={0.7} />}
          {wallDraft && <Text x={wallDraft.b.x + 0.2} y={wallDraft.b.y + 0.2} fontSize={14 / view.scale} fill="#2563eb" fontStyle="bold"
            text={`${Math.hypot(wallDraft.b.x - wallDraft.a.x, wallDraft.b.y - wallDraft.a.y).toFixed(2)} m`} />}
          <Transformer ref={trRef} name="ui" rotateAnchorOffset={28} anchorSize={16} borderStroke="#2563eb" anchorStroke="#2563eb"
            anchorCornerRadius={8} rotationSnaps={settings.snap ? Array.from({ length: 24 }, (_, i) => i * 15) : []} rotationSnapTolerance={7}
            ignoreStroke flipEnabled={false} {...trConfig} />
        </Layer>
      </Stage>
      <ScaleBar scale={view.scale} />
    </div>
  );
}

// ---------- Etiquetas ----------
const measureCtx = document.createElement('canvas').getContext('2d')!;
function textWidth(t: string, size: number, bold = false) {
  measureCtx.font = `${bold ? 'bold ' : ''}100px Inter, system-ui, sans-serif`;
  return (measureCtx.measureText(t).width / 100) * size;
}

export function labelLines(o: Obj, detail: 'simple' | 'full'): string[] {
  const lines: string[] = [];
  if (o.kind === 'light' && o.fixture) {
    const model = `${o.fixture.brand === 'Genérico' ? '' : o.fixture.brand + ' '}${o.fixture.model}`;
    lines.push(o.label || model);
    if (o.label) lines.push(model);
    if (detail === 'full') {
      const bits = [o.fixture.type !== 'sun' ? `${effectiveCct(o)}K` : '', o.fixture.type !== 'sun' ? `${o.intensity ?? 100}%` : '', o.gel ?? '', o.diffusion ?? ''].filter(Boolean);
      if (bits.length) lines.push(bits.join(' · '));
      if (o.circuit) lines.push(`Circ. ${o.circuit}`);
    }
  } else if (o.kind === 'modifier') {
    lines.push(o.label || 'Modificador');
    if (detail === 'full' && o.material && o.material !== o.label) lines.push(o.material);
  } else if (o.kind === 'camera') {
    lines.push(o.label || 'Cámara');
    if (detail === 'full') lines.push(`${o.lens ?? 35} mm`);
  } else {
    lines.push(o.label || '');
  }
  return lines.filter(Boolean);
}

// Tamaño de letra de etiquetas: 0.2 m, pero nunca menos de ~11 px en pantalla para que se lea.
export const labelFont = (scale: number) => Math.max(0.2, 11 / scale);

function labelBox(o: Obj, detail: 'simple' | 'full', FS: number) {
  const PAD = FS * 0.3;
  const lines = labelLines(o, detail);
  const w = Math.max(...lines.map((l, i) => textWidth(l, FS, i === 0)), FS) + PAD * 2;
  const h = lines.length * FS * 1.25 + PAD * 2 - FS * 0.25;
  return { lines, w, h, PAD };
}

function LabelNode({ o, detail, fs: FS, draggable, onDragMove, onDragEnd, onTap }: {
  o: Obj; detail: 'simple' | 'full'; fs: number; draggable: boolean;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void; onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void; onTap: () => void;
}) {
  const { lines, w, h, PAD } = labelBox(o, detail, FS);
  const accent = o.kind === 'light' ? rgba(beamColor(o), 1) : '#64748b';
  const lx = o.x + o.labelDx, ly = o.y + o.labelDy;
  const end = leaderEnd({ x: o.x, y: o.y }, { x: lx, y: ly }, w, h);
  const far = Math.hypot(end.x - o.x, end.y - o.y) > 0.35;
  return <>
    <Line id={'leader-' + o.id} points={[o.x, o.y, end.x, end.y]} stroke="#475569" strokeWidth={FS / 13} visible={far} listening={false} />
    <Group id={'label-' + o.id} x={lx} y={ly} draggable={draggable} onDragMove={onDragMove} onDragEnd={onDragEnd} onClick={onTap} onTap={onTap}
>
      <Rect width={w} height={h} fill="rgba(255,255,255,0.94)" stroke={accent} strokeWidth={FS / 10} cornerRadius={FS / 5} name="labelbox" />
      {lines.map((l, i) => <Text key={i} x={PAD} y={PAD + i * FS * 1.25} text={l} fontSize={FS * (i === 0 ? 1 : 0.9)} fontStyle={i === 0 ? 'bold' : 'normal'} fill={i === 0 ? '#0f172a' : '#334155'} fontFamily="Inter, system-ui, sans-serif" />)}
    </Group>
  </>;
}

function leaderEnd(from: P, tl: P, w: number, h: number): P {
  // Punto del borde de la etiqueta más cercano al objeto.
  return { x: clamp(from.x, tl.x, tl.x + w), y: clamp(from.y, tl.y, tl.y + h) };
}

function updateLeader(st: Konva.Stage, id: string, from: P, label: Konva.Node) {
  const line = st.findOne('#leader-' + id) as Konva.Line | undefined;
  const box = (label as Konva.Group).findOne('.labelbox') as Konva.Rect | undefined;
  if (!line || !box) return;
  const end = leaderEnd(from, label.position(), box.width(), box.height());
  line.points([from.x, from.y, end.x, end.y]);
  line.visible(Math.hypot(end.x - from.x, end.y - from.y) > 0.35);
}

// ---------- Cuadrícula y escala ----------
function Grid({ view, size }: { view: { x: number; y: number; scale: number }; size: { w: number; h: number } }) {
  const x0 = -view.x / view.scale, y0 = -view.y / view.scale;
  const x1 = x0 + size.w / view.scale, y1 = y0 + size.h / view.scale;
  const mx = (x1 - x0), my = (y1 - y0);
  const ax = Math.floor(x0 - mx), bx = Math.ceil(x1 + mx), ay = Math.floor(y0 - my), by = Math.ceil(y1 + my);
  const step = view.scale < 15 ? 5 : 1;
  const lines: JSX.Element[] = [];
  for (let x = Math.ceil(ax / step) * step; x <= bx; x += step) {
    const major = x % 5 === 0;
    lines.push(<Line key={'x' + x} points={[x, ay, x, by]} stroke={major ? '#cbd5e1' : '#e5e9f0'} strokeWidth={(major ? 1.2 : 0.8) / view.scale} listening={false} />);
  }
  for (let y = Math.ceil(ay / step) * step; y <= by; y += step) {
    const major = y % 5 === 0;
    lines.push(<Line key={'y' + y} points={[ax, y, bx, y]} stroke={major ? '#cbd5e1' : '#e5e9f0'} strokeWidth={(major ? 1.2 : 0.8) / view.scale} listening={false} />);
  }
  return <>
    <Rect name="bg" x={ax} y={ay} width={bx - ax} height={by - ay} fill="#ffffff" />
    {lines}
  </>;
}

function ScaleBar({ scale }: { scale: number }) {
  const meters = scale < 15 ? 5 : scale > 150 ? 0.5 : 1;
  return <div className="scalebar"><div style={{ width: meters * scale }} /><span>{meters} m</span></div>;
}

// ---------- Utilidades ----------
type P = { x: number; y: number };
const round = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const norm = (deg: number) => ((deg % 360) + 360) % 360;

function zoomAt(st: Konva.Stage, p: P, f: number) {
  const old = st.scaleX();
  const scale = clamp(old * f, MIN_SCALE, MAX_SCALE);
  const pointTo = { x: (p.x - st.x()) / old, y: (p.y - st.y()) / old };
  st.scale({ x: scale, y: scale });
  st.position({ x: p.x - pointTo.x * scale, y: p.y - pointTo.y * scale });
}

function wallEndpoints(o: Obj): P[] {
  const a = (o.rot * Math.PI) / 180, dx = Math.cos(a) * o.w / 2, dy = Math.sin(a) * o.w / 2;
  return [{ x: o.x - dx, y: o.y - dy }, { x: o.x + dx, y: o.y + dy }];
}

function snapAngle(a: P, b: P): P {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const step = Math.PI / 12;
  const s = Math.round(ang / step) * step;
  if (Math.abs(s - ang) > 0.06) return b;
  return { x: round(a.x + Math.cos(s) * len), y: round(a.y + Math.sin(s) * len) };
}

// Límites reales del contenido en metros: objetos, abanico de los haces y etiquetas.
export function sceneBounds(scene: Scene | undefined, fs = 0.25, detail: 'simple' | 'full' = 'full') {
  if (!scene || !scene.objects.length) return { x0: -4, y0: -3, x1: 4, y1: 3 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const o of scene.objects) {
    const r = Math.hypot(o.w, o.h) / 2;
    add(o.x - r, o.y - r); add(o.x + r, o.y + r);
    const fov = o.kind === 'camera' ? cameraFov(o) : o.kind === 'light' ? Math.min(o.beamAngle ?? 0, 359) : 0;
    if (fov && o.beamOn && o.throw) {
      for (let i = 0; i <= 8; i++) {
        const a = ((o.rot - fov / 2 + (fov * i) / 8) * Math.PI) / 180;
        add(o.x + Math.cos(a) * o.throw, o.y + Math.sin(a) * o.throw);
      }
    }
    if (o.showLabel && o.kind !== 'text') {
      const b = labelBox(o, detail, fs);
      add(o.x + o.labelDx, o.y + o.labelDy); add(o.x + o.labelDx + b.w, o.y + o.labelDy + b.h);
    }
    if (o.kind === 'text') add(o.x + o.w, o.y + o.h);
  }
  return { x0, y0, x1, y1 };
}

function fitView(scene: Scene | undefined, size: { w: number; h: number }) {
  const b = sceneBounds(scene);
  const scale = clamp(Math.min(size.w / (b.x1 - b.x0), size.h / (b.y1 - b.y0)) * 0.92, MIN_SCALE, 150);
  return { scale, x: size.w / 2 - ((b.x0 + b.x1) / 2) * scale, y: size.h / 2 - ((b.y0 + b.y1) / 2) * scale };
}

function transformerFor(o: Obj): Partial<Konva.TransformerConfig> {
  switch (o.kind) {
    case 'wall': case 'door': case 'window':
      return { resizeEnabled: true, keepRatio: false, enabledAnchors: ['middle-left', 'middle-right'] };
    case 'modifier':
      return o.sub === 'lantern'
        ? { resizeEnabled: true, keepRatio: true, enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] }
        : { resizeEnabled: true, keepRatio: false, enabledAnchors: ['top-center', 'bottom-center'] };
    case 'prop':
      return { resizeEnabled: true, keepRatio: false, enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center'] };
    default:
      return { resizeEnabled: false };
  }
}
