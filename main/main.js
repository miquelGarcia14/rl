'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage, clipboard, globalShortcut } = require('electron');
const path = require('path');
const log = require('electron-log');
const { Config } = require('./config');
const launcher = require('./launcher');
const statsini = require('./statsini');
const { LogWatch } = require('./logwatch');
const swap = require('./swaplayer');
const bodycolor = require('./bodycolor');
const { Stats, summary } = require('./stats');

log.transports.file.level = 'info';
log.info('RL Panel arrancando', app.getVersion());

// Una sola instancia (salvo en la prueba de humo, que debe poder correr junto a la app instalada)
if (!process.argv.includes('--smoke') && !app.requestSingleInstanceLock()) { app.quit(); }

let cfg, watch, stats, tray = null, panelWin = null, overlayWin = null, quitting = false;
let overlayEdit = false, shortcutState = { accelerator: null, ok: false };
const RENDERER = path.join(__dirname, '..', 'renderer');
const iconPath = path.join(RENDERER, 'assets', 'icon.png');

function send(channel, data) {
  for (const w of [panelWin]) if (w && !w.isDestroyed()) w.webContents.send(channel, data);
}
function sendOverlay(channel, data) {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send(channel, data);
}

function createPanel() {
  panelWin = new BrowserWindow({
    width: 1040, height: 720, minWidth: 860, minHeight: 560, show: false, autoHideMenuBar: true,
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

// ---------------------------------------------------------------- overlay

function overlayUrl(opts = {}) {
  const o = { ...cfg.get('overlay'), ...opts };
  const q = new URLSearchParams({
    ws: cfg.get('statsApi.wsUrl'), show: (o.show || []).join(','), scale: String(o.scale || 1), bg: String(o.bg || 0),
    scope: o.recordScope || 'sesion',
  });
  return { file: path.join(RENDERER, 'overlay.html'), query: q.toString() };
}

function overlayConfig(extra = {}) {
  const o = cfg.get('overlay') || {};
  return { show: o.show || [], scale: o.scale || 1, bg: o.bg || 0, scope: o.recordScope || 'sesion', edit: overlayEdit, ...extra };
}

/** Crea la ventana del overlay si no existe. No la muestra. */
function ensureOverlay() {
  if (overlayWin && !overlayWin.isDestroyed()) return overlayWin;
  const b = cfg.get('overlay.bounds') || { x: 40, y: 40, width: 560, height: 240 };
  overlayWin = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, show: false, transparent: true, frame: false, alwaysOnTop: true,
    skipTaskbar: true, resizable: true, hasShadow: false, focusable: false, title: 'RL Overlay',
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const u = overlayUrl();
  overlayWin.loadFile(u.file, { search: u.query });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  applyOverlayMode();
  const saveBounds = () => { if (overlayWin && !overlayWin.isDestroyed()) cfg.set('overlay.bounds', overlayWin.getBounds()); };
  overlayWin.on('moved', saveBounds);
  overlayWin.on('resized', saveBounds);
  overlayWin.on('closed', () => { overlayWin = null; overlayEdit = false; send('state:changed', {}); });
  return overlayWin;
}

/** Clics y foco: en modo colocacion la ventana se puede arrastrar; el resto del tiempo es transparente al raton. */
function applyOverlayMode() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  const through = !overlayEdit && !!cfg.get('overlay.clickthrough');
  overlayWin.setIgnoreMouseEvents(through, { forward: true });
  try { overlayWin.setFocusable(!through); } catch (e) { /* algunas plataformas no lo permiten en caliente */ }
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  sendOverlay('overlay:config', overlayConfig());
}

function overlayVisible() { return !!(overlayWin && !overlayWin.isDestroyed() && overlayWin.isVisible()); }

/** Mostrar/ocultar (no destruye la ventana: asi el atajo es instantaneo y no se pierde la conexion). */
function toggleOverlay(force) {
  const want = force === undefined ? !overlayVisible() : !!force;
  if (!want) {
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.hide();
  } else {
    ensureOverlay();
    overlayWin.showInactive();
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
    pushRecord();
  }
  send('state:changed', {});
  return { open: overlayVisible(), edit: overlayEdit };
}

function setOverlayEdit(on) {
  overlayEdit = !!on;
  if (overlayEdit) { ensureOverlay(); overlayWin.show(); overlayWin.focus(); }
  applyOverlayMode();
  send('state:changed', {});
  return { open: overlayVisible(), edit: overlayEdit };
}

/** Marcador de victorias/derrotas que se pinta en el overlay. */
function pushRecord() {
  if (!overlayWin || overlayWin.isDestroyed()) return;
  try {
    const s = summary(joinMatches(), { gapMin: cfg.get('matches.gapMin') || 90 });
    sendOverlay('overlay:record', { sesion: s.sesion, hoy: s.hoy, scope: cfg.get('overlay.recordScope') || 'sesion' });
  } catch (e) { log.warn('pushRecord', e.message); }
}

// ---------------------------------------------------------------- partidas + MMR

/** Copia de las partidas con el cambio de MMR pegado desde el log (la cola siguiente de esa playlist). */
function joinMatches() {
  const raw = stats ? stats.list() : [];
  let colas = [];
  try { colas = watch.getHistory(cfg.get('mmr')).colas.filter((c) => c.time && c.delta != null); } catch (e) { /* sin logs */ }
  return raw.map((m) => {
    const out = { ...m, mmrDelta: null, mmrAfter: null };
    if (m.playlist == null) return out;
    const t = Date.parse(m.endedAt);
    const c = colas.find((x) => x.playlist === m.playlist && Date.parse(x.time) > t && Date.parse(x.time) - t < 30 * 60000);
    if (c) { out.mmrDelta = c.delta; out.mmrAfter = c.mmr; }
    return out;
  });
}

function matchesPayload() {
  const matches = joinMatches();
  return {
    matches, summary: summary(matches, { gapMin: cfg.get('matches.gapMin') || 90 }),
    candidates: stats ? stats.candidates() : [], myId: cfg.get('matches.myId') || null,
    calibrated: !!(watch && watch.getHistory(cfg.get('mmr')).model.calibrated),
  };
}

// ---------------------------------------------------------------- atajos

function registerShortcuts() {
  globalShortcut.unregisterAll();
  const acc = cfg.get('shortcuts.toggleOverlay');
  shortcutState = { accelerator: acc || null, ok: false };
  if (!acc) return shortcutState;
  try { shortcutState.ok = globalShortcut.register(acc, () => toggleOverlay()); } catch (e) { shortcutState.error = e.message; }
  if (!shortcutState.ok && !shortcutState.error) shortcutState.error = 'otro programa ya usa esa combinacion';
  return shortcutState;
}

// ---------------------------------------------------------------- bandeja

function buildTray() {
  let img = nativeImage.createFromPath(iconPath);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('RL Panel');
  const menu = Menu.buildFromTemplate([
    { label: 'Abrir panel', click: showPanel },
    { label: 'Overlay (mostrar/ocultar)', click: () => toggleOverlay() },
    { label: 'Colocar overlay', click: () => setOverlayEdit(true) },
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
    version: app.getVersion(), game, statsIni: ini, swap: sw,
    overlayOpen: overlayVisible(), overlayEdit,
    shortcut: shortcutState,
    stats: stats ? stats.publicLive() : null,
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

  ipcMain.handle('matches:get', () => matchesPayload());
  ipcMain.handle('matches:setMe', (_e, id) => { const v = stats.setMe(id || null); cfg.set('matches.myId', v); pushRecord(); return matchesPayload(); });
  ipcMain.handle('matches:clear', () => { stats.clear(); pushRecord(); return matchesPayload(); });

  ipcMain.handle('swap:reapply', async () => {
    if (await launcher.isRunning()) return { code: -2, output: 'Rocket League esta abierto. Cierralo del todo y vuelve a intentarlo.' };
    return swap.reapply(cfg.get('swap'), (line) => send('swap:progress', line));
  });
  ipcMain.handle('swap:baseline', () => { const s = swap.status(cfg.get('swap')); if (s.baseBin) { cfg.set('swap.baseBinSize', s.baseBin.size); cfg.set('swap.baseBinMtime', s.baseBin.mtime); } return swap.status(cfg.get('swap')); });

  // --- colores del coche (capa personal) ---
  ipcMain.handle('color:estado', () => bodycolor.estado(cfg.get('swap')));
  ipcMain.handle('color:set', (_e, indice, parametro, valor) => {
    try { bodycolor.setColor(cfg.get('swap'), Number(indice), String(parametro), valor === null ? null : String(valor)); }
    catch (err) { return { error: err.message }; }
    return bodycolor.estado(cfg.get('swap'));
  });
  ipcMain.handle('color:aplicar', async () => {
    if (await launcher.isRunning()) return { code: -2, output: 'Rocket League esta abierto. Cierralo del todo y vuelve a intentarlo.' };
    const r = await bodycolor.ejecutar(cfg.get('swap'), { instalar: true, solo: 'decals' }, (l) => send('color:progress', l));
    send('state:changed', {});
    return { ...r, estado: bodycolor.estado(cfg.get('swap')) };
  });
  ipcMain.handle('color:restaurar', async () => {
    if (await launcher.isRunning()) return { error: 'Rocket League esta abierto. Cierralo del todo y vuelve a intentarlo.' };
    const r = bodycolor.restaurar(cfg.get('swap'));
    return { ...r, estado: bodycolor.estado(cfg.get('swap')) };
  });

  ipcMain.handle('overlay:toggle', (_e, force) => toggleOverlay(force));
  ipcMain.handle('overlay:edit', (_e, on) => setOverlayEdit(on));
  ipcMain.handle('overlay:ready', () => { pushRecord(); return overlayConfig(); });
  ipcMain.handle('overlay:fit', (_e, w, h) => {
    if (!overlayWin || overlayWin.isDestroyed() || !cfg.get('overlay.autofit')) return false;
    const W = Math.max(120, Math.min(3840, Number(w) || 0)), H = Math.max(60, Math.min(2160, Number(h) || 0));
    const b = overlayWin.getBounds();
    if (Math.abs(b.width - W) < 2 && Math.abs(b.height - H) < 2) return true;
    overlayWin.setBounds({ x: b.x, y: b.y, width: W, height: H });
    cfg.set('overlay.bounds', overlayWin.getBounds());
    return true;
  });
  ipcMain.handle('overlay:paths', () => { const u = overlayUrl(); return { file: u.file, url: `file:///${u.file.replace(/\\/g, '/')}?${u.query}` }; });

  ipcMain.handle('shortcuts:set', (_e, acc) => { cfg.set('shortcuts.toggleOverlay', typeof acc === 'string' ? acc.trim() : ''); return registerShortcuts(); });

  ipcMain.handle('config:get', (_e, key) => cfg.get(key));
  ipcMain.handle('config:set', (_e, key, value) => {
    if (typeof key !== 'string' || key.startsWith('__')) return null;
    const v = cfg.set(key, value);
    if (key === 'autostart') app.setLoginItemSettings({ openAtLogin: !!value, args: ['--hidden'] });
    if (key.startsWith('overlay.')) { applyOverlayMode(); pushRecord(); }
    if (key === 'statsApi.wsUrl' && stats) stats.setUrl(value);
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

/** Ajustes nuevos sobre configuraciones ya guardadas por versiones anteriores. */
function migrate() {
  if ((cfg.get('ui.schema') || 0) < 2) {
    const show = cfg.get('overlay.show') || [];
    if (!show.includes('record')) cfg.set('overlay.show', [...show, 'record']);
    cfg.set('ui.schema', 2);
  }
}

app.on('second-instance', showPanel);
app.on('window-all-closed', () => { /* seguimos en la bandeja */ });
app.on('before-quit', () => { quitting = true; if (watch) watch.stop(); if (stats) stats.stop(); });
app.on('will-quit', () => globalShortcut.unregisterAll());

app.whenReady().then(() => {
  cfg = new Config(app.getPath('userData'));
  migrate();
  watch = new LogWatch({ storeFile: path.join(app.getPath('userData'), 'mmr_history.json'), onEvent: (ev) => { send('mmr:event', ev); pushRecord(); } });
  try { watch.rescan(); } catch (e) { log.warn('rescan', e.message); }
  watch.start(1000);

  stats = new Stats({
    url: cfg.get('statsApi.wsUrl'), storeFile: path.join(app.getPath('userData'), 'matches.json'),
    myId: cfg.get('matches.myId'), gapMin: cfg.get('matches.gapMin'),
  });
  stats.on('live', (l) => send('stats:live', l));
  stats.on('match', (m) => { log.info('partida registrada', m.playlistName, m.result, `${m.score[0]}-${m.score[1]}`); send('matches:changed', {}); pushRecord(); });
  stats.start();

  setupIpc();
  registerShortcuts();
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
        toggleOverlay(true); hook(overlayWin, 'overlay');
        await new Promise((r) => setTimeout(r, 2000));
        setOverlayEdit(true);
        await new Promise((r) => setTimeout(r, 2000));
        setOverlayEdit(false);
        const s = await getState();
        const h = watch.getHistory(cfg.get('mmr'));
        const mp = matchesPayload();
        process.stdout.write('SMOKE ' + JSON.stringify({
          version: s.version, game: s.game, statsIni: s.statsIni, epic: s.epic, additional: s.additional && s.additional.commands,
          swapAvailable: s.swap.available, swapInstalled: s.swap.installed, colas: h.colas.length, partidas: h.partidas,
          calibrated: h.model.calibrated, statsStatus: s.stats && s.stats.status, matches: mp.matches.length,
          resumen: mp.summary.sesion, shortcut: s.shortcut, overlayOpen: s.overlayOpen,
          overlayBounds: overlayWin && !overlayWin.isDestroyed() ? overlayWin.getBounds() : null,
          rendererErrors: errors,
        }) + '\n');
      } catch (e) { process.stdout.write('SMOKE ERROR ' + e.stack + '\n'); }
      quitting = true; app.quit();
    }, 6000);
  }
});
