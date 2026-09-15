'use strict';
/* Stats API oficial de Rocket League, en el proceso principal.
   Una sola conexion WebSocket (la abre el propio juego en ws://127.0.0.1:49124) que alimenta
   el estado en vivo del panel y el REGISTRO DE PARTIDAS. Solo lee: nunca escribe al juego.
   Envoltorio de Psyonix: {"Event": nombre, "Data": "<JSON como string>"}. */
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { playlistName } = require('./logwatch');

const NUM_FIELDS = ['Score', 'Goals', 'Assists', 'Saves', 'Shots', 'Touches', 'Demos', 'Cartouches'];
const NO_MATCH_PLAYLISTS = new Set([9, 21]); // freeplay y entrenamiento personalizado: no son partidas
const MAX_MATCHES = 2000;
const GAP_MIN = 90;     // minutos de pausa que cierran una "sesion de juego"
const MIN_SECONDS = 60; // una partida abandonada antes de esto no se registra

const num = (v) => (Number.isFinite(v) ? v : 0);
const pickStats = (p) => { const o = {}; for (const k of NUM_FIELDS) if (Number.isFinite(p[k])) o[k] = p[k]; return o; };
const topKey = (obj) => { let best = null, max = -1; for (const [k, v] of Object.entries(obj || {})) if (v > max) { max = v; best = k; } return best; };

/** Agrupa partidas en sesiones de juego: corta cuando hay una pausa mayor que gapMin. */
function groupSessions(matches, gapMin = GAP_MIN) {
  const out = [];
  let cur = null;
  for (const m of [...(matches || [])].sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))) {
    const t0 = Date.parse(m.startedAt), t1 = Date.parse(m.endedAt || m.startedAt);
    if (!Number.isFinite(t0)) continue;
    if (cur && t0 - cur.end <= gapMin * 60000) { cur.items.push(m); cur.end = Math.max(cur.end, t1 || t0); }
    else { cur = { start: t0, end: Number.isFinite(t1) ? t1 : t0, items: [m] }; out.push(cur); }
  }
  return out;
}

/** Totales de un conjunto de partidas desde el punto de vista del jugador. */
function agg(items) {
  const a = { n: items.length, v: 0, d: 0, otras: 0, goles: 0, asist: 0, paradas: 0, tiros: 0, puntos: 0, mmr: 0, mmrConocido: 0, racha: 0 };
  for (const m of items) {
    if (m.result === 'victoria') a.v++; else if (m.result === 'derrota') a.d++; else a.otras++;
    const me = m.me || {};
    a.goles += num(me.Goals); a.asist += num(me.Assists); a.paradas += num(me.Saves); a.tiros += num(me.Shots); a.puntos += num(me.Score);
    if (Number.isFinite(m.mmrDelta)) { a.mmr += m.mmrDelta; a.mmrConocido++; }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i].result;
    if (r !== 'victoria' && r !== 'derrota') continue;
    const sign = r === 'victoria' ? 1 : -1;
    if (a.racha === 0) a.racha = sign;
    else if (Math.sign(a.racha) === sign) a.racha += sign;
    else break;
  }
  return a;
}

/** Resumen listo para pintar: hoy, sesion en curso, total y desglose por playlist. */
function summary(matches, { now = Date.now(), gapMin = GAP_MIN } = {}) {
  const list = matches || [];
  const sessions = groupSessions(list, gapMin);
  const last = sessions[sessions.length - 1] || null;
  const active = last && now - last.end <= gapMin * 60000 ? last : null;
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const today = list.filter((m) => Date.parse(m.endedAt || m.startedAt) >= d0.getTime());
  const byPlaylist = {};
  for (const m of list) { const k = m.playlist == null ? 'otras' : m.playlist; (byPlaylist[k] = byPlaylist[k] || []).push(m); }
  return {
    hoy: agg(today), sesion: agg(active ? active.items : []), total: agg(list),
    sesionDesde: active ? new Date(active.start).toISOString() : null,
    sesiones: sessions.length,
    porPlaylist: Object.entries(byPlaylist)
      .map(([k, items]) => ({ playlist: k === 'otras' ? null : +k, name: k === 'otras' ? 'Sin identificar' : playlistName(+k), ...agg(items) }))
      .sort((x, y) => y.n - x.n),
  };
}

/** Jugadores vistos ultimamente, para que el usuario pueda decir cual es el suyo. */
function candidates(matches, limit = 30) {
  const seen = new Map();
  for (const m of (matches || []).slice(-limit)) {
    for (const p of m.players || []) {
      if (!p.id) continue;
      const c = seen.get(p.id) || { id: p.id, name: p.name || p.id, n: 0, auto: 0 };
      c.name = p.name || c.name; c.n++;
      if (m.me && m.me.id === p.id) c.auto++;
      seen.set(p.id, c);
    }
  }
  return [...seen.values()].sort((a, b) => b.auto - a.auto || b.n - a.n);
}

class Stats extends EventEmitter {
  constructor({ url = 'ws://127.0.0.1:49124', storeFile = null, myId = null, gapMin = GAP_MIN } = {}) {
    super();
    this.url = url; this.storeFile = storeFile; this.myId = myId || null; this.gapMin = gapMin;
    this.store = { matches: [] };
    if (storeFile) {
      try { const s = JSON.parse(fs.readFileSync(storeFile, 'utf8')); if (Array.isArray(s.matches)) this.store.matches = s.matches; } catch (e) { /* primera vez */ }
    }
    this.status = 'idle'; this.ws = null; this.stopped = true; this.delay = 1000; this.timer = null; this.liveTimer = null;
    this.live = { connected: false, inMatch: false, game: null, players: [], me: null, lastEvent: null, lastAt: 0, events: 0 };
    this.current = null;
  }

  // --- conexion ---
  start() { this.stopped = false; this._connect(); return this; }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    if (this.liveTimer) clearTimeout(this.liveTimer); this.liveTimer = null;
    this._closeCurrent('cierre');
    if (this.ws) { try { this.ws.close(); } catch (e) { /* ya cerrado */ } }
  }
  setUrl(url) {
    if (!url || url === this.url) return;
    this.url = url;
    if (!this.stopped && this.ws) { try { this.ws.close(); } catch (e) { /* forzar reconexion */ } }
  }
  _setStatus(s) { if (this.status === s) return; this.status = s; this._emitLive(true); }
  _connect() {
    if (this.stopped) return;
    let WebSocket;
    try { WebSocket = require('ws'); } catch (e) { this._setStatus('sin-ws'); return; }
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { return this._retry(); }
    this.ws = ws;
    this._setStatus('conectando');
    ws.on('open', () => { this.delay = 1000; this.live.connected = true; this._setStatus('conectado'); });
    ws.on('message', (buf) => this._onRaw(buf.toString('utf8')));
    ws.on('error', () => { try { ws.close(); } catch (e) { /* el close hace el retry */ } });
    ws.on('close', () => {
      if (this.ws !== ws) return;
      this.live.connected = false; this.live.inMatch = false; this.live.game = null; this.live.players = []; this.live.me = null;
      this._closeCurrent('desconexion');
      this._setStatus('sin-conexion');
      this._retry();
    });
  }
  _retry() {
    if (this.stopped || this.timer) return;
    const wait = this.delay + Math.random() * 400;
    this.delay = Math.min(this.delay * 2, 15000);
    this.timer = setTimeout(() => { this.timer = null; this._connect(); }, wait);
  }

  // --- eventos ---
  _onRaw(raw) {
    let env; try { env = JSON.parse(raw); } catch (e) { return; }
    let data = env.Data;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = {}; } }
    this._apply(env.Event, data || {});
  }
  _apply(ev, d) {
    const L = this.live; L.lastEvent = ev; L.lastAt = Date.now(); L.events++;
    switch (ev) {
      case 'MatchCreated': case 'MatchInitialized':
        L.inMatch = true; this._closeCurrent('nueva'); this._begin(false); break;
      case 'UpdateState':
        L.inMatch = true;
        if (d.Game) L.game = d.Game;
        L.players = d.Players || [];
        if (!this.current) this._begin(true);
        this._ingest(d);
        L.me = this.current && this.current.meId ? (d.Players || []).find((p) => (p.PrimaryId || p.Name) === this.current.meId) || null : null;
        break;
      case 'GoalScored': if (this.current) this.current.goals++; break;
      case 'MatchEnded':
        L.inMatch = false;
        if (this.current) { this.current.winner = Number.isFinite(d.WinnerTeamNum) ? d.WinnerTeamNum : null; this.current.ended = true; }
        this._closeCurrent('fin');
        break;
      case 'MatchDestroyed': L.inMatch = false; this._closeCurrent('salida'); break;
      default: break;
    }
    this._emitLive();
  }
  _emitLive(now = false) {
    if (now) { if (this.liveTimer) { clearTimeout(this.liveTimer); this.liveTimer = null; } this.emit('live', this.publicLive()); return; }
    if (this.liveTimer) return;
    this.liveTimer = setTimeout(() => { this.liveTimer = null; this.emit('live', this.publicLive()); }, 500);
  }
  publicLive() {
    const L = this.live;
    const teams = (L.game && L.game.Teams) || null;
    return {
      status: this.status, connected: L.connected, inMatch: L.inMatch, events: L.events, lastEvent: L.lastEvent, lastAt: L.lastAt,
      playlist: this.current ? this.current.playlist : null,
      score: teams ? { 0: num((teams.find((t) => t.TeamNum === 0) || {}).Score), 1: num((teams.find((t) => t.TeamNum === 1) || {}).Score) } : null,
      me: L.me ? { name: L.me.Name, team: num(L.me.TeamNum), ...pickStats(L.me) } : null,
    };
  }

  // --- partida en curso ---
  _begin(partial) {
    this.current = { startedAt: Date.now(), lastAt: Date.now(), partial: !!partial, goals: 0, targets: {}, players: {}, teams: {}, playlist: null, arena: null, winner: null, ended: false, meId: null };
  }
  _ingest(d) {
    const c = this.current; if (!c) return;
    const g = d.Game || {};
    if (Number.isFinite(g.PlaylistId)) c.playlist = g.PlaylistId;
    if (typeof g.Arena === 'string' && g.Arena) c.arena = g.Arena;
    for (const t of g.Teams || []) if (Number.isFinite(t.TeamNum)) c.teams[t.TeamNum] = { num: t.TeamNum, score: num(t.Score), name: t.Name || null };
    for (const p of d.Players || []) {
      const id = p.PrimaryId || p.Name; if (!id) continue;
      c.players[id] = { id, name: p.Name || '', team: num(p.TeamNum), ...pickStats(p) };
    }
    const tid = this._targetId(d);
    if (tid) c.targets[tid] = (c.targets[tid] || 0) + 1;
    c.meId = this.myId && c.players[this.myId] ? this.myId : topKey(c.targets);
    c.lastAt = Date.now();
  }
  /** Quien es el jugador local: Game.Target (la camara sigue al tuyo salvo en repeticiones de gol). */
  _targetId(d) {
    const g = d.Game || {}; const pl = d.Players || [];
    const t = g.Target;
    if (typeof t === 'string' && t) { const m = pl.find((p) => p.PrimaryId === t || p.Name === t); return m ? (m.PrimaryId || m.Name) : null; }
    if (t && typeof t === 'object') {
      const m = pl.find((p) => p.Name === t.Name && (t.TeamNum === undefined || p.TeamNum === t.TeamNum));
      return m ? (m.PrimaryId || m.Name) : null;
    }
    return null;
  }
  _closeCurrent(reason) {
    const c = this.current; this.current = null;
    if (!c) return null;
    const rec = this._finalize(c, reason);
    if (!rec) return null;
    this.store.matches.push(rec);
    if (this.store.matches.length > MAX_MATCHES) this.store.matches = this.store.matches.slice(-MAX_MATCHES);
    this._save();
    this.emit('match', rec);
    return rec;
  }
  _finalize(c, reason) {
    const players = Object.values(c.players);
    const dur = Math.max(0, Math.round((c.lastAt - c.startedAt) / 1000));
    if (!players.length) return null;
    if (c.playlist != null && NO_MATCH_PLAYLISTS.has(c.playlist)) return null;
    if (!c.ended && dur < MIN_SECONDS) return null;
    const meId = this.myId && c.players[this.myId] ? this.myId : topKey(c.targets);
    const me = meId ? c.players[meId] : null;
    let result = 'incompleta';
    if (c.ended && me && (c.winner === 0 || c.winner === 1)) result = c.winner === me.team ? 'victoria' : 'derrota';
    else if (c.ended) result = 'desconocido';
    return {
      id: String(c.startedAt), startedAt: new Date(c.startedAt).toISOString(), endedAt: new Date(c.lastAt).toISOString(), durationS: dur,
      playlist: c.playlist, playlistName: c.playlist == null ? null : playlistName(c.playlist), arena: c.arena,
      partial: !!c.partial, reason, result, winner: c.winner,
      score: { 0: (c.teams[0] || {}).score || 0, 1: (c.teams[1] || {}).score || 0 },
      me: me ? { ...me } : null, meAuto: !(this.myId && c.players[this.myId]), players,
    };
  }

  // --- almacen ---
  _save() {
    if (!this.storeFile) return;
    try { fs.mkdirSync(path.dirname(this.storeFile), { recursive: true }); fs.writeFileSync(this.storeFile, JSON.stringify(this.store), 'utf8'); } catch (e) { /* no bloquear la app */ }
  }
  list() { return this.store.matches; }
  candidates() { return candidates(this.store.matches); }
  /** Fijar quien eres: reetiqueta tambien las partidas ya guardadas. */
  setMe(id) {
    this.myId = id || null;
    for (const m of this.store.matches) {
      const p = this.myId ? (m.players || []).find((x) => x.id === this.myId) : null;
      if (!p) continue;
      m.me = { ...p }; m.meAuto = false;
      if (m.winner === 0 || m.winner === 1) m.result = m.winner === p.team ? 'victoria' : 'derrota';
    }
    this._save();
    return this.myId;
  }
  clear() { this.store.matches = []; this._save(); return true; }
}

module.exports = { Stats, summary, agg, groupSessions, candidates, GAP_MIN, NO_MATCH_PLAYLISTS };
