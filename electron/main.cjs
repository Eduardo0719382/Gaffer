// Proceso principal de escritorio: ventana, archivos .gaffer y actualizaciones desde GitHub Releases.
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win = null;
let pendingFile = null;

function fileFromArgs(argv) {
  return argv.find(a => a.toLowerCase().endsWith('.gaffer') && fs.existsSync(a)) || null;
}

function sendFile(file) {
  if (!file || !win) return;
  try {
    win.webContents.send('open-file', path.basename(file), fs.readFileSync(file, 'utf8'));
  } catch (e) { console.error(e); }
}

function send(ev) { win?.webContents.send('update', ev); }

function setupUpdates() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', i => send({ type: 'available', version: i.version }));
  autoUpdater.on('download-progress', p => send({ type: 'progress', percent: p.percent }));
  autoUpdater.on('update-downloaded', i => send({ type: 'downloaded', version: i.version }));
  autoUpdater.on('error', e => send({ type: 'error', message: String(e?.message || e) }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 560,
    title: 'Gaffer', backgroundColor: '#111827',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  // Enlaces externos (GitHub) se abren en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('did-finish-load', () => { sendFile(pendingFile); pendingFile = null; });
  // F12 abre herramientas de desarrollo (útil para reportar errores).
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); sendFile(fileFromArgs(argv)); }
  });
  app.on('open-file', (e, file) => { e.preventDefault(); if (win) sendFile(file); else pendingFile = file; });
  app.whenReady().then(() => {
    pendingFile = pendingFile || fileFromArgs(process.argv);
    setupUpdates();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}

ipcMain.handle('check-updates', async () => {
  if (!app.isPackaged) return;
  try { await autoUpdater.checkForUpdates(); } catch (e) { send({ type: 'error', message: String(e?.message || e) }); }
});
ipcMain.handle('install-update', () => autoUpdater.quitAndInstall(false, true));
