/* Logica del panel. Funciona dentro de Electron (window.rlpanel) y, en modo demo, en un navegador normal. */
(function () {
  const $ = (id) => document.getElementById(id);
  const demo = !window.rlpanel;
  if (demo) {
    $('demoBanner').classList.remove('hidden');
    const demoMatches = [
      { id: '1', startedAt: '2026-09-15T17:02:00Z', endedAt: '2026-09-15T17:10:00Z', durationS: 480, playlist: 11, playlistName: 'Ranked 2v2', result: 'victoria', winner: 0, score: { 0: 4, 1: 2 }, me: { id: 'a', name: 'Tú', team: 0, Score: 520, Goals: 2, Assists: 1, Saves: 2, Shots: 4 }, players: [{ id: 'a', name: 'Tú', team: 0 }, { id: 'b', name: 'Compi', team: 0 }], mmrDelta: 9, meAuto: true },
      { id: '2', startedAt: '2026-09-15T17:12:00Z', endedAt: '2026-09-15T17:21:00Z', durationS: 540, playlist: 11, playlistName: 'Ranked 2v2', result: 'derrota', winner: 1, score: { 0: 1, 1: 3 }, me: { id: 'a', name: 'Tú', team: 0, Score: 310, Goals: 0, Assists: 1, Saves: 3, Shots: 2 }, players: [{ id: 'a', name: 'Tú', team: 0 }], mmrDelta: -8, meAuto: true },
    ];
    window.rlpanel = {
      version: async () => '0.1.4-demo',
      state: async () => ({ version: '0.1.4-demo', game: { running: false, mode: 'none', version: '260825.79374.526531' }, statsIni: { exists: true, rate: 10, port: 49123, webPort: 49124 }, swap: { available: false }, overlayOpen: false, overlayEdit: false, shortcut: { accelerator: 'Control+Alt+O', ok: true }, stats: { status: 'sin-conexion', connected: false, inMatch: false, events: 0, lastEvent: null }, epic: { version: '++Prime+Update59.1' }, additional: { commands: '-dx11', enabled: true }, config: { overlay: { scale: 1, clickthrough: true, autofit: true, recordScope: 'sesion', show: ['score', 'clock', 'player', 'feed', 'record'] }, mmr: { factor: 20, offset: 0 }, shortcuts: { toggleOverlay: 'Control+Alt+O' }, minimizeToTray: true, autostart: false, ui: { onboardingDone: false }, updates: { repo: '' } }, userData: 'C:\\Users\\…\\AppData\\Roaming\\RL Panel', logDir: 'C:\\Users\\…\\Documents\\My Games\\Rocket League\\TAGame\\Logs' }),
      history: async () => ({ colas: [{ time: '2026-09-13T17:20:49Z', playlist: 2, playlistName: 'Casual 2v2', tier: 19, tierName: 'Gran Campeon I', mmrRaw: 83.778, mmr: 1676, delta: 126 }, { time: '2026-09-13T17:35:10Z', playlist: 2, playlistName: 'Casual 2v2', tier: 19, tierName: 'Gran Campeon I', mmrRaw: 82.834, mmr: 1657, delta: -19 }], byPlaylist: { 2: [{ time: '2026-09-13T17:20:49Z', mmr: 1676 }, { time: '2026-09-13T17:35:10Z', mmr: 1657 }] }, playlists: [{ id: 2, name: 'Casual 2v2', n: 2 }], model: { a: 20, b: 0, n: 0, method: 'defecto', perPlaylist: {}, calibrated: false }, partidas: 56, fines: 95 }),
      matches: async () => ({ matches: demoMatches, summary: { hoy: { n: 2, v: 1, d: 1, otras: 0, goles: 2, asist: 2, paradas: 5, tiros: 6, puntos: 830, mmr: 1, mmrConocido: 2, racha: -1 }, sesion: { n: 2, v: 1, d: 1, otras: 0, goles: 2, asist: 2, paradas: 5, tiros: 6, puntos: 830, mmr: 1, mmrConocido: 2, racha: -1 }, total: { n: 2, v: 1, d: 1, otras: 0, goles: 2, asist: 2, paradas: 5, tiros: 6, puntos: 830, mmr: 1, mmrConocido: 2, racha: -1 }, sesionDesde: '2026-09-15T17:02:00Z', sesiones: 1, porPlaylist: [{ playlist: 11, name: 'Ranked 2v2', n: 2, v: 1, d: 1, otras: 0, goles: 2, asist: 2, paradas: 5, tiros: 6, puntos: 830, mmr: 1, mmrConocido: 2, racha: -1 }] }, candidates: [{ id: 'a', name: 'Tú', n: 2, auto: 2 }], myId: null, calibrated: false }),
      setMe: async () => window.rlpanel.matches(), clearMatches: async () => window.rlpanel.matches(),
      launch: async (m) => ({ ok: true, mode: m, message: 'demo', steps: ['demo'] }), detect: async () => ({ running: false, mode: 'none' }),
      setRate: async (r) => ({ exists: true, rate: r, port: 49123, webPort: 49124 }), rescan: async () => ({ added: 0, history: await window.rlpanel.history() }),
      setCalib: async () => window.rlpanel.history(), addPoint: async () => ({ history: await window.rlpanel.history() }), clearPoints: async () => window.rlpanel.history(),
      swapReapply: async () => ({ code: 0, output: 'demo' }), swapSetBaseline: async () => ({}),
      colorEstado: async () => ({ disponible: true, parametros: {}, paleta: [
        { obj: 'Black_00', label: 'Black', hex: '#414141', valor: '0.05,0.05,0.05,1' },
        { obj: 'Purple_00', label: 'Purple', hex: '#8800BA', valor: '0.25,0,0.5,1' },
        { obj: 'Blue_00', label: 'Sky Blue', hex: '#2BBAE6', valor: '0.02,0.5,0.8,1' },
        { obj: 'White_00', label: 'Titanium White', hex: '#E6E6E6', valor: '0.8,0.8,0.8,1' }], recetas: [
        { i: 0, nombre: 'Fennec: molduras (item pintado)', pkg: 'body_grain_SF.upk', nota: 'No depende de la calcomanía: es el propio cuerpo.', colores: { TrimColor: '0.02,0.5,0.8,1' }, instalada: true, hayBackup: true },
        { i: 1, nombre: 'Fennec negro (Bluster Bar)', pkg: 'skin_grain_lines_SF.upk', nota: null, colores: { ForcedTeamColors: '0.05,0.05,0.05,1', ForcedCustomColor: '0.05,0.05,0.05,1' }, instalada: true, hayBackup: true },
        { i: 2, nombre: 'Fennec morado (Flames)', pkg: 'skin_grain_flames_SF.upk', nota: null, colores: { ForcedTeamColors: '0.25,0,0.5,1', ForcedCustomColor: '0.25,0,0.5,1' }, instalada: false, hayBackup: true },
        { i: 3, nombre: 'Octane negro TOTAL con molduras (Tech)', pkg: 'Skin_Octane_Tech_SF.upk', nota: 'En Octane las molduras solo llegan desde la calcomanía.', colores: { ForcedTeamColors: '0.05,0.05,0.05,1', ForcedCustomColor: '0.05,0.05,0.05,1', TrimColor: '0.05,0.05,0.05,1' }, instalada: true, hayBackup: true }] }),
      colorSet: async () => window.rlpanel.colorEstado(), colorAplicar: async () => ({ code: 0, output: 'demo' }),
      colorRestaurar: async () => ({ hechos: [], fallos: [] }),
      overlayToggle: async () => ({ open: true }), overlayEdit: async () => ({ open: true, edit: true }),
      overlayPaths: async () => ({ file: 'C:\\…\\renderer\\overlay.html', url: 'file:///C:/…/overlay.html?ws=ws://127.0.0.1:49124' }),
      setShortcut: async (a) => ({ accelerator: a, ok: true }),
      config: async () => null, setConfig: async () => null, copy: async () => true, openPath: async () => '', openExternal: async () => true, checkUpdates: async () => ({ status: 'disabled' }), on: () => () => {},
    };
  }
  const api = window.rlpanel;

  // pestañas
  const goTab = (name) => {
    document.querySelectorAll('nav button[data-tab]').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
    document.querySelectorAll('main section').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  };
  document.querySelectorAll('nav button[data-tab]').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.tab)));
  document.querySelectorAll('button[data-goto]').forEach((b) => b.addEventListener('click', () => goTab(b.dataset.goto)));

  const pill = (text, cls) => `<span class="pill ${cls || ''}">${text}</span>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDate = (iso) => { if (!iso) return '?'; const d = new Date(iso); return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); };
  const fmtHora = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—');
  const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`;
  const signo = (n) => (n > 0 ? '+' : '') + n;

  let state = null, history = null, matches = null;

  // ---------------------------------------------------------------- estado

  async function refreshState() {
    try { state = await api.state(); } catch (e) { return; }
    const g = state.game || {};
    $('gameRun').innerHTML = g.running ? pill('abierto', 'ok') : pill('cerrado', '');
    $('gameMode').innerHTML = !g.running ? '—' : g.mode === 'eac' ? pill('con EAC (online)', 'ok') : g.mode === 'noeac' ? pill('sin EAC (offline)', 'warn') : pill('leyendo…', '');
    $('gameVer').textContent = g.version || '—';
    $('epicVer').textContent = state.epic ? state.epic.version : 'no encontrado';
    const ini = state.statsIni || {};
    $('apiRate').innerHTML = !ini.exists ? pill('sin ini (arranca el juego una vez)', 'warn') : ini.rate > 0 ? pill(ini.rate + ' Hz', 'ok') : pill('apagada (0)', 'bad');
    $('apiPorts').textContent = `TCP ${ini.port || 49123} · WebSocket ${ini.webPort || 49124}`;
    renderLive(state.stats);
    const add = state.additional; $('addCmds').innerHTML = add && add.exists ? `<code>${esc(add.commands) || '(vacío)'}</code> ${add.enabled ? '' : '(desactivados)'}` : 'no encontrados';

    const c = state.config || {}; const ov = c.overlay || {};
    $('chkClick').checked = !!ov.clickthrough;
    $('ovScale').value = ov.scale || 1; $('ovScaleVal').textContent = Number(ov.scale || 1).toFixed(2) + '×';
    const show = ov.show || [];
    $('showScore').checked = show.includes('score'); $('showPlayer').checked = show.includes('player');
    $('showFeed').checked = show.includes('feed'); $('showRecord').checked = show.includes('record');
    $('ovScope').value = ov.recordScope || 'sesion';
    $('btnOverlay').textContent = state.overlayOpen ? 'Ocultar overlay' : 'Mostrar overlay';
    $('btnPlace').disabled = !!state.overlayEdit;
    $('btnPlace').textContent = state.overlayEdit ? 'Colocando…' : 'Colocar en pantalla';

    const sc = state.shortcut || {};
    $('setShortcut').value = sc.accelerator || '';
    $('shortcutState').innerHTML = !sc.accelerator ? 'Sin atajo.' : sc.ok ? pill('activo', 'ok') : pill('no se pudo registrar: ' + esc(sc.error || 'ocupado'), 'bad');
    $('ovShortcutHint').textContent = sc.accelerator && sc.ok ? `atajo: ${sc.accelerator}` : '';

    $('setTray').checked = !!c.minimizeToTray; $('setAutostart').checked = !!c.autostart; $('setRepo').value = (c.updates && c.updates.repo) || '';
    $('setVer').textContent = state.version; $('ver').textContent = 'v' + state.version; $('pathData').textContent = state.userData || ''; $('pathLogs').textContent = state.logDir || '';
    renderSwap(state.swap);
    renderSetup();
    const p = await api.overlayPaths(); $('obsPath').textContent = p.file; $('obsPath').dataset.url = p.url;
  }

  function renderLive(s) {
    if (!s) return;
    $('apiConn').innerHTML = s.connected ? (s.inMatch ? pill('en partida', 'ok') : pill('conectado · sin partida', 'ok')) : pill('sin conexión (¿juego cerrado o tasa 0?)', 'warn');
    $('apiLast').textContent = s.lastEvent ? `${s.lastEvent} · ${s.events} eventos` : '—';
  }

  /** Tarjeta de primeros pasos: se esconde sola cuando los tres pasos están hechos. */
  function renderSetup() {
    const c = (state && state.config) || {};
    const done1 = !!(state.statsIni && state.statsIni.rate > 0);
    const done2 = !!(history && history.model && history.model.calibrated);
    const done3 = !!(c.ui && c.ui.overlayPlaced);
    const dismissed = !!(c.ui && c.ui.onboardingDone);
    const all = done1 && done2 && done3;
    $('cardSetup').classList.toggle('hidden', dismissed || all);
    [[1, done1], [2, done2], [3, done3]].forEach(([i, ok]) => {
      const el = $('step' + i); el.classList.toggle('done', ok);
      el.querySelector('.mark').textContent = ok ? '✓' : String(i);
    });
    $('setupNote').textContent = all ? 'Todo listo.' : '';
  }

  function renderSwap(s) {
    const has = s && s.available;
    $('navPersonal').classList.toggle('hidden', !has); $('cardSwapMini').classList.toggle('hidden', !has);
    if (!has) return;
    const st = s.installed ? pill('Alpha Boost activo', 'ok') : s.isOriginal ? pill('repuesto por el launcher: reaplicar', 'warn') : pill('fichero desconocido', 'bad');
    $('swapMini').innerHTML = st; $('swapState').innerHTML = st;
    $('swapFile').textContent = s.target ? `${s.target.size} B · ${fmtDate(s.target.mtime)}` : (s.error || '—');
    $('swapOrig').textContent = s.original ? `${s.original.size} B (backup)` : '—';
    if (s.baseBin) {
      $('baseBin').innerHTML = `${s.baseBin.size} B · ${fmtDate(s.baseBin.mtime)} ` + (s.baseBin.changed ? pill('¡ha cambiado!', 'bad') : s.baseBin.baselineSize ? pill('igual', 'ok') : '');
      $('baseRef').textContent = s.baseBin.baselineSize ? s.baseBin.baselineSize + ' B' : 'sin fijar';
    }
  }

  // ---------------------------------------------------------------- MMR

  async function refreshHistory(h) {
    history = h || await api.history();
    const cal = !!(history.model && history.model.calibrated);
    $('mmrCount').textContent = history.colas.length + ` (${history.partidas} partidas)`;
    const last = history.colas[history.colas.length - 1];
    $('mmrLast').innerHTML = last ? `${esc(last.playlistName)} · ${cal ? '' : '≈'}${last.mmr} · ${fmtDate(last.time)}` : '—';
    $('mmrCalState').innerHTML = cal ? pill(`${history.model.n} punto${history.model.n > 1 ? 's' : ''}`, 'ok') : pill('sin calibrar: estimación', 'warn');
    $('calibAviso').classList.toggle('hidden', cal);
    const sel = $('mmrPlaylist'); const cur = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + history.playlists.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.n})</option>`).join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
    const m = history.model;
    if (m) {
      const per = Object.entries(m.perPlaylist || {}).filter(([, v]) => Math.abs(v) >= 1).map(([pl, v]) => `${(history.playlists.find((p) => String(p.id) === pl) || { name: 'Playlist ' + pl }).name} ${v > 0 ? '+' : ''}${Math.round(v)}`).join(', ');
      $('calModel').textContent = !cal ? 'Sin calibrar: se usa la conversión por defecto (valor × 20) y casi seguro está mal. Dale al menos un punto real, mejor uno por playlist.'
        : `Conversión ajustada con ${m.n} punto${m.n > 1 ? 's' : ''} (${m.method}): MMR ≈ ${m.a.toFixed(2)} × valor + ${Math.round(m.b)}` + (per ? ` · corrección por playlist: ${per}` : '') + '. Cada punto nuevo afina el ajuste.';
    }
    renderTable(); renderChart();
    if (state) renderSetup();
  }
  function selected() { const v = $('mmrPlaylist').value; return history.colas.filter((c) => !v || String(c.playlist) === v); }
  function renderTable() {
    const cal = !!(history.model && history.model.calibrated);
    const rows = selected().slice().reverse().slice(0, 200);
    $('mmrRows').innerHTML = rows.map((c) => `<tr><td>${fmtDate(c.time)}</td><td>${esc(c.playlistName)}</td><td>${esc(c.tierName)}</td><td class="num">${c.mmrRaw.toFixed(3)}</td><td class="num">${cal ? `<b>${c.mmr}</b>` : `<span class="approx">≈</span><b>${c.mmr}</b>`}</td><td class="num ${c.delta > 0 ? 'pos' : c.delta < 0 ? 'neg' : ''}">${c.delta == null ? '' : signo(c.delta)}</td></tr>`).join('') || '<tr><td colspan="6" class="note">Sin colas registradas todavía. Juega una partida online y vuelve.</td></tr>';
  }
  function renderChart() {
    const svg = $('chart'); const pts = selected();
    if (pts.length < 2) { svg.innerHTML = '<text x="20" y="95" fill="#9aa4b8" font-size="13">Hacen falta al menos dos colas de la misma playlist para dibujar.</text>'; return; }
    const W = 800, H = 180, P = 28; const xs = pts.map((_, i) => P + (i * (W - 2 * P)) / (pts.length - 1));
    const vals = pts.map((p) => p.mmr); const lo = Math.min(...vals), hi = Math.max(...vals); const span = Math.max(10, hi - lo);
    const y = (v) => H - P - ((v - lo) / span) * (H - 2 * P);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + xs[i].toFixed(1) + ',' + y(p.mmr).toFixed(1)).join(' ');
    svg.innerHTML = `<path d="${d}" fill="none" stroke="#2f7cff" stroke-width="2.5"/>` + pts.map((p, i) => `<circle cx="${xs[i]}" cy="${y(p.mmr)}" r="3.5" fill="${p.delta > 0 ? '#3ddc84' : p.delta < 0 ? '#ff5c6c' : '#9aa4b8'}"><title>${fmtDate(p.time)} · ${p.mmr}</title></circle>`).join('')
      + `<text x="${P}" y="14" fill="#9aa4b8" font-size="11">máx ${hi}</text><text x="${P}" y="${H - 6}" fill="#9aa4b8" font-size="11">mín ${lo}</text>`;
  }

  // ---------------------------------------------------------------- partidas

  function aggLine(a, cal) {
    if (!a || !a.n) return 'Sin partidas.';
    const parts = [`${a.n} partida${a.n > 1 ? 's' : ''}`];
    if (a.otras) parts.push(`${a.otras} sin resultado`);
    if (Math.abs(a.racha) >= 2) parts.push(a.racha > 0 ? `${a.racha} victorias seguidas` : `${-a.racha} derrotas seguidas`);
    parts.push(`${a.goles}G ${a.asist}A ${a.paradas}S ${a.tiros}T`);
    if (a.mmrConocido) parts.push(`${cal ? '' : '≈'}${signo(a.mmr)} MMR en ${a.mmrConocido}`);
    return parts.join(' · ');
  }

  async function refreshMatches(m) {
    matches = m || await api.matches();
    const s = matches.summary, cal = matches.calibrated;
    const set = (k, a) => { $(k + 'W').textContent = a.v; $(k + 'L').textContent = a.d; };
    set('hoy', s.hoy); set('ses', s.sesion); set('tot', s.total);
    $('hoySub').textContent = aggLine(s.hoy, cal);
    $('sesSub').textContent = s.sesion.n ? `desde las ${fmtHora(s.sesionDesde)} · ` + aggLine(s.sesion, cal) : 'Ninguna partida en la última hora y media.';
    $('totSub').textContent = aggLine(s.total, cal) + (s.sesiones ? ` · ${s.sesiones} sesiones` : '');
    $('stHoy').innerHTML = `<b>${s.hoy.v}</b>-<b>${s.hoy.d}</b>`;
    $('stSesion').innerHTML = s.sesion.n ? `<b>${s.sesion.v}</b>-<b>${s.sesion.d}</b> (desde ${fmtHora(s.sesionDesde)})` : '—';
    $('stTotal').textContent = s.total.n;

    const iniOff = !(state && state.statsIni && state.statsIni.rate > 0);
    $('partidasAviso').classList.toggle('hidden', !iniOff && s.total.n > 0);
    $('partidasAviso').innerHTML = iniOff
      ? 'La <b>Stats API</b> está apagada: sin ella el juego no cuenta nada y no se puede registrar ninguna partida. Actívala en <b>Estado</b> y reinicia Rocket League.'
      : 'Todavía no hay partidas guardadas. Se registran solas mientras el panel esté abierto (vale con que esté en la bandeja) y juegues con la Stats API activa.';

    $('porPlaylist').innerHTML = s.porPlaylist.length
      ? '<table><thead><tr><th>Playlist</th><th class="num">V</th><th class="num">D</th><th class="num">%</th><th class="num">G/A/S/T</th><th class="num">MMR</th></tr></thead><tbody>' + s.porPlaylist.map((p) => {
        const tot = p.v + p.d;
        return `<tr><td>${esc(p.name)}</td><td class="num tagw">${p.v}</td><td class="num tagl">${p.d}</td><td class="num">${tot ? Math.round((p.v / tot) * 100) + '%' : '—'}</td><td class="num">${p.goles}/${p.asist}/${p.paradas}/${p.tiros}</td><td class="num ${p.mmr > 0 ? 'pos' : p.mmr < 0 ? 'neg' : ''}">${p.mmrConocido ? signo(p.mmr) : '—'}</td></tr>`;
      }).join('') + '</tbody></table>'
      : '<span class="note">Sin partidas todavía.</span>';

    const sel = $('partPlaylist'); const cur = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + s.porPlaylist.filter((p) => p.playlist != null).map((p) => `<option value="${p.playlist}">${esc(p.name)} (${p.n})</option>`).join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;

    const msel = $('meSel'); const auto = matches.matches.filter((x) => x.me && x.meAuto).length;
    msel.innerHTML = '<option value="">Detectar automáticamente</option>' + matches.candidates.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    msel.value = matches.myId || '';
    $('meNote').textContent = matches.myId ? 'Fijado por ti: las partidas guardadas se han recalculado con este jugador.'
      : `Se detecta solo (la cámara del juego te sigue a ti); ahora mismo así en ${auto} partida${auto === 1 ? '' : 's'}. Si alguna sale con el resultado cambiado, elígete aquí.`;

    renderMatchRows();
  }

  function renderMatchRows() {
    const v = $('partPlaylist').value;
    const cal = matches.calibrated;
    const rows = matches.matches.filter((m) => !v || String(m.playlist) === v).slice().reverse().slice(0, 300);
    $('partRows').innerHTML = rows.map((m) => {
      const me = m.me || {};
      const mine = me.team === 1 ? m.score[1] : m.score[0];
      const their = me.team === 1 ? m.score[0] : m.score[1];
      const res = m.result === 'victoria' ? '<span class="tagw">Victoria</span>' : m.result === 'derrota' ? '<span class="tagl">Derrota</span>'
        : `<span class="tagx">${m.result === 'incompleta' ? 'sin final' : 'sin resultado'}</span>`;
      const mmr = Number.isFinite(m.mmrDelta) ? `<span class="${m.mmrDelta > 0 ? 'pos' : m.mmrDelta < 0 ? 'neg' : ''}">${cal ? '' : '≈'}${signo(m.mmrDelta)}</span>` : '—';
      return `<tr><td>${fmtDate(m.endedAt)}</td><td>${esc(m.playlistName || '—')}</td><td>${res}</td><td class="num">${mine}-${their}</td>`
        + `<td class="num">${me.Goals || 0}G ${me.Assists || 0}A ${me.Saves || 0}S ${me.Shots || 0}T</td><td class="num">${mmr}</td><td class="num">${fmtDur(m.durationS)}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="note">Sin partidas registradas todavía.</td></tr>';
  }

  // ---------------------------------------------------------------- acciones

  document.querySelectorAll('button[data-rate]').forEach((b) => b.addEventListener('click', async () => { await api.setRate(Number(b.dataset.rate)); refreshState(); }));
  $('btnOverlay').addEventListener('click', async () => { await api.overlayToggle(); refreshState(); });
  $('btnPlace').addEventListener('click', async () => { await api.overlayEdit(true); api.setConfig('ui.overlayPlaced', true); refreshState(); });
  $('btnSetupDone').addEventListener('click', async () => { await api.setConfig('ui.onboardingDone', true); refreshState(); });
  $('chkClick').addEventListener('change', (e) => api.setConfig('overlay.clickthrough', e.target.checked));
  $('ovScale').addEventListener('input', (e) => { const v = Number(e.target.value) || 1; $('ovScaleVal').textContent = v.toFixed(2) + '×'; api.setConfig('overlay.scale', v); });
  $('ovScope').addEventListener('change', (e) => api.setConfig('overlay.recordScope', e.target.value));
  const saveShow = () => api.setConfig('overlay.show', ['clock',
    ...($('showScore').checked ? ['score'] : []), ...($('showPlayer').checked ? ['player'] : []),
    ...($('showFeed').checked ? ['feed'] : []), ...($('showRecord').checked ? ['record'] : [])]);
  ['showScore', 'showPlayer', 'showFeed', 'showRecord'].forEach((id) => $(id).addEventListener('change', saveShow));
  $('btnCopyPath').addEventListener('click', () => api.copy($('obsPath').textContent));
  $('btnCopyUrl').addEventListener('click', () => api.copy($('obsPath').dataset.url || ''));
  $('btnOpenFolder').addEventListener('click', () => api.openPath($('obsPath').textContent.replace(/[\\/][^\\/]+$/, '')));

  const launch = async (mode) => {
    $('btnEac').disabled = $('btnNoEac').disabled = true; $('launchLog').textContent = ''; $('launchState').innerHTML = pill('arrancando…', 'warn');
    const r = await api.launch(mode);
    $('launchState').innerHTML = r.ok ? pill(r.message, 'ok') : pill(r.message, 'bad');
    $('btnEac').disabled = $('btnNoEac').disabled = false; refreshState();
  };
  $('btnEac').addEventListener('click', () => launch('eac')); $('btnNoEac').addEventListener('click', () => launch('noeac'));
  api.on('launcher:progress', (p) => { if (p.step && p.step !== 'waiting' && p.step !== 'done') $('launchLog').textContent += p.step + '\n'; if (p.step === 'waiting') $('launchState').innerHTML = pill(`esperando al juego… ${p.elapsed}s`, 'warn'); });

  $('mmrPlaylist').addEventListener('change', () => { renderTable(); renderChart(); });
  $('btnCalib').addEventListener('click', async () => {
    const pl = $('mmrPlaylist').value; const real = Number($('calReal').value);
    if (!pl) { $('calModel').textContent = 'Elige primero una playlist concreta en el desplegable.'; return; }
    if (!real) { $('calModel').textContent = 'Escribe tu MMR real actual de esa playlist.'; return; }
    const r = await api.addPoint(Number(pl), real);
    if (r.error) $('calModel').textContent = r.error; else { $('calReal').value = ''; await refreshHistory(r.history); refreshMatches(); }
  });
  $('btnClearCal').addEventListener('click', async () => { await refreshHistory(await api.clearPoints()); refreshMatches(); });
  $('btnRescan').addEventListener('click', async () => { const r = await api.rescan(); await refreshHistory(r.history); refreshMatches(); });

  $('partPlaylist').addEventListener('change', renderMatchRows);
  $('meSel').addEventListener('change', async (e) => refreshMatches(await api.setMe(e.target.value || null)));
  $('btnClearMatches').addEventListener('click', async () => {
    if (!window.confirm('¿Borrar todas las partidas guardadas? El historial de MMR no se toca.')) return;
    refreshMatches(await api.clearMatches());
  });

  // atajo de teclado: se captura tecleándolo
  function accelFrom(e) {
    if (['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(e.key)) return null;
    const mods = [];
    if (e.ctrlKey) mods.push('Control');
    if (e.altKey) mods.push('Alt');
    if (e.shiftKey) mods.push('Shift');
    if (e.metaKey) mods.push('Super');
    const map = { ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Escape: 'Esc', Enter: 'Return' };
    const isF = /^F\d{1,2}$/.test(e.key);
    const key = map[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    if (!mods.length && !isF) return null; // sin modificador robaríamos una tecla suelta a todo Windows
    return [...mods, key].join('+');
  }
  $('setShortcut').addEventListener('keydown', async (e) => {
    e.preventDefault();
    const acc = accelFrom(e);
    if (!acc) { $('shortcutState').textContent = 'Usa al menos Ctrl, Alt o Shift (o una tecla F).'; return; }
    const r = await api.setShortcut(acc);
    state = null; await refreshState();
    if (!r.ok) $('shortcutState').innerHTML = pill('no se pudo registrar: ' + esc(r.error || 'ocupado'), 'bad');
  });
  $('btnShortcutClear').addEventListener('click', async () => { await api.setShortcut(''); refreshState(); });

  $('btnReapply').addEventListener('click', async () => { $('swapLog').textContent = ''; $('btnReapply').disabled = true; const r = await api.swapReapply(); $('swapLog').textContent += (r.output || '') + `\n[exit ${r.code}]`; $('btnReapply').disabled = false; refreshState(); });
  api.on('swap:progress', (line) => { $('swapLog').textContent += line; $('swapLog').scrollTop = 1e9; });
  $('btnBaseline').addEventListener('click', async () => renderSwap(await api.swapSetBaseline()));

  // --- colores del coche ---
  let colorState = null;
  const PARAM_ORDEN = ['ForcedTeamColors', 'ForcedCustomColor', 'TrimColor'];

  function selectorColor(r, parametro) {
    const actual = r.colores[parametro];
    const soportado = colorState.recetas[r.i].colores[parametro] !== undefined || parametro !== 'TrimColor' || r.pkg === 'body_grain_SF.upk';
    if (!soportado && actual === undefined) return '<span class="note">—</span>';
    const enPaleta = colorState.paleta.find((c) => c.valor === actual);
    const opciones = ['<option value="">(sin fijar)</option>'].concat(colorState.paleta.map((c) =>
      `<option value="${c.valor}"${c.valor === actual ? ' selected' : ''}>${esc(c.label)}</option>`));
    // un color que no esté en la paleta (editado a mano) debe verse igualmente, no como "sin fijar"
    if (actual && !enPaleta) opciones.push(`<option value="${esc(actual)}" selected>Personalizado (${esc(actual)})</option>`);
    const swatch = actual ? (enPaleta || {}).hex : null;
    return `<span class="row" style="gap:6px;flex-wrap:nowrap">${swatch ? `<i style="width:14px;height:14px;border-radius:3px;border:1px solid var(--line);background:${swatch};display:inline-block"></i>` : ''}`
      + `<select data-receta="${r.i}" data-param="${parametro}" style="width:140px">${opciones.join('')}</select></span>`;
  }

  function renderColores(s) {
    colorState = s;
    $('cardColores').classList.toggle('hidden', !s.disponible);
    if (!s.disponible) return;
    // el boton se resalta solo cuando de verdad hay algo que aplicar
    const hayPendientes = (s.pendientes || 0) > 0;
    $('btnColorAplicar').classList.toggle('primary', hayPendientes);
    $('btnColorAplicar').textContent = hayPendientes ? `Aplicar al juego (${s.pendientes} pendiente${s.pendientes > 1 ? 's' : ''})` : 'Aplicar al juego';
    if (!$('colorEstado').textContent || /pendiente|al día/i.test($('colorEstado').textContent))
      $('colorEstado').textContent = hayPendientes ? 'Hay cambios sin aplicar.' : 'Todo al día.';
    $('colorFilas').innerHTML = s.recetas.map((r) => {
      const estado = r.instalada ? pill('puesta', 'ok')
        : !r.hayBackup ? pill('sin copia del original', 'bad')
        : `${pill('pendiente de aplicar', 'warn')}<small class="note" style="display:block">${esc(r.motivo || '')}</small>`;
      const nota = r.nota ? `<small class="note" style="display:block">${esc(r.nota)}</small>` : '';
      return `<tr><td>${esc(r.nombre)}${nota}</td>`
        + PARAM_ORDEN.map((p) => `<td>${selectorColor(r, p)}</td>`).join('')
        + `<td>${estado}</td></tr>`;
    }).join('');
    $('colorFilas').querySelectorAll('select[data-receta]').forEach((sel) => sel.addEventListener('change', async (e) => {
      const r = await api.colorSet(Number(e.target.dataset.receta), e.target.dataset.param, e.target.value || null);
      if (r.error) { $('colorEstado').textContent = r.error; return; }
      $('colorEstado').textContent = 'Guardado. Pulsa «Aplicar al juego» para que se vea.';
      renderColores(r);
    }));
  }

  $('btnColorAplicar').addEventListener('click', async () => {
    $('btnColorAplicar').disabled = $('btnColorRestaurar').disabled = true;
    $('colorLog').classList.remove('hidden'); $('colorLog').textContent = '';
    $('colorEstado').textContent = 'generando y verificando…';
    const r = await api.colorAplicar();
    $('colorEstado').textContent = r.code === 0 ? 'Listo: abre Rocket League y míralo.' : (r.output || '').slice(-200);
    if (r.estado) renderColores(r.estado);
    $('btnColorAplicar').disabled = $('btnColorRestaurar').disabled = false;
  });
  $('btnColorRestaurar').addEventListener('click', async () => {
    if (!window.confirm('¿Devolver los ficheros del juego a sus originales? Se puede volver a aplicar cuando quieras.')) return;
    const r = await api.colorRestaurar();
    $('colorEstado').textContent = r.error ? r.error : `Restaurados ${r.hechos.length}` + (r.fallos.length ? ` · fallos: ${r.fallos.join(', ')}` : '');
    if (r.estado) renderColores(r.estado);
  });
  api.on('color:progress', (linea) => { const el = $('colorLog'); el.classList.remove('hidden'); el.textContent += linea; el.scrollTop = 1e9; });
  $('setTray').addEventListener('change', (e) => api.setConfig('minimizeToTray', e.target.checked));
  $('setAutostart').addEventListener('change', (e) => api.setConfig('autostart', e.target.checked));
  $('btnSaveRepo').addEventListener('click', () => api.setConfig('updates.repo', $('setRepo').value.trim()));
  $('btnCheckUpd').addEventListener('click', async () => { const r = await api.checkUpdates(); $('updStatus').textContent = r.message || r.status; });
  api.on('updater:status', (u) => { $('updStatus').textContent = u.status === 'available' ? `Hay versión ${u.version}, descargando…` : u.status === 'downloaded' ? `Versión ${u.version} lista: se instala al cerrar` : u.status === 'none' ? 'Estás al día' : u.message || u.status; });
  api.on('state:changed', refreshState);
  api.on('stats:live', renderLive);
  api.on('matches:changed', () => refreshMatches());
  api.on('mmr:event', () => refreshHistory());

  refreshState().then(() => refreshHistory()).then(() => refreshMatches()).then(async () => renderColores(await api.colorEstado()));
  setInterval(refreshState, 15000);
})();
