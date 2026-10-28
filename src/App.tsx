import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Fixture, Obj, Project, newProject, uid } from './model';
import { buildCatalog } from './library';
import { Panel, currentScene, useStore } from './store';
import { DiagramCanvas, viewApi } from './canvas/Diagram';
import { LibraryPanel } from './panels/Library';
import { Inspector } from './panels/Inspector';
import { GearPanel, LayersPanel, NewSceneModal, OverviewModal, PowerPanel, ScenePanel } from './panels/Panels';
import { Modal, Toaster, toast } from './ui';
import { ProjectMeta, deleteProject, listProjects, loadCustomFixtures, loadProject, saveCustomFixtures, saveProject } from './lib/storage';
import { exportGafferFile, exportProjectPdf, exportScenePng } from './lib/export';
import { migrate } from './lib/migrate';
import { APP_VERSION, desktop, isAndroid, pickFile } from './lib/platform';
import { TEMPLATES } from './templates';
import { UpdateBanner } from './Update';

export default function App() {
  const project = useStore(s => s.project);
  const [custom, setCustom] = useState<Fixture[]>([]);
  useEffect(() => { loadCustomFixtures().then(setCustom); }, []);

  // Abrir un .gaffer con doble clic (escritorio).
  useEffect(() => {
    desktop?.onOpenFile((_name, text) => importText(text).catch(e => alert(e.message)));
  }, []);

  // Botón "atrás" de Android: cierra el panel, luego vuelve a Mis proyectos, luego sale.
  useEffect(() => {
    if (!isAndroid) return;
    let remove = () => {};
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('backButton', async () => {
        const s = useStore.getState();
        if (document.querySelector('.modal-back')) return;
        if (s.panel) s.setPanel(null);
        else if (s.selectedId) s.select(null);
        else if (s.project) { await saveProject(s.project); s.close(); }
        else CapApp.exitApp();
      }).then(h => { remove = () => h.remove(); });
    });
    return () => remove();
  }, []);

  return <>
    {project ? <Editor custom={custom} setCustom={l => { setCustom(l); saveCustomFixtures(l); }} /> : <Home />}
    <UpdateBanner />
    <Toaster />
  </>;
}

async function importText(text: string) {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('El archivo no es un proyecto de Gaffer válido.'); }
  const p = migrate(raw);
  if (await loadProject(p.id)) {
    if (!confirm(`Ya tienes "${p.name}" en este equipo.\n\nAceptar = reemplazarlo con el archivo.\nCancelar = guardarlo como copia.`)) {
      p.id = uid(); p.name += ' (copia)';
    }
  }
  p.updated = Date.now();
  await saveProject(p);
  useStore.getState().open(p);
}

// ======================= Inicio =======================
function Home() {
  const [list, setList] = useState<ProjectMeta[] | null>(null);
  const [name, setName] = useState('');
  const [tplOpen, setTplOpen] = useState(false);
  const refresh = () => listProjects().then(setList);
  useEffect(() => { refresh(); }, []);
  const open = async (id: string) => { const p = await loadProject(id); if (p) useStore.getState().open(p); };
  const create = async (fromTpl?: string) => {
    const p = newProject(name.trim() || 'Proyecto nuevo');
    const t = TEMPLATES.find(x => x.id === fromTpl);
    if (t) p.scenes = [t.build()];
    await saveProject(p);
    useStore.getState().open(p);
  };

  return <div className="home">
    <header className="home-head">
      <div className="logo"><span className="logo-mark" />Gaffer</div>
      <span className="muted small">v{APP_VERSION}</span>
    </header>
    <section className="card">
      <h2>Nuevo diagrama</h2>
      <div className="row wrap">
        <input className="grow" placeholder="Nombre del proyecto (ej. Comercial Café – Día 1)" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && create()} />
        <button className="btn primary big" onClick={() => create()}>Crear</button>
      </div>
      <div className="row wrap">
        <button className="btn" onClick={() => setTplOpen(true)}>Empezar desde plantilla</button>
        <button className="btn" onClick={async () => {
          const f = await pickFile('.gaffer,application/json');
          if (f) importText(f.text).catch(e => alert(e.message));
        }}>Abrir archivo .gaffer</button>
      </div>
    </section>
    <section className="card">
      <h2>Mis proyectos</h2>
      {list === null ? <p className="muted">Cargando…</p> : !list.length ? <p className="muted">Todavía no hay proyectos. Crea el primero arriba.</p> :
        <ul className="proj-list">{list.map(m => <li key={m.id}>
          <button className="proj" onClick={() => open(m.id)}>
            <b>{m.name}</b><small>{m.scenes} escena{m.scenes === 1 ? '' : 's'} · {new Date(m.updated).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}</small>
          </button>
          <button className="icon-btn" aria-label="Borrar proyecto" onClick={async () => {
            if (confirm(`¿Borrar "${m.name}" de este equipo? Esto no se puede deshacer.`)) { await deleteProject(m.id); refresh(); }
          }}>🗑</button>
        </li>)}</ul>}
    </section>
    {tplOpen && <Modal title="Plantillas" onClose={() => setTplOpen(false)}>
      <div className="tpl-grid">{TEMPLATES.map(t => <button key={t.id} className="tpl" onClick={() => create(t.id)}><b>{t.name}</b><span>{t.desc}</span></button>)}</div>
    </Modal>}
  </div>;
}

// ======================= Editor =======================
const SIDE_TABS: { id: Exclude<Panel, 'library' | null>; name: string }[] = [
  { id: 'props', name: 'Propiedades' }, { id: 'layers', name: 'Capas' }, { id: 'gear', name: 'Equipo' },
  { id: 'power', name: 'Carga' }, { id: 'scene', name: 'Escena' },
];

function Editor({ custom, setCustom }: { custom: Fixture[]; setCustom: (l: Fixture[]) => void }) {
  const project = useStore(s => s.project!);
  const scene = useStore(s => currentScene(s)!);
  const selectedId = useStore(s => s.selectedId);
  const panel = useStore(s => s.panel);
  const tool = useStore(s => s.tool);
  const canUndo = useStore(s => s.past.length > 0);
  const canRedo = useStore(s => s.future.length > 0);
  const dirty = useStore(s => s.dirty);
  const st = useStore.getState();
  const [tab, setTab] = useState<typeof SIDE_TABS[number]['id']>('props');
  const [newScene, setNewScene] = useState(false);
  const [overview, setOverview] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [saved, setSaved] = useState(true);

  const catalog = useMemo(() => buildCatalog(custom), [custom]);
  const resolveItem = useCallback((key: string): Obj | null => {
    for (const c of catalog) { const i = c.items.find(x => x.key === key); if (i) return i.make(); }
    return null;
  }, [catalog]);

  const addAtCenter = (key: string) => {
    const o = resolveItem(key);
    if (!o) return;
    const c = viewApi.center();
    o.x = c.x; o.y = c.y;
    // Las luces nuevas reciben un nombre corto consecutivo (L1, L2…).
    if (o.kind === 'light' && !o.label) o.label = 'L' + (scene.objects.filter(x => x.kind === 'light').length + 1);
    st.addObject(o);
    st.setPanel(null);
  };

  // Autoguardado
  const saveNow = useCallback(async () => {
    const p = useStore.getState().project;
    if (p) { await saveProject(p); setSaved(true); }
  }, []);
  const timer = useRef<number>();
  useEffect(() => {
    if (!dirty) return;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(saveNow, 700);
  }, [dirty, saveNow]);

  // Seleccionar algo abre "Propiedades" en el panel lateral.
  useEffect(() => { if (selectedId) setTab('props'); }, [selectedId]);

  // Atajos de teclado (PC)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveNow().then(() => toast('Guardado')); }
      else if (mod && e.key.toLowerCase() === 'd' && s.selectedId) { e.preventDefault(); s.duplicateObject(s.selectedId); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) { e.preventDefault(); s.removeObject(s.selectedId); }
      else if (e.key === 'Escape') { s.select(null); s.setTool('select'); }
      else if (e.key.toLowerCase() === 'r' && s.selectedId) {
        const o = currentScene(s)?.objects.find(x => x.id === s.selectedId);
        if (o) s.updateObject(o.id, { rot: (o.rot + (e.shiftKey ? 345 : 15)) % 360 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setExportOpen(false);
    setBusy(label);
    try {
      await saveNow();
      const r = await fn();
      toast(r === 'shared' ? 'Listo para compartir' : 'Archivo guardado');
    } catch (e: any) {
      alert('No se pudo exportar: ' + (e?.message ?? e));
    } finally { setBusy(''); }
  };

  const back = async () => { await saveNow(); st.close(); };

  const panelContent = (p: Panel) => {
    switch (p) {
      case 'library': return <LibraryPanel catalog={catalog} onPick={addAtCenter} custom={custom} onSaveCustom={setCustom} />;
      case 'props': return <Inspector custom={custom} />;
      case 'layers': return <LayersPanel />;
      case 'gear': return <GearPanel />;
      case 'power': return <PowerPanel />;
      case 'scene': return <ScenePanel onOverview={() => { st.setPanel(null); setOverview(true); }} />;
      default: return null;
    }
  };

  return <div className="editor">
    <header className="topbar">
      <button className="icon-btn" onClick={back} title="Mis proyectos" aria-label="Volver a mis proyectos">←</button>
      <ProjectName project={project} />
      <span className={'save-state' + (saved ? '' : ' pending')}>{saved ? 'Guardado' : 'Guardando…'}</span>
      <div className="spacer" />
      <button className="icon-btn" disabled={!canUndo} onClick={st.undo} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">↶</button>
      <button className="icon-btn" disabled={!canRedo} onClick={st.redo} title="Rehacer (Ctrl+Y)" aria-label="Rehacer">↷</button>
      <button className="btn hide-sm" onClick={() => saveNow().then(() => toast('Guardado'))}>Guardar</button>
      <div className="menu-wrap">
        <button className="btn primary" onClick={() => setExportOpen(!exportOpen)}>Exportar ▾</button>
        {exportOpen && <div className="menu" onMouseLeave={() => setExportOpen(false)}>
          <button onClick={() => run('Creando imagen…', () => exportScenePng(project, scene))}>Imagen PNG de esta escena</button>
          <button onClick={() => run('Creando PDF…', () => exportProjectPdf(useStore.getState().project!))}>PDF del proyecto (diagramas + listas)</button>
          <button onClick={() => run('Preparando archivo…', () => exportGafferFile(useStore.getState().project!))}>Archivo .gaffer (para compartir con el equipo)</button>
        </div>}
      </div>
    </header>

    <nav className="scene-tabs">
      {project.scenes.map(s => <button key={s.id} className={'scene-tab' + (s.id === scene.id ? ' on' : '')} onClick={() => st.setScene(s.id)}>{s.name}</button>)}
      <button className="scene-tab add" onClick={() => setNewScene(true)}>＋ Escena</button>
    </nav>

    <div className="main">
      <aside className="side left">{panelContent('library')}</aside>
      <div className="center">
        <DiagramCanvas resolveItem={resolveItem} />
        <div className="canvas-tools">
          <button className={'tool' + (tool === 'select' ? ' on' : '')} onClick={() => st.setTool('select')} title="Mover y seleccionar">✋ Mover</button>
          <button className={'tool' + (tool === 'wall' ? ' on' : '')} onClick={() => st.setTool(tool === 'wall' ? 'select' : 'wall')} title="Dibujar paredes arrastrando">▭ Pared</button>
          <button className="tool" onClick={() => viewApi.fit()} title="Encuadrar todo">⤢</button>
          <button className="tool" onClick={() => viewApi.zoom(1.25)} aria-label="Acercar">＋</button>
          <button className="tool" onClick={() => viewApi.zoom(0.8)} aria-label="Alejar">－</button>
        </div>
        {tool === 'wall' && <div className="hint-bar">Arrastra sobre el plano para dibujar una pared. Las puntas se pegan a otras paredes. <button className="btn small" onClick={() => st.setTool('select')}>Listo</button></div>}
        <SelectionBar />
        {busy && <div className="busy">{busy}</div>}
      </div>
      <aside className="side right">
        <div className="tabs">{SIDE_TABS.map(t => <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.name}</button>)}</div>
        <div className="side-body">{panelContent(tab)}</div>
      </aside>
    </div>

    {/* Celular / tablet chica */}
    <nav className="bottom-nav">
      <button className="add" onClick={() => st.setPanel('library')}>＋<span>Agregar</span></button>
      <button onClick={() => st.setPanel('props')}>✎<span>Datos</span></button>
      <button onClick={() => st.setPanel('layers')}>☰<span>Capas</span></button>
      <button onClick={() => st.setPanel('gear')}>✓<span>Equipo</span></button>
      <button onClick={() => st.setPanel('power')}>⚡<span>Carga</span></button>
      <button onClick={() => st.setPanel('scene')}>▣<span>Escena</span></button>
    </nav>
    {panel && <div className="sheet-back" onClick={() => st.setPanel(null)}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <b>{panel === 'library' ? 'Agregar al plano' : SIDE_TABS.find(t => t.id === panel)?.name}</b>
          <button className="icon-btn" onClick={() => st.setPanel(null)} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-body">{panelContent(panel)}</div>
      </div>
    </div>}

    {newScene && <NewSceneModal onClose={() => setNewScene(false)} />}
    {overview && <OverviewModal onClose={() => setOverview(false)} />}
  </div>;
}

function ProjectName({ project }: { project: Project }) {
  const [v, setV] = useState(project.name);
  useEffect(() => setV(project.name), [project.name]);
  return <input className="proj-name" value={v} onChange={e => setV(e.target.value)} aria-label="Nombre del proyecto"
    onBlur={() => v.trim() && v !== project.name && useStore.getState().commit(p => { p.name = v.trim(); })}
    onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />;
}

function SelectionBar() {
  const o = useStore(s => currentScene(s)?.objects.find(x => x.id === s.selectedId));
  if (!o) return null;
  const st = useStore.getState();
  const name = o.label || o.fixture?.model || o.text || o.sub;
  return <div className="sel-bar">
    <b>{name}</b>
    <button onClick={() => st.updateObject(o.id, { rot: (o.rot + 345) % 360 })} aria-label="Girar a la izquierda">⟲</button>
    <button onClick={() => st.updateObject(o.id, { rot: (o.rot + 15) % 360 })} aria-label="Girar a la derecha">⟳</button>
    {o.kind === 'light' && <button onClick={() => st.updateObject(o.id, { beamOn: !o.beamOn })}>{o.beamOn ? 'Haz ✓' : 'Haz'}</button>}
    <button onClick={() => st.duplicateObject(o.id)}>Duplicar</button>
    <button className="sm-only" onClick={() => st.setPanel('props')}>Datos</button>
    <button className="danger" onClick={() => st.removeObject(o.id)} aria-label="Eliminar">🗑</button>
  </div>;
}
