'use strict';
// Historial de MMR a partir de Launch*.log de Rocket League (solo lectura de ficheros de log).
// Cola:    TryToPlayOnlineWithAntiCheat PlaylistId=(N) -> Post-divide PartyLeaderMMR: x -> PartyLeaderTier=(t)
// Partida: HandlePartyJoinGame MatchSettings=((ServerName="...",PlaylistId=N
// Fin:     carga de GFX_EndGameMenu_SF.upk
// Hora absoluta: "Bringing World ... up for play (0) at YYYY.MM.DD-HH.MM.SS" (ancla) o cabecera "Log file open".
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_DIR = path.join(os.homedir(), 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Logs');

const PLAYLISTS = {
  0: 'Casual (auto)', 1: 'Casual 1v1', 2: 'Casual 2v2', 3: 'Casual 3v3', 4: 'Casual Chaos 4v4',
  6: 'Privada', 7: 'Temporada', 8: 'Exhibicion', 9: 'Entrenamiento / Freeplay',
  10: 'Ranked 1v1', 11: 'Ranked 2v2', 12: 'Ranked Solo 3v3', 13: 'Ranked 3v3',
  15: 'Snow Day', 16: 'Rocket Labs', 17: 'Hoops', 18: 'Rumble', 19: 'Workshop', 20: 'UGC',
  21: 'Custom Training', 22: 'Torneo', 23: 'Dropshot', 24: 'Local', 26: 'Ranked Hoops',
  27: 'Ranked Hoops', 28: 'Ranked Rumble', 29: 'Ranked Dropshot', 30: 'Ranked Snow Day',
  34: 'Torneo', 35: 'Heatseeker', 41: 'Knockout', 43: 'Gridiron', 47: 'Heatseeker Ricochet',
};
const TIERS = ['Sin rango'];
for (const n of ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Campeon', 'Gran Campeon']) for (const r of ['I', 'II', 'III']) TIERS.push(`${n} ${r}`);
TIERS.push('Supersonic Legend');

const RE = {
  ts: /^\[(\d+\.\d+)\] (.*)$/,
  abs: /up for play \(\d+\) at (\d{4})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/,
  open: /Log file open, (\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
  queue: /TryToPlayOnlineWithAntiCheat ControllerID=\(-?\d+\) PlaylistId=\((\d+)\)/,
  playlists: /StartMatchmaking at .* for playlists ([\d,]+)/,
  mmr: /Post-divide PartyLeaderMMR: (-?[\d.]+)/,
  tier: /PartyLeaderTier=\((\d+)\)/,
  join: /HandlePartyJoinGame MatchSettings=\(\(ServerName="([^"]+)",PlaylistId=(\d+)/,
  loadOnline: /LoadMap: (\d{1,3}(?:\.\d{1,3}){3}:\d+)\/([A-Za-z0-9_]+)\?/,
  loadFreeplay: /LoadMap: ([A-Za-z0-9_]+)\?Game=TAGame\.GameInfo_\w+_TA\?GameTags=Freeplay/,
  end: /GFX_EndGameMenu_SF\.upk/,
  eac: /EAC: bAntiCheatEnabled=\((True|False)\)/,
};

const playlistName = (id) => PLAYLISTS[id] || `Playlist ${id}`;
const tierName = (t) => (t >= 0 && t < TIERS.length ? TIERS[t] : `Tier ${t}`);

/**
 * Modelo MMR_mostrado ~= a * valorLog + b, ajustado por minimos cuadrados con los puntos de calibracion
 * {playlist, raw, real} que introduce el usuario; con un solo punto se usa la pendiente por defecto y se
 * ajusta el offset; sin puntos, factor/offset por defecto. perPlaylist corrige el residuo medio de cada playlist.
 */
function fitModel(points, factor = 20, offset = 0) {
  const pts = (points || []).filter((p) => Number.isFinite(+p.raw) && Number.isFinite(+p.real)).map((p) => ({ playlist: +p.playlist, raw: +p.raw, real: +p.real }));
  let a = factor, b = offset, method = 'defecto';
  const n = pts.length;
  if (n >= 2) {
    const mx = pts.reduce((s, p) => s + p.raw, 0) / n, my = pts.reduce((s, p) => s + p.real, 0) / n;
    const sxx = pts.reduce((s, p) => s + (p.raw - mx) ** 2, 0), sxy = pts.reduce((s, p) => s + (p.raw - mx) * (p.real - my), 0);
    if (sxx > 1e-6) { a = sxy / sxx; b = my - a * mx; method = 'ajuste'; } else { a = factor; b = my - a * mx; method = 'offset'; }
  } else if (n === 1) { a = factor; b = pts[0].real - a * pts[0].raw; method = 'offset'; }
  const perPlaylist = {};
  const groups = {};
  for (const p of pts) (groups[p.playlist] = groups[p.playlist] || []).push(p.real - (a * p.raw + b));
  for (const [pl, res] of Object.entries(groups)) perPlaylist[pl] = res.reduce((s, r) => s + r, 0) / res.length;
  return { a, b, n, method, perPlaylist };
}

class SessionParser {
  constructor() { this.anchor = null; this.openAt = null; this.pending = null; this.events = []; this.eac = null; this.rest = ''; this.lastPlaylist = null; this.lastCola = null; }
  feedChunk(text) {
    const data = this.rest + text;
    const lines = data.split(/\r?\n/);
    this.rest = lines.pop() || '';
    const out = [];
    for (const line of lines) { const e = this.feedLine(line); if (e) out.push(e); }
    return out;
  }
  feedLine(line) {
    const o = line.match(RE.open);
    if (o && !this.openAt) {
      // dd/mm/yyyy (locale es); si el primer campo > 12 es dia con seguridad
      const a = +o[1], b = +o[2];
      const [d, m] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
      this.openAt = new Date(+o[3], m - 1, d, +o[4], +o[5], +o[6]);
      this.openKey = `${o[3]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${o[4]}:${o[5]}:${o[6]}`;
      return null;
    }
    const m = line.match(RE.ts);
    if (!m) return null;
    const el = parseFloat(m[1]); const rest = m[2];
    const e = rest.match(RE.eac); if (e) { this.eac = e[1] === 'True'; }
    const a = rest.match(RE.abs);
    if (a && !this.anchor) this.anchor = { el, date: new Date(+a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]) };
    let q;
    if ((q = rest.match(RE.queue))) { this.pending = { playlist: +q[1] }; return null; }
    if ((q = rest.match(RE.playlists))) {
      // "for playlists N" es la playlist realmente encolada; suele llegar DESPUES de PartyLeaderTier
      if (this.pending) { this.pending.playlists = q[1]; return null; }
      if (this.lastCola && el - this.lastCola.elapsed < 60 && !this.lastCola.playlists) {
        this.lastCola.playlists = q[1];
        const ids = q[1].split(',').map(Number).filter(Boolean);
        if (ids.length === 1 && ids[0] !== this.lastCola.playlist) { this.lastCola.buttonPlaylist = this.lastCola.playlist; this.lastCola.playlist = ids[0]; }
        return this.lastCola; // misma key: LogWatch lo trata como actualizacion
      }
      return null;
    }
    if ((q = rest.match(RE.mmr)) && this.pending) { this.pending.mmrRaw = parseFloat(q[1]); return null; }
    if ((q = rest.match(RE.tier)) && this.pending && this.pending.mmrRaw !== undefined) {
      const ev = { kind: 'cola', elapsed: el, ...this.pending, tier: +q[1] }; this.pending = null; this.lastPlaylist = ev.playlist; this.lastCola = ev; return this._finish(ev);
    }
    // partida online (solo o en party): carga de mapa desde un servidor con IP
    if ((q = rest.match(RE.loadOnline))) return this._finish({ kind: 'partida', elapsed: el, server: q[1], map: q[2], playlist: this.lastPlaylist ?? null });
    if ((q = rest.match(RE.loadFreeplay))) return this._finish({ kind: 'freeplay', elapsed: el, map: q[1] });
    if ((q = rest.match(RE.join))) { this.lastPlaylist = +q[2]; return null; } // solo informa la playlist (party)
    if (RE.end.test(rest)) return this._finish({ kind: 'fin', elapsed: el });
    return null;
  }
  _finish(ev) {
    ev.time = this.absTime(ev.elapsed);
    ev.session = this.openKey || null;
    ev.key = `${ev.session || '?'}|${ev.elapsed.toFixed(2)}|${ev.kind}`;
    this.events.push(ev);
    return ev;
  }
  absTime(el) {
    if (this.anchor) return new Date(this.anchor.date.getTime() + (el - this.anchor.el) * 1000).toISOString();
    if (this.openAt) return new Date(this.openAt.getTime() + el * 1000).toISOString();
    return null;
  }
}

function parseFile(file) {
  const p = new SessionParser();
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return { events: [], eac: null }; }
  p.feedChunk(txt + '\n');
  // eventos anteriores al ancla: recalcular hora ahora que se conoce
  for (const ev of p.events) if (!ev.time) ev.time = p.absTime(ev.elapsed);
  return { events: p.events, eac: p.eac, session: p.openKey };
}

class LogWatch {
  constructor({ dir = LOG_DIR, storeFile, onEvent } = {}) {
    this.dir = dir; this.storeFile = storeFile; this.onEvent = onEvent || (() => {});
    this.store = { events: {} };
    if (storeFile) { try { this.store = JSON.parse(fs.readFileSync(storeFile, 'utf8')); } catch (e) { /* vacio */ } }
    this.live = null; this.timer = null;
  }
  _save() {
    if (!this.storeFile) return;
    try { fs.mkdirSync(path.dirname(this.storeFile), { recursive: true }); fs.writeFileSync(this.storeFile, JSON.stringify(this.store)); } catch (e) { /* ignorar */ }
  }
  _add(ev, emit) {
    if (!ev) return false;
    const prev = this.store.events[ev.key];
    if (prev) {
      // actualizacion tardia (p.ej. llega la playlist real de la cola)
      if (ev.playlists && !prev.playlists) { Object.assign(prev, { playlists: ev.playlists, playlist: ev.playlist, buttonPlaylist: ev.buttonPlaylist }); if (emit) this.onEvent(prev); return true; }
      return false;
    }
    this.store.events[ev.key] = { ...ev };
    if (emit) this.onEvent(ev);
    return true;
  }
  rescan() {
    let files = [];
    try { files = fs.readdirSync(this.dir).filter((f) => /^Launch.*\.log$/i.test(f)).map((f) => path.join(this.dir, f)); } catch (e) { /* sin carpeta */ }
    let added = 0;
    for (const f of files) for (const ev of parseFile(f).events) if (this._add(ev, false)) added++;
    this._save();
    return { files: files.length, added, total: Object.keys(this.store.events).length };
  }
  start(intervalMs = 1000) {
    this.stop();
    const file = path.join(this.dir, 'Launch.log');
    this.live = { file, pos: 0, parser: new SessionParser(), inode: null };
    const tick = () => {
      let st; try { st = fs.statSync(file); } catch (e) { return; }
      const L = this.live;
      if (L.pos > st.size || (L.ctime && st.ctimeMs !== L.ctime && L.pos === 0)) { L.pos = 0; L.parser = new SessionParser(); }
      L.ctime = st.ctimeMs;
      if (st.size === L.pos) return;
      const fd = fs.openSync(file, 'r');
      const len = st.size - L.pos; const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, L.pos); fs.closeSync(fd);
      L.pos = st.size;
      const evs = L.parser.feedChunk(buf.toString('utf8'));
      let changed = false;
      for (const ev of evs) { if (!ev.time) ev.time = L.parser.absTime(ev.elapsed); if (this._add(ev, true)) changed = true; }
      if (changed) this._save();
    };
    this.timer = setInterval(tick, intervalMs);
    tick();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  liveEac() { return this.live && this.live.parser ? this.live.parser.eac : null; }
  getHistory({ factor = 20, offset = 0, points = [] } = {}) {
    const all = Object.values(this.store.events).sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.elapsed - b.elapsed);
    const colas = all.filter((e) => e.kind === 'cola');
    const model = fitModel(points, factor, offset);
    const last = {};
    for (const e of colas) {
      e.mmr = Math.round(model.a * e.mmrRaw + model.b + (model.perPlaylist[e.playlist] || 0));
      e.playlistName = playlistName(e.playlist);
      e.tierName = tierName(e.tier);
      const prev = last[e.playlist];
      e.delta = prev === undefined ? null : e.mmr - prev;
      last[e.playlist] = e.mmr;
    }
    const byPlaylist = {};
    for (const e of colas) (byPlaylist[e.playlist] = byPlaylist[e.playlist] || []).push({ time: e.time, mmr: e.mmr, tier: e.tier });
    return {
      colas, byPlaylist, model,
      partidas: all.filter((e) => e.kind === 'partida').length,
      freeplays: all.filter((e) => e.kind === 'freeplay').length,
      fines: all.filter((e) => e.kind === 'fin').length,
      playlists: Object.keys(byPlaylist).map((id) => ({ id: +id, name: playlistName(+id), n: byPlaylist[id].length })),
    };
  }
}

module.exports = { LogWatch, SessionParser, parseFile, fitModel, playlistName, tierName, PLAYLISTS, TIERS, LOG_DIR };
