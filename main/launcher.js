'use strict';
// Lanzador dual por la via oficial de Epic:
//  - Jugar online (EAC): URI com.epicgames.launcher://apps/...?action=launch
//  - Entrenar sin EAC: misma URI, anadiendo -noeac a los "argumentos adicionales" que Epic guarda
//    por juego en GameUserSettings.ini (la misma casilla que la biblioteca de Epic), y restaurandolos
//    despues. Launcher.exe de RL elige RocketLeague.exe / RocketLeague_EAC.exe segun ese flag.
// El modo real se verifica leyendo la linea "EAC: bAntiCheatEnabled=(...)" del propio Launch.log.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

const MANIFESTS = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
const EGL_INI = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'EpicGamesLauncher', 'Saved', 'Config', 'WindowsEditor', 'GameUserSettings.ini');
const RL_LOG = path.join(os.homedir(), 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Logs', 'Launch.log');

function findManifest(appName = 'Sugar', dir = MANIFESTS) {
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.item')); } catch (e) { return null; }
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (d.AppName === appName) {
        return {
          app: d.AppName, ns: d.CatalogNamespace, item: d.CatalogItemId,
          installLocation: d.InstallLocation, version: d.AppVersionString,
          launchExecutable: d.LaunchExecutable, manifest: path.join(dir, f),
        };
      }
    } catch (e) { /* item corrupto: seguir */ }
  }
  return null;
}

function launchUri(m) {
  return `com.epicgames.launcher://apps/${m.ns}%3A${m.item}%3A${m.app}?action=launch&silent=true`;
}

// ---- GameUserSettings.ini de Epic (argumentos adicionales por juego) ----
function readIni(file = EGL_INI) {
  const buf = fs.readFileSync(file);
  let txt = buf.toString('utf8');
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
  const eol = txt.includes('\r\n') ? '\r\n' : '\n';
  return { lines: txt.split(/\r?\n/), eol, bom: buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf };
}

function keyBase(m) { return `${m.ns}:${m.item}:${m.app}`; }

function getAdditionalCommands(m, file = EGL_INI) {
  const out = { file, exists: false, enabled: false, commands: '', section: null };
  let ini;
  try { ini = readIni(file); out.exists = true; } catch (e) { return out; }
  const kb = keyBase(m);
  let section = null;
  for (const line of ini.lines) {
    const s = line.match(/^\[(.+)\]\s*$/);
    if (s) { section = s[1]; continue; }
    if (line.startsWith(kb + '_AdditionalCommandsEnabled=')) { out.enabled = /true/i.test(line.split('=')[1] || ''); out.section = section; }
    else if (line.startsWith(kb + '_AdditionalCommands=')) { out.commands = line.slice((kb + '_AdditionalCommands=').length).trim(); out.section = section; }
  }
  return out;
}

function setAdditionalCommands(m, { enabled, commands }, file = EGL_INI) {
  const ini = readIni(file);
  const kb = keyBase(m);
  const kEn = kb + '_AdditionalCommandsEnabled=';
  const kCmd = kb + '_AdditionalCommands=';
  let idxEn = -1, idxCmd = -1, anchor = -1, section = null, anchorSection = null;
  ini.lines.forEach((line, i) => {
    const s = line.match(/^\[(.+)\]\s*$/);
    if (s) { section = s[1]; return; }
    if (line.startsWith(kEn)) idxEn = i;
    if (line.startsWith(kCmd)) idxCmd = i;
    // ancla: cualquier clave por-app de la misma seccion (p.ej. ..._AutoUpdate=True)
    if (anchor < 0 && /^[0-9a-f]{32}:[0-9a-f]{32}:\w+_\w+=/.test(line)) { anchor = i; anchorSection = section; }
  });
  const lineEn = `${kEn}${enabled ? 'True' : 'False'}`;
  const lineCmd = `${kCmd}${commands}`;
  if (idxEn >= 0) ini.lines[idxEn] = lineEn;
  if (idxCmd >= 0) ini.lines[idxCmd] = lineCmd;
  if (idxEn < 0 || idxCmd < 0) {
    const at = idxEn >= 0 ? idxEn + 1 : idxCmd >= 0 ? idxCmd + 1 : anchor >= 0 ? anchor + 1 : -1;
    if (at < 0) throw new Error('No encuentro la seccion de ajustes por juego en GameUserSettings.ini');
    const add = [];
    if (idxEn < 0) add.push(lineEn);
    if (idxCmd < 0) add.push(lineCmd);
    ini.lines.splice(at, 0, ...add);
  }
  const txt = (ini.bom ? '\ufeff' : '') + ini.lines.join(ini.eol);
  fs.writeFileSync(file, txt, 'utf8');
  return getAdditionalCommands(m, file);
}

function stripFlag(cmds, flag) {
  return cmds.split(/\s+/).filter((t) => t && t.toLowerCase() !== flag.toLowerCase()).join(' ');
}

// ---- estado del juego ----
function isRunning() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq RocketLeague.exe', '/NH'], { windowsHide: true }, (err, out) => {
      resolve(!err && /RocketLeague\.exe/i.test(out || ''));
    });
  });
}

function readEacFlag(file = RL_LOG) {
  // Devuelve {eac: true|false|null, mtime, version, cmdHasNoEac}
  const out = { eac: null, mtime: null, version: null, cmdHasNoEac: null };
  try {
    const st = fs.statSync(file); out.mtime = st.mtimeMs;
    const fd = fs.openSync(file, 'r');
    const len = Math.min(st.size, 256 * 1024);
    const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, 0); fs.closeSync(fd);
    const head = buf.toString('utf8');
    const m = head.match(/EAC: bAntiCheatEnabled=\((True|False)\)/);
    if (m) out.eac = m[1] === 'True';
    const v = head.match(/GPsyonixBuildID (\S+)/); if (v) out.version = v[1];
    const c = head.match(/^Log: Command line: (.*)$/m);
    if (c) out.cmdHasNoEac = /-noeac\b/i.test(c[1]);
  } catch (e) { /* sin log */ }
  return out;
}

async function detect() {
  const running = await isRunning();
  const flag = readEacFlag();
  const fresh = flag.mtime && (Date.now() - flag.mtime) < 6 * 3600 * 1000;
  let mode = 'none';
  if (running) mode = flag.eac === false ? 'noeac' : flag.eac === true ? 'eac' : 'unknown';
  return { running, mode, eacFlag: flag.eac, logFresh: !!fresh, version: flag.version };
}

function defaultOpen(uri) {
  return new Promise((resolve, reject) => {
    const p = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${uri.replace(/'/g, "''")}'`],
      { windowsHide: true, stdio: 'ignore' });
    p.on('error', reject); p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('Start-Process exit ' + code))));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForGame(timeoutMs, progress) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await isRunning()) return true;
    if (progress) progress({ step: 'waiting', elapsed: Math.round((Date.now() - t0) / 1000) });
    await sleep(2000);
  }
  return false;
}

async function waitForEacFlag(timeoutMs, sinceMtime) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const f = readEacFlag();
    if (f.eac !== null && f.mtime && f.mtime > sinceMtime) return f;
    await sleep(2000);
  }
  return readEacFlag();
}

/**
 * launch('eac' | 'noeac', {open, progress})
 * Devuelve {ok, mode, message, steps[]}
 */
async function launch(mode, opts = {}) {
  const open = opts.open || defaultOpen;
  const progress = opts.progress || (() => {});
  const steps = [];
  const say = (s) => { steps.push(s); progress({ step: s }); };
  if (await isRunning()) return { ok: false, mode: 'running', message: 'Rocket League ya esta abierto. Cierralo para cambiar de modo.', steps };
  const m = findManifest();
  if (!m) return { ok: false, mode: 'none', message: 'No encuentro Rocket League en los manifiestos de Epic. Esta instalado con Epic Games?', steps };
  const uri = launchUri(m);
  const before = readEacFlag().mtime || 0;
  let saved = null;
  try {
    if (mode === 'noeac') {
      const cur = getAdditionalCommands(m);
      if (!cur.exists) return { ok: false, mode: 'none', message: 'No encuentro GameUserSettings.ini del launcher de Epic.', steps };
      saved = { enabled: cur.enabled, commands: cur.commands };
      const cmds = (stripFlag(cur.commands, '-noeac') + ' -noeac').trim();
      setAdditionalCommands(m, { enabled: true, commands: cmds });
      say(`Argumentos adicionales de Epic: "${cmds}" (temporal)`);
    } else {
      const cur = getAdditionalCommands(m);
      if (cur.exists && /-noeac\b/i.test(cur.commands)) {
        setAdditionalCommands(m, { enabled: cur.enabled, commands: stripFlag(cur.commands, '-noeac') });
        say('Quitado un -noeac que habia quedado de antes');
      }
    }
    say('Pidiendo al launcher de Epic que arranque Rocket League...');
    await open(uri);
    const started = await waitForGame(120000, progress);
    if (!started) return { ok: false, mode: 'none', message: 'El juego no ha arrancado en 2 minutos. Esta abierto el launcher de Epic y con sesion iniciada?', steps };
    say('RocketLeague.exe en marcha; leyendo el log del juego...');
    const flag = await waitForEacFlag(45000, before);
    const real = flag.eac === false ? 'noeac' : flag.eac === true ? 'eac' : 'unknown';
    let ok = real === mode || (mode === 'eac' && real === 'unknown');
    let message = real === 'eac' ? 'Rocket League esta corriendo CON Easy Anti-Cheat (online disponible).'
      : real === 'noeac' ? 'Rocket League esta corriendo SIN Easy Anti-Cheat (modo oficial: solo offline, entrenamiento, LAN y repeticiones).'
        : 'No he podido leer el estado de EAC en el log todavia.';
    if (mode === 'noeac' && real === 'eac') {
      ok = false;
      message = 'El launcher de Epic ha ignorado el argumento -noeac (ha arrancado con EAC). Alternativa oficial: en Epic, Rocket League > menu "..." > "Play without Easy Anti-Cheat".';
    }
    return { ok, mode: real, message, steps };
  } catch (e) {
    return { ok: false, mode: 'error', message: `Error: ${e.message}`, steps };
  } finally {
    if (saved) {
      try { setAdditionalCommands(m, saved); say(`Argumentos adicionales de Epic restaurados: "${saved.commands}"`); } catch (e) { say('AVISO: no pude restaurar los argumentos adicionales: ' + e.message); }
    }
  }
}

module.exports = { findManifest, launchUri, getAdditionalCommands, setAdditionalCommands, stripFlag, isRunning, readEacFlag, detect, launch, MANIFESTS, EGL_INI, RL_LOG };
