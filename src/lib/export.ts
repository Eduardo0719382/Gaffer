import { jsPDF } from 'jspdf';
import type { Project, Scene } from '../model';
import { viewApi } from '../canvas/Diagram';
import { useStore } from '../store';
import { circuitLoads, gearForProject, gearForScene, luxAtThrow } from './calc';
import { effectiveCct } from './color';
import { saveFile } from './platform';

// Espera a que React/Konva dibujen. setTimeout como respaldo por si la ventana está oculta (sin rAF).
const frame = () => new Promise<void>(r => { const t = setTimeout(r, 50); requestAnimationFrame(() => { clearTimeout(t); r(); }); });
const frames = async (n = 3) => { for (let i = 0; i < n; i++) await frame(); };
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').trim() || 'gaffer';
// Las fuentes estándar del PDF solo tienen Latin-1.
const pdfText = (s: string) => s.replace(/⅛/g, '1/8').replace(/[^\x00-\xFF]/g, '');

// Captura la escena visible como PNG (fondo blanco, alta resolución).
async function captureCurrent(maxPx = 3200, mime = 'image/png'): Promise<{ url: string; w: number; h: number }> {
  useStore.getState().select(null);
  viewApi.fit();
  await frames(3);
  const st = viewApi.stage!;
  const w = viewApi.bounds();
  const k = st.scaleX();
  const x0 = w.x0 * k + st.x(), y0 = w.y0 * k + st.y(), x1 = w.x1 * k + st.x(), y1 = w.y1 * k + st.y();
  const pad = 24;
  const box = { x: x0 - pad, y: y0 - pad, width: x1 - x0 + pad * 2, height: y1 - y0 + pad * 2 };
  const ratio = Math.max(1, Math.min(6, maxPx / Math.max(box.width, box.height)));
  const src = st.toCanvas({ ...box, pixelRatio: ratio });
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0);
  return { url: c.toDataURL(mime, 0.88), w: c.width, h: c.height };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
}

async function withScene<T>(sceneId: string, fn: () => Promise<T>): Promise<T> {
  const st = useStore.getState();
  if (st.sceneId !== sceneId) { st.setScene(sceneId); await frames(4); await new Promise(r => setTimeout(r, 60)); }
  return fn();
}

export async function exportScenePng(p: Project, scene: Scene) {
  const img = await withScene(scene.id, () => captureCurrent());
  const head = Math.round(img.w * 0.05);
  const c = document.createElement('canvas');
  c.width = img.w; c.height = img.h + head;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  const im = await loadImage(img.url);
  g.drawImage(im, 0, head);
  g.fillStyle = '#0f172a'; g.font = `bold ${Math.round(head * 0.42)}px sans-serif`;
  g.fillText(`${p.name} — ${scene.name}`, head * 0.4, head * 0.62);
  return saveFile(`${safeName(p.name)} - ${safeName(scene.name)}.png`, c.toDataURL('image/png'), 'image/png');
}

export async function exportProjectPdf(p: Project) {
  const original = useStore.getState().sceneId;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 12;
  let first = true;
  const date = new Date().toLocaleDateString('es');

  const header = (title: string) => {
    if (!first) doc.addPage();
    first = false;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(15, 23, 42);
    doc.text(pdfText(title), M, M + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139);
    doc.text(pdfText(`${p.name} · ${date}`), W - M, M + 4, { align: 'right' });
    doc.setDrawColor(203, 213, 225); doc.line(M, M + 7, W - M, M + 7);
    return M + 13;
  };

  const table = (y: number, cols: { t: string; w: number }[], rows: string[][], title: string) => {
    const rowH = 6;
    const drawHead = (yy: number) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 85);
      let x = M; cols.forEach(c => { doc.text(pdfText(c.t), x, yy); x += c.w; });
      doc.setDrawColor(226, 232, 240); doc.line(M, yy + 1.5, W - M, yy + 1.5);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
      return yy + rowH;
    };
    y = drawHead(y);
    for (const r of rows) {
      if (y > H - M) y = drawHead(header(title + ' (cont.)'));
      let x = M;
      r.forEach((cell, i) => {
        const txt = doc.splitTextToSize(pdfText(cell), cols[i].w - 2)[0] ?? '';
        doc.text(txt, x, y); x += cols[i].w;
      });
      y += rowH;
    }
    return y;
  };

  try {
    for (const s of p.scenes) {
      const img = await withScene(s.id, () => captureCurrent(2600, 'image/jpeg'));
      let y = header(s.name);
      const maxW = W - M * 2, maxH = 120;
      const k = Math.min(maxW / img.w, maxH / img.h);
      const iw = img.w * k, ih = img.h * k;
      doc.addImage(img.url, 'JPEG', M + (maxW - iw) / 2, y, iw, ih);
      y += ih + 6;
      if (s.notes) {
        doc.setFontSize(9); doc.setTextColor(51, 65, 85);
        doc.text(doc.splitTextToSize(pdfText('Notas: ' + s.notes), maxW).slice(0, 3), M, y);
        y += 12;
      }
      const lights = s.objects.filter(o => o.kind === 'light' && o.fixture);
      if (lights.length) {
        table(y, [
          { t: 'Luz', w: 24 }, { t: 'Equipo', w: 62 }, { t: 'CCT', w: 18 }, { t: 'Int.', w: 14 }, { t: 'Gel', w: 26 },
          { t: 'Difusión', w: 28 }, { t: 'Lux aprox.', w: 22 }, { t: 'Circ.', w: 14 }, { t: 'Notas', w: 65 },
        ], lights.map(o => [
          o.label || '—', `${o.fixture!.brand} ${o.fixture!.model}`, `${effectiveCct(o)}K`, `${o.intensity ?? 100}%`,
          o.gel || '', o.diffusion || '', luxAtThrow(o)?.toString() ?? '', o.circuit || '', o.notes || '',
        ]), s.name);
      }
    }

    let y = header('Lista de equipo (total del proyecto)');
    const gear = gearForProject(p);
    y = table(y, [{ t: 'Grupo', w: 60 }, { t: 'Equipo', w: 160 }, { t: 'Cant.', w: 20 }], gear.map(g => [g.group, g.item, String(g.qty)]), 'Lista de equipo');
    doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text('El total es el máximo usado al mismo tiempo en una escena. Soportes y extensiones son estimados.', M, Math.min(y + 4, H - 6));

    y = header(`Carga eléctrica (${p.settings.voltage} V)`);
    const rows: string[][] = [];
    for (const s of p.scenes) {
      const l = circuitLoads(s, p.settings);
      for (const c of l.circuits) {
        rows.push([s.name, c.name, `${Math.round(c.watts)} W`, `${c.amps.toFixed(1)} A`, c.breaker ? `${c.breaker} A` : '—',
          c.breaker ? `${Math.round(c.pct)}%` : '', c.status === 'over' ? 'SOBRECARGA' : c.status === 'warn' ? 'Más de 80%' : c.status === 'none' ? 'Sin asignar' : 'OK']);
      }
      rows.push([s.name, 'TOTAL', `${Math.round(l.totalW)} W`, `${l.totalA.toFixed(1)} A`, '', '', '']);
    }
    table(y, [{ t: 'Escena', w: 60 }, { t: 'Circuito', w: 50 }, { t: 'Watts', w: 30 }, { t: 'Amperes', w: 30 }, { t: 'Breaker', w: 28 }, { t: 'Uso', w: 22 }, { t: 'Estado', w: 40 }], rows, 'Carga eléctrica');

    for (const s of p.scenes) {
      const g = gearForScene(s);
      if (!g.length) continue;
      const yy = header(`Equipo · ${s.name}`);
      table(yy, [{ t: 'Grupo', w: 60 }, { t: 'Equipo', w: 160 }, { t: 'Cant.', w: 20 }], g.map(r => [r.group, r.item, String(r.qty)]), `Equipo · ${s.name}`);
    }
  } finally {
    useStore.getState().setScene(original);
  }
  return saveFile(`${safeName(p.name)}.pdf`, doc.output('blob'), 'application/pdf');
}

export function exportGafferFile(p: Project) {
  return saveFile(`${safeName(p.name)}.gaffer`, JSON.stringify(p), 'application/json');
}
