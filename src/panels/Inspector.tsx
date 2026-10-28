import { DIFFUSIONS, FIXTURES, FIXTURE_TYPE_NAMES, GELS, MATERIALS } from '../library';
import { Fixture, Obj } from '../model';
import { useSelected, useStore } from '../store';
import { Field, Num, Select, Slider, Text, Toggle } from '../ui';
import { cameraFov, luxAtThrow } from '../lib/calc';
import { effectiveCct, rgbToHex, beamColor } from '../lib/color';

const KIND_NAMES: Record<Obj['kind'], string> = {
  light: 'Luz', modifier: 'Grip / modificador', camera: 'Cámara', actor: 'Talento', prop: 'Utilería',
  wall: 'Pared', door: 'Puerta', window: 'Ventana', text: 'Texto', power: 'Distro / generador',
};

const SENSORS = [
  { v: 36, t: 'Full frame (36 mm)' }, { v: 24.9, t: 'Super 35 (24.9 mm)' },
  { v: 23.5, t: 'APS-C (23.5 mm)' }, { v: 17.3, t: 'Micro 4/3 (17.3 mm)' }, { v: 54.1, t: 'Large format 65 (54 mm)' },
];

export function Inspector({ custom }: { custom: Fixture[] }) {
  const o = useSelected();
  const circuits = useStore(s => s.project!.settings.circuits);
  const { updateObject, removeObject, duplicateObject } = useStore.getState();
  if (!o) return <div className="empty-panel">
    <p><b>Nada seleccionado.</b></p>
    <p className="muted">Toca un objeto del plano para ver y cambiar sus datos: CCT, intensidad, gel, difusión, circuito y notas.</p>
  </div>;

  const up = (p: Partial<Obj>) => updateObject(o.id, p);
  const allFixtures = [...custom, ...FIXTURES];

  return <div className="inspector">
    <div className="insp-head">
      <span className="badge">{KIND_NAMES[o.kind]}</span>
      <div className="row">
        <button className="btn small" onClick={() => duplicateObject(o.id)}>Duplicar</button>
        <button className="btn small danger" onClick={() => removeObject(o.id)}>Eliminar</button>
      </div>
    </div>

    {o.kind === 'text'
      ? <>
        <Field label="Texto"><Text value={o.text ?? ''} onChange={v => up({ text: v })} multiline /></Field>
        <Field label="Tamaño de letra" hint="m"><Num value={o.fontSize ?? 0.3} step={0.05} min={0.1} max={3} onChange={v => up({ fontSize: v })} /></Field>
      </>
      : <>
        <Field label="Etiqueta"><Text value={o.label} placeholder={o.kind === 'light' ? 'ej. KEY, FILL, BACK' : ''} onChange={v => up({ label: v })} /></Field>
        <Toggle on={o.showLabel} onChange={v => up({ showLabel: v })} label="Mostrar etiqueta en el plano" />
      </>}

    {o.kind === 'light' && o.fixture && <LightFields o={o} up={up} circuits={circuits} fixtures={allFixtures} />}

    {o.kind === 'camera' && <>
      <Field label="Lente" hint="mm"><Num value={o.lens ?? 35} min={8} max={600} onChange={v => up({ lens: v })} suffix="mm" /></Field>
      <Field label="Sensor"><Select value={o.sensor ?? 24.9} options={SENSORS} onChange={v => up({ sensor: v })} /></Field>
      <Toggle on={!!o.beamOn} onChange={v => up({ beamOn: v })} label={`Mostrar campo de visión (${Math.round(cameraFov(o))}°)`} />
      <Field label="Largo del cono" hint="m"><Num value={o.throw ?? 4} step={0.5} min={0.5} max={50} onChange={v => up({ throw: v })} suffix="m" /></Field>
    </>}

    {o.kind === 'modifier' && <Field label="Material / tela">
      <Select value={o.material ?? ''} options={MATERIALS.map(m => ({ v: m, t: m || '—' }))} onChange={v => up({ material: v })} />
    </Field>}

    <div className="form-grid">
      <Field label="Rotación" hint="°">
        <div className="row">
          <button className="btn small" onClick={() => up({ rot: (o.rot + 345) % 360 })}>⟲ 15</button>
          <Num value={o.rot} min={-360} max={360} onChange={v => up({ rot: ((v % 360) + 360) % 360 })} />
          <button className="btn small" onClick={() => up({ rot: (o.rot + 15) % 360 })}>⟳ 15</button>
        </div>
      </Field>
      {['wall', 'door', 'window', 'prop', 'modifier'].includes(o.kind) && <>
        <Field label={o.kind === 'modifier' ? 'Grosor' : 'Largo'} hint="m"><Num value={o.w} step={0.1} min={0.02} max={100} onChange={v => up({ w: v })} suffix="m" /></Field>
        <Field label={o.kind === 'modifier' ? 'Ancho' : 'Ancho / grosor'} hint="m"><Num value={o.h} step={0.1} min={0.02} max={100} onChange={v => up({ h: v })} suffix="m" /></Field>
      </>}
      {['prop', 'actor', 'wall', 'text', 'power'].includes(o.kind) && <Field label="Color">
        <input type="color" value={o.color} onChange={e => up({ color: e.target.value })} />
      </Field>}
    </div>
    {o.kind !== 'light' && <Field label="Notas"><Text value={o.notes ?? ''} onChange={v => up({ notes: v })} multiline /></Field>}
  </div>;
}

function LightFields({ o, up, circuits, fixtures }: {
  o: Obj; up: (p: Partial<Obj>) => void; circuits: { id: string; name: string }[]; fixtures: Fixture[];
}) {
  const f = o.fixture!;
  const lux = luxAtThrow(o);
  const changeFixture = (id: string) => {
    const nf = fixtures.find(x => x.id === id);
    if (!nf) return;
    up({ fixture: { ...nf }, sub: nf.type, beamAngle: nf.beamAngle, cct: Math.min(nf.cctMax, Math.max(nf.cctMin, o.cct ?? 5600)) });
  };
  const isSun = f.type === 'sun';
  return <>
    <Field label="Equipo">
      <select value={f.id} onChange={e => changeFixture(e.target.value)}>
        {!fixtures.some(x => x.id === f.id) && <option value={f.id}>{f.brand} {f.model}</option>}
        {Array.from(new Set(fixtures.map(x => x.brand))).map(b => <optgroup key={b} label={b}>
          {fixtures.filter(x => x.brand === b).map(x => <option key={x.id} value={x.id}>{x.model}</option>)}
        </optgroup>)}
      </select>
    </Field>
    <p className="muted small">{FIXTURE_TYPE_NAMES[f.type]} · {f.cctMin === f.cctMax ? `${f.cctMin}K` : `${f.cctMin}–${f.cctMax}K`}{f.rgb ? ' · RGB' : ''}</p>

    <Toggle on={!!o.beamOn} onChange={v => up({ beamOn: v })} label="Mostrar haz de luz" />
    <div className="form-grid">
      <Field label="Ángulo del haz" hint="°"><Num value={o.beamAngle ?? f.beamAngle} min={1} max={359} onChange={v => up({ beamAngle: v })} suffix="°" /></Field>
      <Field label="Alcance / distancia" hint="m"><Num value={o.throw ?? 4} step={0.5} min={0.3} max={100} onChange={v => up({ throw: v })} suffix="m" /></Field>
    </div>
    {!isSun && <>
      <Field label="Temperatura de color (CCT)">
        {f.cctMin === f.cctMax
          ? <p className="fixed-val">{f.cctMin}K (fija)</p>
          : <Slider value={o.cct ?? 5600} min={f.cctMin} max={f.cctMax} step={100} suffix="K" onChange={v => up({ cct: v })} />}
      </Field>
      <Field label="Intensidad"><Slider value={o.intensity ?? 100} min={0} max={100} suffix="%" onChange={v => up({ intensity: v })} /></Field>
    </>}
    <div className="form-grid">
      <Field label="Gel"><Select value={o.gel ?? ''} options={GELS.map(g => ({ v: g.name, t: g.name || 'Sin gel' }))} onChange={v => up({ gel: v })} /></Field>
      <Field label="Difusión"><Select value={o.diffusion ?? ''} options={DIFFUSIONS.map(d => ({ v: d, t: d || 'Sin difusión' }))} onChange={v => up({ diffusion: v })} /></Field>
    </div>
    <Field label="Color del haz" hint={o.beamColor ? 'libre' : 'automático'}>
      <div className="row">
        <input type="color" value={o.beamColor || rgbToHex(beamColor(o))} onChange={e => up({ beamColor: e.target.value })} />
        {o.beamColor && <button className="btn small" onClick={() => up({ beamColor: '' })}>Automático</button>}
        {!o.beamColor && <span className="muted small">según {o.gel ? 'gel' : 'CCT'} ({effectiveCct(o)}K)</span>}
      </div>
    </Field>
    {!isSun && <div className="form-grid">
      <Field label="Circuito">
        <Select value={o.circuit ?? ''} options={[{ v: '', t: 'Sin circuito' }, ...circuits.map(c => ({ v: c.id, t: c.name }))]} onChange={v => up({ circuit: v })} />
      </Field>
      <Field label="Consumo" hint="W">
        <Num value={f.watts} min={0} max={30000} onChange={v => up({ fixture: { ...f, watts: v } })} suffix="W" />
      </Field>
    </div>}
    {lux !== null && !isSun && <p className="info">≈ <b>{lux.toLocaleString('es')} lux</b> a {Math.round((o.throw ?? 0) * 100) / 100} m (estimado; usa tu fotómetro en set).</p>}
    <Field label="Notas de la luz"><Text value={o.notes ?? ''} placeholder="ej. en dimmer 3, bandera arriba" onChange={v => up({ notes: v })} multiline /></Field>
  </>;
}
