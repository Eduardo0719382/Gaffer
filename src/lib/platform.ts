// Diferencias entre escritorio (Electron), Android (Capacitor) y navegador.
import { Capacitor } from '@capacitor/core';

export interface DesktopBridge {
  version: string;
  platform: string;
  onUpdate(cb: (ev: { type: string; version?: string; percent?: number; message?: string }) => void): void;
  checkUpdates(): void;
  installUpdate(): void;
  onOpenFile(cb: (name: string, text: string) => void): void;
}

declare global {
  interface Window { gafferDesktop?: DesktopBridge }
  const __APP_VERSION__: string;
}

export const APP_VERSION = __APP_VERSION__;
export const isAndroid = Capacitor.getPlatform() === 'android';
export const desktop = window.gafferDesktop;
export const platformName = desktop ? 'desktop' : isAndroid ? 'android' : 'web';

function base64FromDataUrl(d: string) { return d.slice(d.indexOf(',') + 1); }

async function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(b); });
}

// Guarda/comparte un archivo. En Android abre el menú de compartir (WhatsApp, Drive, correo…).
export async function saveFile(name: string, data: Blob | string, mime: string): Promise<'saved' | 'shared'> {
  const blob = typeof data === 'string' && !data.startsWith('data:') ? new Blob([data], { type: mime }) : data;
  if (isAndroid) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const dataUrl = typeof blob === 'string' ? blob : await blobToDataUrl(blob);
    const r = await Filesystem.writeFile({ path: name, data: base64FromDataUrl(dataUrl), directory: Directory.Cache });
    await Share.share({ title: name, files: [r.uri], dialogTitle: 'Guardar o compartir' });
    return 'shared';
  }
  const url = typeof blob === 'string' ? blob : URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof blob !== 'string') setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'saved';
}

export async function shareText(title: string, text: string): Promise<'copied' | 'shared'> {
  if (isAndroid) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}

export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise(res => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = isAndroid ? '*/*' : accept;
    inp.onchange = async () => {
      const f = inp.files?.[0];
      res(f ? { name: f.name, text: await f.text() } : null);
    };
    inp.click();
  });
}

export async function openExternal(url: string) {
  if (isAndroid) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank');
  }
}
