// Pruebas de los modulos del proceso principal en Node puro (sin Electron).
// No modifica nada real: los .ini se prueban sobre copias temporales.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const launcher = require('../main/launcher');
const statsini = require('../main/statsini');
const { LogWatch, parseFile } = require('../main/logwatch');
const swap = require('../main/swaplayer');
const { Config, DEFAULTS } = require('../main/config');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rlpanel-test-'));
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${name} ${extra}`); if (!cond) fails++; };

// --- config ---
const cfg = new Config(tmp);
cfg.set('mmr.factor', 21); ok('config set/get', new Config(tmp).get('mmr.factor') === 21 && cfg.get('overlay.scale') === DEFAULTS.overlay.scale);

// --- launcher: manifiesto y URI ---
const m = launcher.findManifest();
ok('manifest Sugar', !!m && m.ns === '9773aa1aa54f4f7b80e44bef04986cea' && m.item === '530145df28a24424923f5828cc9031a1', m ? m.version : 'no encontrado');
if (m) {
  ok('launch URI', launcher.launchUri(m) === 'com.epicgames.launcher://apps/9773aa1aa54f4f7b80e44bef04986cea%3A530145df28a24424923f5828cc9031a1%3ASugar?action=launch&silent=true');
  const cur = launcher.getAdditionalCommands(m);
  ok('additional commands leidos', cur.exists && cur.commands === '-dx11' && cur.enabled === true, JSON.stringify({ commands: cur.commands, enabled: cur.enabled, section: cur.section }));
  // sobre una COPIA del ini de Epic
  const copy = path.join(tmp, 'GameUserSettings.ini');
  fs.copyFileSync(launcher.EGL_INI, copy);
  const before = fs.readFileSync(copy);
  const a = launcher.setAdditionalCommands(m, { enabled: true, commands: (launcher.stripFlag(cur.commands, '-noeac') + ' -noeac').trim() }, copy);
  ok('set -noeac en copia', a.commands === '-dx11 -noeac' && a.enabled === true, a.commands);
  const b = launcher.setAdditionalCommands(m, { enabled: cur.enabled, commands: cur.commands }, copy);
  const after = fs.readFileSync(copy);
  ok('restaurar deja la copia byte-identica', Buffer.compare(before, after) === 0 && b.commands === '-dx11', `${before.length} vs ${after.length} bytes`);
  // insercion cuando faltan las claves
  const stripped = fs.readFileSync(copy, 'utf8').split(/\r?\n/).filter((l) => !l.includes('Sugar_Additional')).join('\r\n');
  fs.writeFileSync(copy, stripped, 'utf8');
  const c = launcher.setAdditionalCommands(m, { enabled: true, commands: '-noeac' }, copy);
  ok('insertar claves ausentes', c.commands === '-noeac' && c.enabled === true && c.section !== null, `seccion=${c.section}`);
}
ok('stripFlag', launcher.stripFlag('-dx11 -noeac -foo', '-noeac') === '-dx11 -foo' && launcher.stripFlag('-noeac', '-noeac') === '');
const flag = launcher.readEacFlag();
ok('readEacFlag del Launch.log', flag.eac !== null && !!flag.version, JSON.stringify(flag));

// --- statsini ---
const ini = statsini.read();
ok('TAStatsAPI.ini', ini.exists && ini.port === 49123 && ini.webPort === 49124, JSON.stringify(ini));
const iniCopy = path.join(tmp, 'TAStatsAPI.ini'); fs.copyFileSync(statsini.INI, iniCopy);
const r30 = statsini.setRate(30, iniCopy); const r0 = statsini.setRate(0, iniCopy);
ok('setRate en copia', r30.rate === 30 && r0.rate === 0 && fs.readFileSync(iniCopy, 'utf8').includes('\r\n'));
const fresh = path.join(tmp, 'nuevo.ini'); const rn = statsini.setRate(10, fresh);
ok('setRate crea ini nuevo', rn.exists && rn.rate === 10 && rn.port === 49123);

// --- logwatch ---
const store = path.join(tmp, 'mmr_history.json');
const w = new LogWatch({ storeFile: store });
const rs = w.rescan();
const h = w.getHistory({ factor: 20, offset: 0 });
ok('rescan logs', rs.files > 0 && h.colas.length > 0, `files=${rs.files} colas=${h.colas.length} partidas=${h.partidas} fines=${h.fines}`);
const last = h.colas[h.colas.length - 1];
ok('MMR calculado', last && Number.isInteger(last.mmr) && last.playlistName && last.tierName, last ? `${last.time} ${last.playlistName} ${last.tierName} ${last.mmr} d=${last.delta}` : '');
// fixture sintetico y determinista (los logs reales se purgan con el tiempo)
{
  const fix = path.join(tmp, 'Launch.log');
  fs.writeFileSync(fix, [
    'Log: Log file open, 13/09/2026 17:14:01',
    'Log: GPsyonixBuildID 260825.79374.526531',
    '[0011.62] EAC: bAntiCheatEnabled=(True)',
    '[0013.37] Log: Bringing World menu_main_p.TheWorld up for play (0) at 2026.09.13-17.14.14',
    '[0400.00] Online: TryToPlayOnlineWithAntiCheat ControllerID=(-1) PlaylistId=(11)',
    '[0402.00] Matchmaking: StartMatchmaking at 2026-09-13 17:20:00 in EU3,EU1 for playlists 11 on game server ',
    '[0402.10] Matchmaking: Pre-divide PartyLeaderMMR: 70.0000',
    '[0402.10] Matchmaking: Post-divide PartyLeaderMMR: 70.0000',
    '[0402.10] Matchmaking: PartyLeaderTier=(19)',
    '[0300.00] Log: LoadMap: Stadium_P?Game=TAGame.GameInfo_Soccar_TA?GameTags=Freeplay',
    '[0450.00] Log: LoadMap: 18.202.167.33:7777/Farm_GRS_P?Name=maiquel_14?game=TAGame.GameInfo_Soccar_TA',
    '[0800.00] Log: Fully load package: ..\\..\\TAGame\\CookedPCConsole\\GFX_EndGameMenu_SF.upk',
    '[0900.00] Online: TryToPlayOnlineWithAntiCheat ControllerID=(-1) PlaylistId=(11)',
    '[0902.00] Matchmaking: Post-divide PartyLeaderMMR: 70.4500',
    '[0902.00] Matchmaking: PartyLeaderTier=(19)',
  ].join('\r\n') + '\r\n', 'utf8');
  const r = parseFile(fix);
  const colas = r.events.filter((e) => e.kind === 'cola');
  const fixW = new LogWatch({ storeFile: path.join(tmp, 'fix.json'), dir: tmp }); fixW.rescan();
  const fh = fixW.getHistory({ factor: 20, offset: 0 });
  // la cola se cierra en la linea PartyLeaderTier (t=402.10), no en la de TryToPlay (t=400)
  const t0 = new Date(2026, 8, 13, 17, 14, 14).getTime() + (402.10 - 13.37) * 1000;
  const partidas = r.events.filter((e) => e.kind === 'partida');
  ok('fixture: 2 colas, 1 freeplay, 1 partida (mapa+playlist), 1 fin, eac', colas.length === 2 && partidas.length === 1 && partidas[0].map === 'Farm_GRS_P' && partidas[0].playlist === 11 && r.events.filter((e) => e.kind === 'freeplay').length === 1 && r.events.filter((e) => e.kind === 'fin').length === 1 && r.eac === true, JSON.stringify(r.events.map((e) => e.kind)));
  ok('fixture: hora absoluta desde el ancla', Math.abs(new Date(colas[0].time).getTime() - t0) < 1500, `${colas[0].time} vs ${new Date(t0).toISOString()}`);
  ok('fixture: MMR x20 y delta', fh.colas[0].mmr === 1400 && fh.colas[1].mmr === 1409 && fh.colas[1].delta === 9 && fh.colas[0].tierName === 'Gran Campeon I' && fh.colas[0].playlistName === 'Ranked 2v2', JSON.stringify(fh.colas.map((c) => [c.mmr, c.delta])));
}
// dedupe: segundo rescan no anade
const rs2 = w.rescan(); ok('rescan idempotente', rs2.added === 0, `added=${rs2.added}`);
// parser incremental: trocear un log en chunks arbitrarios debe dar los mismos eventos
const logDir = require('../main/logwatch').LOG_DIR; const one = path.join(logDir, 'Launch.log');
if (fs.existsSync(one)) {
  const { SessionParser } = require('../main/logwatch');
  const txt = fs.readFileSync(one, 'utf8'); const p = new SessionParser(); const evs = [];
  for (let i = 0; i < txt.length; i += 777) evs.push(...p.feedChunk(txt.slice(i, i + 777)));
  evs.push(...p.feedChunk('\n'));
  const ref = parseFile(one).events;
  ok('parser incremental == parseFile', evs.length === ref.length, `${evs.length} vs ${ref.length}`);
}

// --- calibracion MMR (puntos reales de Miquel, 2026-09-14) ---
{
  const { fitModel } = require('../main/logwatch');
  const pts = [{ playlist: 10, raw: 23.907, real: 981 }, { playlist: 11, raw: 69.150, real: 1495 }, { playlist: 13, raw: 48.951, real: 1258 }];
  const m = fitModel(pts, 20, 0);
  const pred = (raw, pl) => Math.round(m.a * raw + m.b + (m.perPlaylist[pl] || 0));
  ok('fitModel: ajuste ~11.4x+709 con 3 puntos', m.method === 'ajuste' && Math.abs(m.a - 11.36) < 0.1 && Math.abs(m.b - 709) < 5, `a=${m.a.toFixed(3)} b=${m.b.toFixed(1)}`);
  ok('fitModel: reproduce los 3 puntos con correccion por playlist', pred(23.907, 10) === 981 && pred(69.150, 11) === 1495 && pred(48.951, 13) === 1258, `${pred(23.907, 10)} ${pred(69.150, 11)} ${pred(48.951, 13)}`);
  const one = fitModel([pts[1]], 20, 0);
  ok('fitModel: 1 punto = pendiente 20 + offset', one.method === 'offset' && Math.round(one.a * 69.150 + one.b) === 1495);
  ok('fitModel: sin puntos = defecto', fitModel([], 20, 0).method === 'defecto' && fitModel([], 20, 0).a === 20);
}
// --- swaplayer ---
const sw = swap.status(DEFAULTS.swap);
ok('swap status', sw.available === true && typeof sw.installed === 'boolean' && sw.baseBin && sw.baseBin.size > 0, JSON.stringify({ installed: sw.installed, isOriginal: sw.isOriginal, baseBin: sw.baseBin && sw.baseBin.size }));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fails ? `\n${fails} prueba(s) fallida(s)` : '\nTODO OK');
process.exit(fails ? 1 : 0);
