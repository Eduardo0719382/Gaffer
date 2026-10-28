// Piezas de interfaz reutilizables.
import { ReactNode, useEffect, useState } from 'react';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}{hint && <em> {hint}</em>}</span>{children}</label>;
}

export function Num({ value, onChange, step = 1, min, max, suffix }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string;
}) {
  // Guarda al terminar de escribir para no crear un paso de deshacer por cada tecla.
  const show = (v: number) => String(Math.round(v * 1000) / 1000);
  const [txt, setTxt] = useState(show(value));
  useEffect(() => setTxt(show(value)), [value]);
  const commit = () => {
    let v = parseFloat(txt.replace(',', '.'));
    if (isNaN(v)) { setTxt(show(value)); return; }
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (v !== value) onChange(v); else setTxt(show(value));
  };
  return <div className="num">
    <input inputMode="decimal" value={txt} onChange={e => setTxt(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
    {suffix && <span>{suffix}</span>}
  </div>;
}

export function Text({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  const [txt, setTxt] = useState(value);
  useEffect(() => setTxt(value), [value]);
  const commit = () => { if (txt !== value) onChange(txt); };
  return multiline
    ? <textarea value={txt} placeholder={placeholder} onChange={e => setTxt(e.target.value)} onBlur={commit} rows={3} />
    : <input value={txt} placeholder={placeholder} onChange={e => setTxt(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function Select<T extends string | number>({ value, options, onChange }: {
  value: T; options: { v: T; t: string }[]; onChange: (v: T) => void;
}) {
  return <select value={String(value)} onChange={e => {
    const o = options.find(x => String(x.v) === e.target.value);
    if (o) onChange(o.v);
  }}>{options.map(o => <option key={String(o.v)} value={String(o.v)}>{o.t}</option>)}</select>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)} aria-pressed={on}>
    <span className="knob" />{label}
  </button>;
}

export function Slider({ value, min, max, step = 1, onChange, suffix }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string;
}) {
  return <div className="slider">
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    <span>{value}{suffix}</span>
  </div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-back" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>;
}

// ---- Avisos cortos ----
let pushToast: (m: string) => void = () => {};
export const toast = (m: string) => pushToast(m);
export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: number;
    pushToast = m => { setMsg(m); clearTimeout(t); t = window.setTimeout(() => setMsg(null), 2600); };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
