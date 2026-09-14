/* Logica del panel. Funciona dentro de Electron (window.rlpanel) y, en modo demo, en un navegador normal. */
(function () {
  const $ = (id) => document.getElementById(id);
  const demo = !window.rlpanel;
  if (demo) {
    $('demoBanner').classList.remove('hidden');
    window.rlpanel = {
      version: async () => '0.1.0-demo',
      state: async () => ({ version: '0.1.0-demo', game: { running: false, mode: 'none', version: '260825.79374.526531' }, statsIni: { exists: true, rate: 10, port: 49123, webPort: 49124 }, swap: { available: false }, overlayOpen: false, epic: { version: '++Prime+Update59.1' }, additional: { commands: '-dx11', enabled: true }, config: { overlay: { scale: 1, clickthrough: true, show: ['score', 'clock', 'player', 'feed'] }, mmr: { factor: 20, offset: 0 }, minimizeToTray: true, autostart: false, updates: { repo: '' } }, userData: 'C:\\Users\\…\\AppData\\Roaming\\rl-panel', logDir: 'C:\\Users\\…\\Documents\\My Games\\Rocket League\\TAGame\\Logs' }),
      history: async () => ({ colas: [{ time: '2026-09-13T17:20:49Z', playlist: 2, playlistName: 'Casual 2v2', tier: 19, tierName: 'Gran Campeon I', mmrRaw: 83.778, mmr: 1676, delta: 126 }, { time: '2026-09-13T17:35:10Z', playlist: 2, playlistName: 'Casual 2v2', tier: 19, tierName: 'Gran Campeon I', mmrRaw: 82.834, mmr: 1657, delta: -19 }], byPlaylist: { 2: [{ time: '2026-09-13T17:20:49Z', mmr: 1676 }, { time: '2026-09-13T17:35:10Z', mmr: 1657 }] }, playlists: [{ id: 2, name: 'Casual 2v2', n: 2 }], partidas: 56, fines: 95 }),
      launch: async (m) => ({ ok: true, mode: m, message: 'demo', steps: ['demo'] }), detect: async () => ({ running: false, mode: 'none' }),
      setRate: async (r) => ({ exists: true, rate: r, port: 49123, webPort: 49124 }), rescan: async () => ({ added: 0, history: await window.rlpanel.history() }),
      setCalib: async () => window.rlpanel.history(), swapReapply: async () => ({ code: 0, output: 'demo' }), swapSetBaseline: async () => ({}),
      overlayToggle: async () => ({ open: true }), overlayPaths: async () => ({ file: 'C:\\…\\renderer\\overlay.html', url: 'file:///C:/…/overlay.html?ws=ws://127.0.0.1:49124' }),
      config: async () => null, setConfig: async () => null, copy: async () => true, openPath: async () => '', openExternal: async () => true, checkUpdates: async () => ({ status: 'disabled' }), on: () => () => {},
    };
  }
  const api = window.rlpanel;

  // pestañas
  document.querySelectorAll('nav button[data-tab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('nav button[data-tab]').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll('main section').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + b.dataset.tab));
  }));

  const pill = (text, cls) => `<span class="pill ${cls || ''}">${text}</span>`;
  const fmtDate = (iso) => { if (!iso) return '?'; const d = new Date(iso); return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); };

  let state = null, history = null, wsUrl = 'ws://127.0.0.1:49124';

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
    wsUrl = (state.config && state.config.statsApi && state.config.statsApi.wsUrl) || wsUrl;
    const add = state.additional; $('addCmds').innerHTML = add && add.exists ? `<code>${add.commands || '(vacío)'}</code> ${add.enabled ? '' : '(desactivados)'}` : 'no encontrados';
    const c = state.config || {};
    $('chkClick').checked = !!(c.overlay && c.overlay.clickthrough); $('ovScale').value = (c.overlay && c.overlay.scale) || 1;
    const show = (c.overlay && c.overlay.show) || []; $('showScore').checked = show.includes('score'); $('showPlayer').checked = show.includes('player'); $('showFeed').checked = show.includes('feed');
    $('calFactor').value = (c.mmr && c.mmr.factor) ?? 20; $('calOffset').value = (c.mmr && c.mmr.offset) ?? 0;
    $('setTray').checked = !!c.minimizeToTray; $('setAutostart').checked = !!c.autostart; $('setRepo').value = (c.updates && c.updates.repo) || '';
    $('setVer').textContent = state.version; $('ver').textContent = 'v' + state.version; $('pathData').textContent = state.userData || ''; $('pathLogs').textContent = state.logDir || '';
    renderSwap(state.swap);
    const p = await api.overlayPaths(); $('obsPath').textContent = p.file; $('obsPath').dataset.url = p.url;
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

  async function refreshHistory(h) {
    history = h || await api.history();
    $('mmrCount').textContent = history.colas.length + ` (${history.partidas} partidas)`;
    const last = history.colas[history.colas.length - 1];
    $('mmrLast').textContent = last ? `${last.playlistName} · ${last.mmr} · ${fmtDate(last.time)}` : '—';
    const sel = $('mmrPlaylist'); const cur = sel.value; sel.innerHTML = '<option value="">Todas</option>' + history.playlists.map((p) => `<option value="${p.id}">${p.name} (${p.n})</option>`).join('');
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
    renderTable(); renderChart();
  }
  function selected() { const v = $('mmrPlaylist').value; return history.colas.filter((c) => !v || String(c.playlist) === v); }
  function renderTable() {
    const rows = selected().slice().reverse().slice(0, 200);
    $('mmrRows').innerHTML = rows.map((c) => `<tr><td>${fmtDate(c.time)}</td><td>${c.playlistName}</td><td>${c.tierName}</td><td class="num">${c.mmrRaw.toFixed(3)}</td><td class="num"><b>${c.mmr}</b></td><td class="num ${c.delta > 0 ? 'pos' : c.delta < 0 ? 'neg' : ''}">${c.delta == null ? '' : (c.delta > 0 ? '+' : '') + c.delta}</td></tr>`).join('') || '<tr><td colspan="6" class="note">Sin colas registradas todavía. Juega una partida online y vuelve.</td></tr>';
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

  // Stats API en vivo (el panel es un navegador más)
  let client = null;
  function startClient() {
    if (client) client.stop();
    client = new RLStats({ url: wsUrl }).start();
    client.on(() => {
      const s = client.state;
      $('apiConn').innerHTML = s.connected ? (s.inMatch ? pill('en partida', 'ok') : pill('conectado · sin partida', 'ok')) : pill('sin conexión (¿juego cerrado o tasa 0?)', 'warn');
      $('apiLast').textContent = s.lastEvent ? `${s.lastEvent} · ${s.events} eventos` : '—';
    });
  }

  // acciones
  document.querySelectorAll('button[data-rate]').forEach((b) => b.addEventListener('click', async () => { await api.setRate(Number(b.dataset.rate)); refreshState(); }));
  $('btnOverlay').addEventListener('click', () => api.overlayToggle({}));
  $('chkClick').addEventListener('change', (e) => api.setConfig('overlay.clickthrough', e.target.checked));
  $('ovScale').addEventListener('change', (e) => api.setConfig('overlay.scale', Number(e.target.value) || 1));
  const saveShow = () => api.setConfig('overlay.show', ['clock', ...($('showScore').checked ? ['score'] : []), ...($('showPlayer').checked ? ['player'] : []), ...($('showFeed').checked ? ['feed'] : [])]).then(refreshState);
  ['showScore', 'showPlayer', 'showFeed'].forEach((id) => $(id).addEventListener('change', saveShow));
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
  $('btnCalib').addEventListener('click', async () => refreshHistory(await api.setCalib({ factor: $('calFactor').value, offset: $('calOffset').value })));
  $('btnRescan').addEventListener('click', async () => { const r = await api.rescan(); refreshHistory(r.history); });
  api.on('mmr:event', () => refreshHistory());
  $('btnReapply').addEventListener('click', async () => { $('swapLog').textContent = ''; $('btnReapply').disabled = true; const r = await api.swapReapply(); $('swapLog').textContent += (r.output || '') + `\n[exit ${r.code}]`; $('btnReapply').disabled = false; refreshState(); });
  api.on('swap:progress', (line) => { $('swapLog').textContent += line; $('swapLog').scrollTop = 1e9; });
  $('btnBaseline').addEventListener('click', async () => renderSwap(await api.swapSetBaseline()));
  $('setTray').addEventListener('change', (e) => api.setConfig('minimizeToTray', e.target.checked));
  $('setAutostart').addEventListener('change', (e) => api.setConfig('autostart', e.target.checked));
  $('btnSaveRepo').addEventListener('click', () => api.setConfig('updates.repo', $('setRepo').value.trim()));
  $('btnCheckUpd').addEventListener('click', async () => { const r = await api.checkUpdates(); $('updStatus').textContent = r.message || r.status; });
  api.on('updater:status', (u) => { $('updStatus').textContent = u.status === 'available' ? `Hay versión ${u.version}, descargando…` : u.status === 'downloaded' ? `Versión ${u.version} lista: se instala al cerrar` : u.status === 'none' ? 'Estás al día' : u.message || u.status; });
  api.on('state:changed', refreshState);

  refreshState().then(() => { startClient(); refreshHistory(); });
  setInterval(refreshState, 15000);
})();
