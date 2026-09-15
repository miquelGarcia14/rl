/* Overlay: marcador, reloj, tu boost/velocidad, victorias-derrotas de la sesion y eventos.
   Parametros por URL (los usa OBS): ws, show=score,clock,player,feed,record, scale, bg=0|1,
   scope=sesion|hoy, me=<PrimaryId>.
   Dentro del panel existe window.rlOverlay: entonces el tamano, el contenido y el marcador de
   sesion llegan en vivo desde la app y la ventana se ajusta sola al contenido. */
(function () {
  const q = new URLSearchParams(location.search);
  const bridge = window.rlOverlay || null;
  const $ = (id) => document.getElementById(id);

  let show = new Set((q.get('show') || 'score,clock,player,feed,record').split(',').filter(Boolean));
  let scope = q.get('scope') === 'hoy' ? 'hoy' : 'sesion';
  let edit = false;
  // marcador que manda la app (persistente); si no hay puente, se cuenta lo visto desde que se abrio
  let record = null;
  let dirty = true;
  const localRec = { v: 0, d: 0, racha: 0 };

  const DEMO = {
    game: { Teams: [{ TeamNum: 0, Score: 2, Name: 'Azul' }, { TeamNum: 1, Score: 1, Name: 'Naranja' }] },
    clock: { seconds: 143, overtime: false },
    me: { Name: 'Ejemplo', Score: 415, Goals: 1, Assists: 1, Saves: 2, Shots: 3, Boost: 62, bBoosting: true, Speed: 74 },
    feed: [{ type: 'goal', text: 'GOL de Ejemplo', sub: '103 km/h' }, { type: 'stat', text: 'Ejemplo · Save' }],
  };

  function applyConfig(c) {
    if (!c) return;
    if (Array.isArray(c.show)) show = new Set(c.show);
    if (c.scale) { document.documentElement.style.setProperty('--scale', String(c.scale)); $('editScale').value = c.scale; $('editScaleVal').textContent = Number(c.scale).toFixed(2) + '×'; }
    document.body.classList.toggle('bg', String(c.bg) === '1' || c.bg === 1);
    if (c.scope) scope = c.scope === 'hoy' ? 'hoy' : 'sesion';
    edit = !!c.edit;
    document.body.classList.toggle('edit', edit);
    dirty = true;
  }

  // valores iniciales de la URL (unica via en OBS)
  applyConfig({ show: [...show], scale: Number(q.get('scale')) || 1, bg: q.get('bg'), scope, edit: false });

  const client = new RLStats({ url: q.get('ws') || 'ws://127.0.0.1:49124', myId: q.get('me') || null }).start();
  client.on((type, data, state) => {
    dirty = true;
    // sin puente (OBS) contamos nosotros lo que vemos desde que se abrio la pagina
    if (!bridge && type === 'MatchEnded' && state.me && (data.WinnerTeamNum === 0 || data.WinnerTeamNum === 1)) {
      const win = data.WinnerTeamNum === state.me.TeamNum;
      if (win) localRec.v++; else localRec.d++;
      localRec.racha = Math.sign(localRec.racha) === (win ? 1 : -1) ? localRec.racha + (win ? 1 : -1) : (win ? 1 : -1);
    }
  });

  if (bridge) {
    bridge.on('overlay:config', applyConfig);
    bridge.on('overlay:record', (r) => { record = r; dirty = true; });
    bridge.ready().then(applyConfig).catch(() => {});
    $('editScale').addEventListener('input', (e) => {
      const v = Number(e.target.value) || 1;
      document.documentElement.style.setProperty('--scale', String(v));
      $('editScaleVal').textContent = v.toFixed(2) + '×';
      bridge.setScale(v);
    });
    $('editDone').addEventListener('click', () => bridge.done());
  }

  function currentRecord() {
    if (record) { const a = scope === 'hoy' ? record.hoy : record.sesion; if (a) return { v: a.v, d: a.d, racha: a.racha }; }
    return localRec;
  }

  let lastW = 0, lastH = 0;
  function fit() {
    if (!bridge) return;
    const r = $('root').getBoundingClientRect();
    const w = Math.ceil(r.width), h = Math.ceil(r.height);
    if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
    lastW = w; lastH = h;
    bridge.fit(w, h);
  }

  function render() {
    if (dirty) {
      dirty = false;
      const s = client.state;
      const live = s.connected && s.inMatch && s.game;
      const demo = edit && !live;                       // en modo colocacion siempre hay algo que ver
      const active = live || demo;
      const g = demo ? DEMO.game : s.game;
      const clock = demo ? DEMO.clock : s.clock;
      const me = demo ? DEMO.me : s.me;
      const feedItems = demo ? DEMO.feed : s.feed;

      $('idle').classList.toggle('hidden', !!active);
      $('conn').textContent = s.connected ? (s.inMatch ? 'en partida' : 'conectado al juego · sin partida activa') : 'conectando a la Stats API del juego…';
      ['score', 'player', 'feed'].forEach((id) => $(id).classList.toggle('hidden', !show.has(id) || !active));
      $('clock').classList.toggle('hidden', !show.has('clock') || !active);

      // el marcador de sesion se ve tambien fuera de partida: es el resumen del dia
      const rec = currentRecord();
      const showRec = show.has('record') && (active || rec.v + rec.d > 0);
      $('rec').classList.toggle('hidden', !showRec);
      if (showRec) {
        $('recLbl').textContent = scope === 'hoy' ? 'hoy' : 'sesión';
        $('recW').textContent = rec.v; $('recL').textContent = rec.d;
        const st = $('recStreak');
        st.textContent = Math.abs(rec.racha) >= 2 ? (rec.racha > 0 ? `${rec.racha} seguidas` : `${-rec.racha} seguidas`) : '';
        st.className = 'streak ' + (rec.racha > 0 ? 'up' : rec.racha < 0 ? 'down' : '');
      }

      if (active) {
        const tb = (g.Teams || []).find((t) => t.TeamNum === 0) || {}; const to = (g.Teams || []).find((t) => t.TeamNum === 1) || {};
        $('sb').textContent = tb.Score ?? 0; $('so').textContent = to.Score ?? 0;
        $('tb').style.background = RLStats.teamColor(g, 0); $('to').style.background = RLStats.teamColor(g, 1);
        $('tb').querySelector('.name').textContent = tb.Name || 'Azul'; $('to').querySelector('.name').textContent = to.Name || 'Naranja';
        $('clock').textContent = RLStats.fmtClock(clock.seconds, clock.overtime); $('clock').classList.toggle('ot', !!clock.overtime);
        if (me) {
          $('pn').textContent = me.Name || '—';
          $('pstats').textContent = `${me.Score ?? 0} pts · ${me.Goals ?? 0}G ${me.Assists ?? 0}A ${me.Saves ?? 0}S ${me.Shots ?? 0}T`;
          const b = Math.max(0, Math.min(100, Math.round(me.Boost ?? 0)));
          $('bfill').style.width = b + '%'; $('bbar').classList.toggle('boosting', !!me.bBoosting);
          $('boost').innerHTML = b + '<small>boost</small>';
          const sp = Math.round(me.Speed ?? 0);
          $('speed').innerHTML = sp + '<small>km/h</small>'; $('speed').classList.toggle('ss', sp >= 79);
        }
        const feed = $('feed'); feed.innerHTML = '';
        for (const it of (feedItems || []).slice(0, 5)) {
          const d = document.createElement('div'); d.className = 'item ' + it.type;
          d.style.borderLeftColor = it.type === 'goal' ? '#ffd166' : it.team === 0 ? RLStats.teamColor(g, 0) : it.team === 1 ? RLStats.teamColor(g, 1) : '#888';
          const t = document.createElement('span'); t.textContent = it.text; d.appendChild(t);
          if (it.sub) { const su = document.createElement('span'); su.className = 'sub'; su.textContent = it.sub; d.appendChild(su); }
          feed.appendChild(d);
        }
      }
      fit();
    }
    requestAnimationFrame(render);
  }
  render();
})();
