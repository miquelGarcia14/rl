/* Cliente de la Stats API oficial de Rocket League para navegador (OBS, Electron, Chrome).
   Se conecta al WebSocket que abre el propio juego (ws://127.0.0.1:49124), reconecta con backoff
   y mantiene un estado agregado. Sobre: {"Event": nombre, "Data": "<JSON como string>"}. */
(function () {
  class RLStats {
    constructor(opts = {}) {
      this.url = opts.url || 'ws://127.0.0.1:49124';
      this.myId = opts.myId || null;
      this.listeners = new Set();
      this.state = this._blank();
      this.delay = 500; this.ws = null; this.stopped = false; this.status = 'idle';
    }
    _blank() {
      return { connected: false, inMatch: false, game: null, players: [], me: null, clock: { seconds: 0, overtime: false }, feed: [], lastEvent: null, lastAt: 0, events: 0 };
    }
    on(cb) { this.listeners.add(cb); return () => this.listeners.delete(cb); }
    emit(type, data) { for (const cb of this.listeners) { try { cb(type, data, this.state); } catch (e) { console.error(e); } } }
    start() { this.stopped = false; this._connect(); return this; }
    stop() { this.stopped = true; if (this.ws) { try { this.ws.close(); } catch (e) { /* */ } } }
    _connect() {
      if (this.stopped) return;
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { return this._retry(); }
      this.ws = ws; this.status = 'connecting'; this.emit('status');
      ws.onopen = () => { this.delay = 500; this.state.connected = true; this.status = 'connected'; this.emit('status'); };
      ws.onmessage = (m) => this._onMessage(m.data);
      ws.onclose = () => { this.state.connected = false; this.state.inMatch = false; this.status = 'disconnected'; this.emit('status'); this._retry(); };
      ws.onerror = () => { try { ws.close(); } catch (e) { /* */ } };
    }
    _retry() {
      if (this.stopped) return;
      const wait = this.delay + Math.random() * 250;
      this.delay = Math.min(this.delay * 2, 15000);
      setTimeout(() => this._connect(), wait);
    }
    _onMessage(raw) {
      let env; try { env = JSON.parse(raw); } catch (e) { return; }
      let data = env.Data;
      if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* dejar string */ } }
      this._apply(env.Event, data || {});
    }
    _apply(ev, d) {
      const s = this.state; s.lastEvent = ev; s.lastAt = Date.now(); s.events++;
      switch (ev) {
        case 'MatchCreated': case 'MatchInitialized':
          s.inMatch = true; s.feed = []; s.game = null; s.players = []; s.me = null; s.clock = { seconds: 0, overtime: false }; break;
        case 'UpdateState':
          s.inMatch = true; if (d.Game) s.game = d.Game; s.players = d.Players || [];
          s.me = this._pickMe(d);
          if (d.Game) { if (typeof d.Game.TimeSeconds === 'number') s.clock.seconds = d.Game.TimeSeconds; s.clock.overtime = !!d.Game.bOvertime; }
          break;
        case 'ClockUpdatedSeconds': s.clock = { seconds: d.TimeSeconds || 0, overtime: !!d.bOvertime }; break;
        case 'GoalScored': this._feed({ type: 'goal', text: 'GOL' + (d.Scorer && d.Scorer.Name ? ' de ' + d.Scorer.Name : ''), sub: d.GoalSpeed ? Math.round(d.GoalSpeed) + ' km/h' : '', team: d.Scorer ? d.Scorer.TeamNum : undefined }); break;
        case 'StatfeedEvent': this._feed({ type: 'stat', text: (d.MainTarget && d.MainTarget.Name ? d.MainTarget.Name + ' · ' : '') + (d.EventName || d.Type || ''), team: d.MainTarget ? d.MainTarget.TeamNum : undefined }); break;
        case 'MatchEnded': s.inMatch = false; this._feed({ type: 'end', text: 'Final · gana ' + (d.WinnerTeamNum === 0 ? 'Azul' : d.WinnerTeamNum === 1 ? 'Naranja' : '?') }); break;
        case 'MatchDestroyed': s.inMatch = false; break;
        default: break;
      }
      this.emit(ev, d);
    }
    _pickMe(d) {
      const pl = d.Players || [];
      if (this.myId) { const m = pl.find((p) => p.PrimaryId === this.myId); if (m) return m; }
      const t = d.Game && d.Game.Target;
      if (t) { const m = pl.find((p) => p.Name === t.Name && p.TeamNum === t.TeamNum); if (m) return m; }
      return pl[0] || null;
    }
    _feed(item) { item.at = Date.now(); this.state.feed.unshift(item); this.state.feed = this.state.feed.slice(0, 8); }
  }
  RLStats.fmtClock = function (seconds, overtime) {
    const s = Math.max(0, Math.round(seconds || 0));
    return (overtime ? '+' : '') + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };
  RLStats.teamColor = function (game, teamNum, fallback) {
    const t = game && game.Teams && game.Teams.find((x) => x.TeamNum === teamNum);
    const c = t && t.ColorPrimary && /^[0-9a-f]{6}$/i.test(t.ColorPrimary) ? '#' + t.ColorPrimary : null;
    // Psyonix devuelve gris 959595 en Freeplay: usar colores de equipo clasicos como respaldo
    if (!c || /^#9[0-9a-f]{5}$/i.test(c)) return fallback || (teamNum === 0 ? '#2f7cff' : '#ff8a1f');
    return c;
  };
  window.RLStats = RLStats;
})();
