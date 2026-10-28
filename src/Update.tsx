import { useEffect, useState } from 'react';
import { APP_VERSION, desktop, isAndroid, openExternal } from './lib/platform';
import { RELEASES_URL, fetchLatest, newer } from './lib/update';

type St =
  | { k: 'idle' }
  | { k: 'downloading'; version?: string; percent?: number }
  | { k: 'ready'; version?: string }
  | { k: 'available'; version: string; url: string; apk: boolean };

// Aviso de actualización. Escritorio: descarga sola y pide reiniciar.
// Android (o si falla el escritorio): avisa y abre la descarga desde GitHub.
export function UpdateBanner() {
  const [st, setSt] = useState<St>({ k: 'idle' });
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const viaGithub = async () => {
      try {
        const r = await fetchLatest();
        if (r && newer(r.version, APP_VERSION)) {
          setSt({ k: 'available', version: r.version, url: (isAndroid && r.apkUrl) || r.pageUrl || RELEASES_URL, apk: isAndroid && !!r.apkUrl });
        }
      } catch { /* sin internet: no pasa nada */ }
    };
    if (desktop) {
      desktop.onUpdate(ev => {
        if (ev.type === 'available') setSt({ k: 'downloading', version: ev.version });
        else if (ev.type === 'progress') setSt(s => ({ k: 'downloading', version: s.k === 'downloading' ? s.version : undefined, percent: ev.percent }));
        else if (ev.type === 'downloaded') setSt({ k: 'ready', version: ev.version });
        else if (ev.type === 'error') viaGithub(); // p. ej. macOS sin firma
      });
      desktop.checkUpdates();
    } else if (isAndroid) {
      viaGithub();
    }
  }, []);

  if (hidden || st.k === 'idle') return null;
  return <div className="update-banner" role="status">
    {st.k === 'downloading' && <span>Descargando la versión {st.version ?? 'nueva'}… {st.percent ? Math.round(st.percent) + '%' : ''}</span>}
    {st.k === 'ready' && <>
      <span>La versión {st.version} está lista.</span>
      <button className="btn primary" onClick={() => desktop?.installUpdate()}>Reiniciar y actualizar</button>
    </>}
    {st.k === 'available' && <>
      <span>Hay una versión nueva: {st.version}{st.apk ? '. Descarga el archivo y toca "Instalar".' : ''}</span>
      <button className="btn primary" onClick={() => openExternal(st.url)}>{st.apk ? 'Descargar actualización' : 'Ir a la descarga'}</button>
    </>}
    <button className="icon-btn" onClick={() => setHidden(true)} aria-label="Cerrar aviso">✕</button>
  </div>;
}
