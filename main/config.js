'use strict';
// Configuracion persistente del panel (JSON en la carpeta de datos del usuario).
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULTS = {
  minimizeToTray: true,
  autostart: false,
  overlay: {
    show: ['score', 'clock', 'player', 'feed'],
    scale: 1,
    bg: 0,
    clickthrough: true,
    bounds: { x: 40, y: 40, width: 560, height: 240 },
  },
  mmr: { factor: 20, offset: 0, points: [] },
  statsApi: { wsUrl: 'ws://127.0.0.1:49124', preferredRate: 10 },
  swap: {
    tools: path.join(os.homedir(), 'Documents', 'RLUPKTools_v33'),
    backup: path.join(os.homedir(), 'Documents', 'RL_UPK_Backup'),
    baseBinSize: null,
    baseBinMtime: null,
  },
  updates: { enabled: true, repo: 'miquelGarcia14/rl' },
};

function deepMerge(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const k of Object.keys(extra || {})) out[k] = deepMerge(base[k], extra[k]);
  return out;
}

class Config {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'config.json');
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch (e) { /* primera ejecucion */ }
    this.data = deepMerge(DEFAULTS, saved);
  }
  get(key) {
    if (!key) return this.data;
    return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), this.data);
  }
  set(key, value) {
    const parts = key.split('.');
    let o = this.data;
    for (const k of parts.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
    o[parts[parts.length - 1]] = value;
    this.save();
    return value;
  }
  save() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) { /* no bloquear la app por un fallo de escritura */ }
  }
}

module.exports = { Config, DEFAULTS };
