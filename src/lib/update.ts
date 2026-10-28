// Busca versiones nuevas en GitHub Releases.
// Escritorio: electron-updater descarga e instala (ver electron/main.cjs).
// Android y respaldo: se consulta la API de GitHub y se abre la descarga del APK.
export const REPO = 'Eduardo0719382/Gaffer';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;

export interface LatestRelease { version: string; apkUrl?: string; pageUrl: string; notes: string }

export function newer(a: string, b: string): boolean {
  const pa = a.replace(/^v/, '').split('.').map(Number), pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

export async function fetchLatest(): Promise<LatestRelease | null> {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  const j = await r.json();
  const apk = (j.assets ?? []).find((a: any) => String(a.name).endsWith('.apk'));
  return { version: String(j.tag_name).replace(/^v/, ''), apkUrl: apk?.browser_download_url, pageUrl: j.html_url, notes: j.body ?? '' };
}
