/* Overlay: marcador, reloj, tu boost/velocidad y eventos. Parametros por URL:
   ws (por defecto ws://127.0.0.1:49124), show=score,clock,player,feed, scale=1, bg=0|1, me=<PrimaryId> */
(function () {
  const q = new URLSearchParams(location.search);
  const show = new Set((q.get('show') || 'score,clock,player,feed').split(',').filter(Boolean));
  document.documentElement.style.setProperty('--scale', q.get('scale') || '1');
  if (q.get('bg') === '1') document.body.classList.add('bg');
  const $ = (id) => document.getElementById(id);
  if (!show.has('score')) $('score').classList.add('hidden');
  if (!show.has('clock')) $('clock').classList.add('hidden');
  if (!show.has('player')) $('player').classList.add('hidden');
  if (!show.has('feed')) $('feed').classList.add('hidden');

  const client = new RLStats({ url: q.get('ws') || 'ws://127.0.0.1:49124', myId: q.get('me') || null }).start();
  let dirty = true;
  client.on(() => { dirty = true; });

  function render() {
    if (dirty) {
      dirty = false;
      const s = client.state;
      const active = s.connected && s.inMatch && s.game;
      $('idle').classList.toggle('hidden', !!active);
      $('conn').textContent = s.connected ? (s.inMatch ? 'en partida' : 'conectado al juego · sin partida activa') : 'conectando a la Stats API del juego…';
      ['score', 'player', 'feed'].forEach((id) => { if (show.has(id)) $(id).classList.toggle('hidden', !active); });
      if (active) {
        const g = s.game;
        const tb = (g.Teams || []).find((t) => t.TeamNum === 0) || {}; const to = (g.Teams || []).find((t) => t.TeamNum === 1) || {};
        $('sb').textContent = tb.Score ?? 0; $('so').textContent = to.Score ?? 0;
        $('tb').style.background = RLStats.teamColor(g, 0); $('to').style.background = RLStats.teamColor(g, 1);
        $('tb').querySelector('.name').textContent = tb.Name || 'Azul'; $('to').querySelector('.name').textContent = to.Name || 'Naranja';
        $('clock').textContent = RLStats.fmtClock(s.clock.seconds, s.clock.overtime); $('clock').classList.toggle('ot', !!s.clock.overtime);
        const me = s.me;
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
        for (const it of s.feed.slice(0, 5)) {
          const d = document.createElement('div'); d.className = 'item ' + it.type;
          d.style.borderLeftColor = it.type === 'goal' ? '#ffd166' : it.team === 0 ? RLStats.teamColor(g, 0) : it.team === 1 ? RLStats.teamColor(g, 1) : '#888';
          const t = document.createElement('span'); t.textContent = it.text; d.appendChild(t);
          if (it.sub) { const su = document.createElement('span'); su.className = 'sub'; su.textContent = it.sub; d.appendChild(su); }
          feed.appendChild(d);
        }
      }
    }
    requestAnimationFrame(render);
  }
  render();
})();
