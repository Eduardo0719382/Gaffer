import { useState } from 'react';
import { FIXTURE_TYPE_NAMES, fixtureFrom } from '../library';
import { Fixture, FixtureType, uid } from '../model';
import { Field, Modal, Select } from '../ui';

export function CustomFixtureModal({ fixture, onSave, onDelete, onClose }: {
  fixture: Fixture | null; onSave: (f: Fixture) => void; onDelete: (f: Fixture) => void; onClose: () => void;
}) {
  const [f, setF] = useState(() => fixture ?? { ...fixtureFrom('', '', 'cob', 300, 55, 5600, 5600, false, true), id: '' });
  const set = (p: Partial<Fixture>) => setF({ ...f, ...p });
  const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
  const valid = f.model.trim().length > 0;

  const save = () => {
    const base = fixtureFrom(f.brand.trim() || 'Mío', f.model.trim(), f.type, f.watts, f.beamAngle, f.cctMin, Math.max(f.cctMin, f.cctMax), f.rgb, true);
    onSave({ ...base, id: fixture?.id || 'custom-' + uid() });
  };

  return <Modal title={fixture ? 'Editar equipo' : 'Nuevo equipo'} onClose={onClose}>
    <div className="form-grid">
      <Field label="Marca"><input value={f.brand} onChange={e => set({ brand: e.target.value })} placeholder="ej. Aputure" /></Field>
      <Field label="Modelo"><input value={f.model} onChange={e => set({ model: e.target.value })} placeholder="ej. LS 600c Pro" autoFocus /></Field>
      <Field label="Tipo"><Select value={f.type} onChange={v => set({ type: v as FixtureType })}
        options={Object.entries(FIXTURE_TYPE_NAMES).map(([v, t]) => ({ v: v as FixtureType, t }))} /></Field>
      <Field label="Consumo" hint="watts"><input inputMode="numeric" value={f.watts} onChange={e => set({ watts: num(e.target.value) })} /></Field>
      <Field label="Ángulo del haz" hint="grados"><input inputMode="numeric" value={f.beamAngle} onChange={e => set({ beamAngle: num(e.target.value) })} /></Field>
      <Field label="CCT mínimo" hint="K"><input inputMode="numeric" value={f.cctMin} onChange={e => set({ cctMin: num(e.target.value) })} /></Field>
      <Field label="CCT máximo" hint="K"><input inputMode="numeric" value={f.cctMax} onChange={e => set({ cctMax: num(e.target.value) })} /></Field>
      <Field label="Color RGB"><label className="check"><input type="checkbox" checked={f.rgb} onChange={e => set({ rgb: e.target.checked })} /> Sí</label></Field>
    </div>
    <div className="row end">
      {fixture && <button className="btn danger" onClick={() => confirm('¿Borrar este equipo de tu librería? Los diagramas que ya lo usan no cambian.') && onDelete(fixture)}>Borrar</button>}
      <button className="btn" onClick={onClose}>Cancelar</button>
      <button className="btn primary" disabled={!valid} onClick={save}>Guardar</button>
    </div>
  </Modal>;
}
