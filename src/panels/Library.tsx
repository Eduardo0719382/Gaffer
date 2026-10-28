import { useMemo, useState } from 'react';
import { Category } from '../library';
import { Fixture } from '../model';
import { CustomFixtureModal } from './CustomFixture';

export function LibraryPanel({ catalog, onPick, custom, onSaveCustom }: {
  catalog: Category[]; onPick: (key: string) => void; custom: Fixture[]; onSaveCustom: (list: Fixture[]) => void;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ grip: true, talent: true });
  const [editing, setEditing] = useState<Fixture | 'new' | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.map(c => ({ ...c, items: c.items.filter(i => (i.name + ' ' + (i.hint ?? '') + ' ' + c.name).toLowerCase().includes(s)) }))
      .filter(c => c.items.length);
  }, [q, catalog]);

  return <div className="library">
    <input className="search" type="search" placeholder="Buscar equipo… (ej. 600d, bandera, mesa)" value={q} onChange={e => setQ(e.target.value)} />
    <button className="btn wide" onClick={() => setEditing('new')}>＋ Crear equipo personalizado</button>
    {filtered.map(c => {
      const isOpen = !!q || open[c.id];
      return <div key={c.id} className="cat">
        <button className="cat-head" onClick={() => setOpen({ ...open, [c.id]: !open[c.id] })}>
          <span>{isOpen ? '▾' : '▸'} {c.name}</span><small>{c.items.length}</small>
        </button>
        {isOpen && <div className="cat-items">
          {c.items.map(i => <div key={i.key} className="lib-item" draggable
            onDragStart={e => { e.dataTransfer.setData('text/gaffer', i.key); e.dataTransfer.effectAllowed = 'copy'; }}>
            <button className="lib-add" onClick={() => onPick(i.key)} title="Agregar al centro del plano">
              <span>{i.name}</span>{i.hint && <small>{i.hint}</small>}
            </button>
            {c.id === 'mine' && <button className="icon-btn small" title="Editar" onClick={() => setEditing(custom.find(f => 'light:' + f.id === i.key) ?? null)}>✎</button>}
          </div>)}
        </div>}
      </div>;
    })}
    <p className="muted small">Toca un equipo para ponerlo en el centro. En PC también puedes arrastrarlo al plano. Los datos de consumo y ángulo son aproximados; edítalos en cada luz.</p>
    {editing && <CustomFixtureModal fixture={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
      onSave={f => { onSaveCustom([...custom.filter(x => x.id !== f.id), f]); setEditing(null); }}
      onDelete={f => { onSaveCustom(custom.filter(x => x.id !== f.id)); setEditing(null); }} />}
  </div>;
}
