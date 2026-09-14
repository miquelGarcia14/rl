'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, clipboard } = require('electron');
const path = require('path');
const log = require('electron-log');
const { Config } = require('./config');
const launcher = require('./launcher');
const statsini = require('./statsini');
const { LogWatch } = require('./logwatch');
const swap = require('./swaplayer');

log.transports.file.level = 'info';
log.info('RL Panel arrancando', app.getVersion());

// Una sola instancia (salvo en la prueba de humo, que debe poder correr junto a la app instalada)
if (!process.argv.includes('--smoke') && !app.requestSingleInstanceLock()) { app.quit(); }

let cfg, watch, tray = null, panelWin = null, overlayWin = null, quitting = false;
const RENDERER = path.join(__dirname, '..', 'renderer');
const iconPath = path.join(RENDERER, 'assets', 'icon.png');

function send(channel, data) {
  for (const w of [panelWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, data);
}

function createPanel() {
  panelWin = new BrowserWindow({
    width: 1000, height: 700, minWidth: 820, minHeight: 540, show: false, autoHideMenuBar: true,
    title: 'RL Panel', icon: iconPath, backgroundColor: '#0f1219',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  panelWin.loadFile(path.join(RENDERER, 'panel.html'));
  panelWin.once('ready-to-show', () => panelWin.show());
  panelWin.on('close', (e) => {
    if (!quitting && cfg.get('minimizeToTray')) { e.preventDefault(); panelWin.hide(); }
  });
  panelWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function showPanel() { if (!panelWin || panelWin.isDestroyed()) createPanel(); else { panelWin.show(); panelWin.focus(); } }

function overlayUrl(opts = {}) {
  const o = { ...cfg.get('overlay'), ...opts };
  const q = new URLSearchParams({ ws: cfg.get('statsApi.wsUrl'), show: (o.show || []).join(','), scale: String(o.scale || 1), bg: String(o.bg || 0) });
  return { file: path.join(RENDERER, 'overlay.html'), query: q.toString() };
}

function toggleOverlay(opts = {}) {
  if (overlayWin && !overlayWin.isDestroyed()) { overlayWin.close(); overlayWin = null; return { open: false }; }
  const b = cfg.get('overlay.bounds') || { x: 40, y: 40, width: 560, height: 240 };
  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, transparent: true, frame: false, alwaysOnTop: true,
    skipTaskbar: true, resizable: true, hasShadow: false, focusable: !cfg.get('overlay.clickthrough'), title: 'RL Overlay',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  const u = overlayUrl(opts);
  overlayWin.loadFile(u.file, { search: u.query });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  if (cfg.get('overlay.clickthrough')) overlayWin.setIgnoreMouseEvents(true, { forward: true });
  const saveBounds = () => { if (overlayWin && !overlayWin.isDestroyed()) cfg.set('overlay.bounds', overlayWin.getBounds()); };
  overlayWin.on('moved', saveBounds); overlayWin.on('resized', saveBounds);
  overlayWin.on('closed', () => { overlayWin = null; });
  return { open: true };
}

function buildTray() {
  let img = nativeImage.createFromPath(iconPath);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('RL Panel');
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir panel', click: showPanel },
    { label: 'Overlay en ventana (mostrar/ocultar)', click: () => toggleOverlay() },
    { type: 'separator' },
    { label: 'Jugar online (con EAC)', click: () => runLaunch('eac') },
    { label: 'Entrenar sin EAC (modo oficial)', click: () => runLaunch('noeac') },
    { type: 'separator' },
    { label: 'Salir', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', showPanel);
}

async function runLaunch(mode) {
  const res = await launcher.launch(mode, {
    open: (uri) => shell.openExternal(uri),
    progress: (p) => send('launcher:progress', p),
  });
  send('launcher:progress', { step: 'done', result: res });
  send('state:changed', {});
  return res;
}

async function getState() {
  const game = await launcher.detect();
  const ini = statsini.read();
  const sw = swap.status(cfg.get('swap'));
  const m = launcher.findManifest();
  return {
    version: app.getVersion(), game, statsIni: ini, swap: sw, overlayOpen: !!(overlayWin && !overlayWin.isDestroyed()),
    epic: m ? { version: m.version, installLocation: m.installLocation } : null,
    additional: m ? launcher.getAdditionalCommands(m) : null,
    config: cfg.get(), userData: app.getPath('userData'), logDir: require('./logwatch').LOG_DIR,
  };
}

function setupIpc() {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('state:get', () => getState());
  ipcMain.handle('launcher:detect', () => launcher.detect());
  ipcMain.handle('launcher:launch', (_e, mode) => runLaunch(mode === 'noeac' ? 'noeac' : 'eac'));
  ipcMain.handle('statsini:set', (_e, rate) => statsini.setRate(rate));
  ipcMain.handle('mmr:history', () => watch.getHistory(cfg.get('mmr')));
  ipcMain.handle('mmr:rescan', () => { const r = watch.rescan(); return { ...r, history: watch.getHistory(cfg.get('mmr')) }; });
  ipcMain.handle('mmr:setCalib', (_e, c) => { cfg.set('mmr', { ...cfg.get('mmr'), factor: Number(c.factor) || 20, offset: Number(c.offset) || 0 }); return watch.getHistory(cfg.get('mmr')); });
  ipcMain.handle('mmr:addPoint', (_e, playlist, real) => {
    const h = watch.getHistory(cfg.get('mmr'));
    const cola = h.colas.filter((c) => c.playlist === Number(playlist)).pop();
    if (!cola || !Number.isFinite(Number(real))) return { error: 'No hay ninguna cola registrada de esa playlist todavia.', history: h };
    const points = [...(cfg.get('mmr.points') || []), { playlist: Number(playlist), raw: cola.mmrRaw, real: Number(real), time: cola.time, at: new Date().toISOString() }];
    cfg.set('mmr.points', points);
    return { history: watch.getHistory(cfg.get('mmr')) };
  });
  ipcMain.handle('mmr:clearPoints', () => { cfg.set('mmr.points', []); return watch.getHistory(cfg.get('mmr')); });
  ipcMain.handle('swap:reapply', async () => {
    if (await launcher.isRunning()) return { code: -2, output: 'Rocket League esta abierto. Cierralo del todo y vuelve a intentarlo.' };
    return swap.reapply(cfg.get('swap'), (line) => send('swap:progress', line));
  });
  ipcMain.handle('swap:baseline', () => { const s = swap.status(cfg.get('swap')); if (s.baseBin) { cfg.set('swap.baseBinSize', s.baseBin.size); cfg.set('swap.baseBinMtime', s.baseBin.mtime); } return swap.status(cfg.get('swap')); });
  ipcMain.handle('overlay:toggle', (_e, opts) => toggleOverlay(opts || {}));
  ipcMain.handle('overlay:paths', () => { const u = overlayUrl(); return { file: u.file, url: `file:///${u.file.replace(/\\/g, '/')}?${u.query}` }; });
  ipcMain.handle('config:get', (_e, key) => cfg.get(key));
  ipcMain.handle('config:set', (_e, key, value) => {
    if (typeof key !== 'string' || key.startsWith('__')) return null;
    const v = cfg.set(key, value);
    if (key === 'autostart') app.setLoginItemSettings({ openAtLogin: !!value, args: ['--hidden'] });
    return v;
  });
  ipcMain.handle('clipboard:write', (_e, text) => { clipboard.writeText(String(text)); return true; });
  ipcMain.handle('shell:openPath', (_e, p) => (typeof p === 'string' && p.length < 500 ? shell.openPath(p) : ''));
  ipcMain.handle('shell:openExternal', (_e, url) => {
    if (typeof url === 'string' && /^https:\/\/(www\.)?(rocketleague\.com|epicgames\.com|obsproject\.com|github\.com)\//.test(url)) return shell.openExternal(url);
    return false;
  });
  ipcMain.handle('updater:check', () => checkUpdates(true));
}

async function checkUpdates(manual) {
  try {
    if (!app.isPackaged || !cfg.get('updates.enabled') || !cfg.get('updates.repo')) return { status: manual ? 'disabled' : 'skipped', message: 'Actualizaciones no configuradas (sin repositorio de releases).' };
    const { autoUpdater } = require('electron-updater');
    autoUpdater.logger = log;
    const [owner, repo] = String(cfg.get('updates.repo')).split('/');
    autoUpdater.setFeedURL({ provider: 'github', owner, repo });
    autoUpdater.on('update-available', (i) => send('updater:status', { status: 'available', version: i.version }));
    autoUpdater.on('update-not-available', () => send('updater:status', { status: 'none' }));
    autoUpdater.on('update-downloaded', (i) => send('updater:status', { status: 'downloaded', version: i.version }));
    autoUpdater.on('error', (e) => send('updater:status', { status: 'error', message: e.message }));
    const r = await autoUpdater.checkForUpdatesAndNotify();
    return { status: 'checked', info: r && r.updateInfo ? r.updateInfo.version : null };
  } catch (e) { return { status: 'error', message: e.message }; }
}

app.on('second-instance', showPanel);
app.on('window-all-closed', (e) => { /* seguimos en la bandeja */ });
app.on('before-quit', () => { quitting = true; if (watch) watch.stop(); });

app.whenReady().then(() => {
  cfg = new Config(app.getPath('userData'));
  watch = new LogWatch({ storeFile: path.join(app.getPath('userData'), 'mmr_history.json'), onEvent: (ev) => send('mmr:event', ev) });
  try { watch.rescan(); } catch (e) { log.warn('rescan', e.message); }
  watch.start(1000);
  setupIpc();
  buildTray();
  if (!process.argv.includes('--hidden')) createPanel();
  setTimeout(() => checkUpdates(false), 8000);
  if (process.argv.includes('--smoke')) {
    // Prueba de humo: arranca todo, vuelca estado y errores del renderer por stdout, y sale solo.
    const errors = [];
    const hook = (w, name) => w && w.webContents.on('console-message', (e, level, msg) => {
      // Electron >= 38 pasa un objeto {level:'error'|'warning'|..., message}; versiones previas (e, level:number, msg)
      const lv = e && typeof e.level === 'string' ? e.level : (typeof level === 'number' && level >= 2 ? 'error' : 'info');
      const text = e && e.message ? e.message : msg;
      if (lv === 'error' || lv === 'warning') errors.push(`${name}: ${String(text).slice(0, 300)}`);
    });
    hook(panelWin, 'panel');
    setTimeout(async () => {
      try {
        toggleOverlay(); hook(overlayWin, 'overlay');
        await new Promise((r) => setTimeout(r, 3000));
        const s = await getState();
        const h = watch.getHistory(cfg.get('mmr'));
        process.stdout.write('SMOKE ' + JSON.stringify({ version: s.version, game: s.game, statsIni: s.statsIni, epic: s.epic, additional: s.additional && s.additional.commands, swapAvailable: s.swap.available, swapInstalled: s.swap.installed, colas: h.colas.length, partidas: h.partidas, overlayOpen: !!(overlayWin && !overlayWin.isDestroyed()), rendererErrors: errors }) + '\n');
      } catch (e) { process.stdout.write('SMOKE ERROR ' + e.stack + '\n'); }
      quitting = true; app.quit();
    }, 6000);
  }
});
