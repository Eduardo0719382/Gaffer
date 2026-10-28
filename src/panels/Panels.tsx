import { useState } from 'react';
import { Group, Layer, Stage } from 'react-konva';
import { LAYERS, Scene, uid } from '../model';
import { currentScene, useScene, useStore } from '../store';
import { Field, Modal, Num, Select, Text, Toggle, toast } from '../ui';
import { circuitLoads, gearAsText, gearForProject, gearForScene } from '../lib/calc';
import { shareText } from '../lib/platform';
import { TEMPLATES } from '../templates';
import { Beam, ObjShape } from '../canvas/Shapes';
import { sceneBounds } from '../canvas/Diagram';

// ---------- Capas y ajustes ----------
export function LayersPanel() {
  const hidden = useStore(s => s.hidden);
  const locked = useStore(s => s.locked);
  const settings = useStore(s => s.project!.settings);
  const { toggleHidden, toggleLocked, commit } = useStore.getState();
  const setS = (p: Partial<typeof settings>) => commit(pr => { Object.assign(pr.settings, p); });
  return <div className="layers">
    <h4>Capas</h4>
    {LAYERS.map(l => <div key={l.id} className="layer-row">
      <span className={hidden[l.id] ? 'muted' : ''}>{l.name}</span>
      <button className={'chip' + (hidden[l.id] ? '' : ' on')} onClick={() => toggleHidden(l.id)}>{hidden[l.id] ? 'Oculta' : 'Visible'}</button>
      <button className={'chip' + (locked[l.id] ? ' warn' : '')} onClick={() => toggleLocked(l.id)}>{locked[l.id] ? 'Bloqueada' : 'Libre'}</button>
    </div>)}
    <p className="muted small">Bloquea "Escenografía" cuando termines las paredes para no moverlas por accidente.</p>
    <h4>Ajustes del plano</h4>
    <Toggle on={settings.snap} onChange={v => setS({ snap: v })} label={`Imán a cuadrícula (${settings.grid} m) y giros de 15°`} />
    <Field label="Paso de la cuadrícula">
      <Select value={settings.grid} options={[0.1, 0.25, 0.5, 1].map(v => ({ v, t: `${v} m` }))} onChange={v => setS({ grid: v })} />
    </Field>
    <Field label="Detalle de etiquetas">
      <Select value={settings.labelDetail} options={[{ v: 'full', t: 'Completo (CCT, %, gel, circuito)' }, { v: 'simple', t: 'Solo nombre' }]} onChange={v => setS({ labelDetail: v })} />
    </Field>
  </div>;
}

// ---------- Gear list ----------
export function GearPanel() {
  const project = useStore(s => s.project!);
  const scene = useScene()!;
  const [scope, setScope] = useState<'scene' | 'project'>('scene');
  const rows = scope === 'scene' ? gearForScene(scene) : gearForProject(project);
  const title = scope === 'scene' ? `${project.name} — ${scene.name}` : `${project.name} (todas las escenas)`;
  let g = '';
  return <div className="gear">
    <div className="seg">
      <button className={scope === 'scene' ? 'on' : ''} onClick={() => setScope('scene')}>Esta escena</button>
      <button className={scope === 'project' ? 'on' : ''} onClick={() => setScope('project')}>Todo el proyecto</button>
    </div>
    {!rows.length && <p className="muted">Agrega luces y grip al plano y la lista se arma sola.</p>}
    <table className="tbl">
      <tbody>{rows.map(r => {
        const head = r.group !== g; g = r.group;
        return [head && <tr key={'h' + r.group} className="grp"><td colSpan={2}>{r.group}</td></tr>,
          <tr key={r.group + r.item}><td className="qty">{r.qty}</td><td>{r.item}</td></tr>];
      })}</tbody>
    </table>
    {scope === 'project' && <p className="muted small">El total es el máximo que se usa al mismo tiempo en una escena.</p>}
    {!!rows.length && <button className="btn primary wide" onClick={async () => {
      const r = await shareText('Lista de equipo', gearAsText(title, rows));
      if (r === 'copied') toast('Lista copiada. Pégala en WhatsApp o correo.');
    }}>Copiar / compartir lista</button>}
  </div>;
}

// ---------- Carga eléctrica ----------
export function PowerPanel() {
  const project = useStore(s => s.project!);
  const scene = useScene()!;
  const s = project.settings;
  const { commit } = useStore.getState();
  const loads = circuitLoads(scene, s);
  const setS = (fn: (st: typeof s) => void) => commit(p => fn(p.settings));
  const nextId = () => { for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!s.circuits.some(x => x.id === c)) return c; return uid().slice(0, 3); };
  return <div className="power">
    <div className="form-grid">
      <Field label="Voltaje">
        <Select value={s.voltage} options={[110, 120, 127, 208, 220, 230, 240].map(v => ({ v, t: `${v} V` }))} onChange={v => setS(st => { st.voltage = v; })} />
      </Field>
    </div>
    <Toggle on={s.scaleByIntensity} onChange={v => setS(st => { st.scaleByIntensity = v; })} label="Calcular según intensidad (LED atenuado consume menos)" />
    <div className="loads">
      {loads.circuits.map(c => <div key={c.id || 'none'} className={'load ' + c.status}>
        <div className="load-head"><b>{c.name}</b><span>{Math.round(c.watts)} W · {c.amps.toFixed(1)} A{c.breaker ? ` / ${c.breaker} A` : ''}</span></div>
        {c.breaker > 0 && <div className="bar"><div style={{ width: Math.min(100, c.pct) + '%' }} /><i style={{ left: '80%' }} /></div>}
        {c.status === 'over' && <p className="alert">Sobrecarga: reparte luces en otro circuito.</p>}
        {c.status === 'none' && <p className="alert warn">Estas luces no tienen circuito: asígnalas en sus datos.</p>}
        {c.status === 'warn' && <p className="alert warn">Arriba del 80 %: un breaker puede botarse con carga continua.</p>}
        <p className="muted small">{c.lights.map(l => l.label || l.fixture?.model).join(', ') || 'Sin luces'}</p>
      </div>)}
      <div className="load total"><div className="load-head"><b>Total escena</b><span>{Math.round(loads.totalW)} W · {loads.totalA.toFixed(1)} A</span></div></div>
    </div>
    <h4>Circuitos</h4>
    {s.circuits.map((c, i) => <div key={c.id} className="circuit-row">
      <Text value={c.name} onChange={v => setS(st => { st.circuits[i].name = v; })} />
      <Num value={c.amps} min={1} max={400} suffix="A" onChange={v => setS(st => { st.circuits[i].amps = v; })} />
      <button className="icon-btn" aria-label="Quitar circuito" onClick={() => setS(st => { st.circuits.splice(i, 1); })}>✕</button>
    </div>)}
    <button className="btn wide" onClick={() => setS(st => { const id = nextId(); st.circuits.push({ id, name: `Circuito ${id}`, amps: 20 }); })}>＋ Agregar circuito</button>
    <p className="muted small">Amperes = watts ÷ voltaje. Consumos aproximados de ficha; para HMI incluye el balastro.</p>
  </div>;
}

// ---------- Escena ----------
export function ScenePanel({ onOverview }: { onOverview: () => void }) {
  const scene = useScene()!;
  const count = useStore(s => s.project!.scenes.length);
  const { commit, duplicateScene, removeScene } = useStore.getState();
  return <div className="scene-panel">
    <Field label="Nombre de la escena"><Text value={scene.name} onChange={v => commit((_, s) => { s.name = v; })} /></Field>
    <Field label="Notas de la escena"><Text value={scene.notes} placeholder="ej. INT. COCINA – NOCHE. Plano general y 2 cerrados." onChange={v => commit((_, s) => { s.notes = v; })} multiline /></Field>
    <div className="row wrap">
      <button className="btn" onClick={() => duplicateScene(scene.id)}>Duplicar escena</button>
      <button className="btn" onClick={onOverview}>Ver todas las escenas</button>
      <button className="btn danger" disabled={count <= 1} onClick={() => confirm(`¿Borrar "${scene.name}"? Puedes deshacerlo.`) && removeScene(scene.id)}>Borrar escena</button>
    </div>
  </div>;
}

export function NewSceneModal({ onClose }: { onClose: () => void }) {
  const { addScene } = useStore.getState();
  return <Modal title="Nueva escena" onClose={onClose}>
    <div className="tpl-grid">
      <button className="tpl" onClick={() => { addScene(); onClose(); }}><b>Escena vacía</b><span>Empieza desde cero.</span></button>
      {TEMPLATES.map(t => <button key={t.id} className="tpl" onClick={() => { addScene(t.build()); onClose(); }}>
        <b>{t.name}</b><span>{t.desc}</span></button>)}
    </div>
  </Modal>;
}

// ---------- Vista multi-escena ----------
export function ScenePreview({ scene, w, h }: { scene: Scene; w: number; h: number }) {
  const b = sceneBounds(scene);
  const scale = Math.min(w / (b.x1 - b.x0), h / (b.y1 - b.y0)) * 0.9;
  const x = w / 2 - ((b.x0 + b.x1) / 2) * scale, y = h / 2 - ((b.y0 + b.y1) / 2) * scale;
  return <Stage width={w} height={h} listening={false}>
    <Layer x={x} y={y} scaleX={scale} scaleY={scale}>
      {scene.objects.filter(o => o.kind === 'light' && o.beamOn).map(o => <Group key={'b' + o.id} x={o.x} y={o.y} rotation={o.rot}><Beam o={o} /></Group>)}
      {scene.objects.map(o => <Group key={o.id} x={o.x} y={o.y} rotation={o.rot}><ObjShape o={o} /></Group>)}
    </Layer>
  </Stage>;
}

export function OverviewModal({ onClose }: { onClose: () => void }) {
  const project = useStore(s => s.project!);
  const current = useStore(s => currentScene(s)?.id);
  const { setScene } = useStore.getState();
  return <Modal title="Todas las escenas" onClose={onClose}>
    <div className="overview">
      {project.scenes.map(s => <button key={s.id} className={'ov-item' + (s.id === current ? ' on' : '')} onClick={() => { setScene(s.id); onClose(); }}>
        <ScenePreview scene={s} w={260} h={170} />
        <b>{s.name}</b>
        <small>{s.objects.filter(o => o.kind === 'light').length} luces · {Math.round(circuitLoads(s, project.settings).totalA)} A</small>
      </button>)}
    </div>
  </Modal>;
}
