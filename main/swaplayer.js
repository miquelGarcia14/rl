'use strict';
// Capa PERSONAL (solo se muestra si existen las herramientas locales): estado del swap cosmetico
// (.upk) y del catalogo de integridad de EAC. No toca el proceso del juego; solo lee ficheros y,
// si el usuario lo pide, ejecuta su propio script reaplicar_alpha_boost.py (que exige RL cerrado).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const RL_DIR = 'C:\\Program Files\\Epic Games\\rocketleague';
const TARGET = 'Boost_Bubble_SF.upk';

function sha256(file) {
  const h = crypto.createHash('sha256'); h.update(fs.readFileSync(file)); return h.digest('hex');
}

function available(cfg) {
  try {
    return fs.existsSync(path.join(cfg.tools, 'reaplicar_alpha_boost.py')) && fs.existsSync(path.join(cfg.backup, 'alpha_boost_swap.sha256'));
  } catch (e) { return false; }
}

function status(cfg, rlDir = RL_DIR) {
  const out = { available: available(cfg), tools: cfg.tools, backup: cfg.backup };
  if (!out.available) return out;
  try {
    const target = path.join(rlDir, 'TAGame', 'CookedPCConsole', TARGET);
    const st = fs.statSync(target);
    out.target = { file: target, size: st.size, mtime: st.mtime.toISOString() };
    const registered = fs.readFileSync(path.join(cfg.backup, 'alpha_boost_swap.sha256'), 'utf8').trim();
    out.installed = sha256(target) === registered;
    try {
      const orig = path.join(cfg.backup, TARGET); const so = fs.statSync(orig);
      out.original = { size: so.size, mtime: so.mtime.toISOString() };
      out.isOriginal = so.size === st.size && sha256(orig) === sha256(target);
    } catch (e) { out.isOriginal = null; }
  } catch (e) { out.error = 'No encuentro el fichero del juego: ' + e.message; }
  try {
    const bin = path.join(rlDir, 'Binaries', 'Win64', 'EasyAntiCheat', 'Certificates', 'base.bin');
    const sb = fs.statSync(bin);
    out.baseBin = { size: sb.size, mtime: sb.mtime.toISOString(), baselineSize: cfg.baseBinSize, changed: cfg.baseBinSize != null && cfg.baseBinSize !== sb.size };
  } catch (e) { out.baseBin = null; }
  return out;
}

/** Ejecuta reaplicar_alpha_boost.py y va emitiendo lineas por onLine. Resuelve {code, output}. */
function reapply(cfg, onLine) {
  return new Promise((resolve) => {
    const script = path.join(cfg.tools, 'reaplicar_alpha_boost.py');
    const lines = [];
    let p;
    try {
      p = spawn('python', [script], { cwd: cfg.tools, windowsHide: true });
    } catch (e) { return resolve({ code: -1, output: 'No pude ejecutar python: ' + e.message }); }
    const push = (d) => { const s = d.toString('utf8'); lines.push(s); if (onLine) onLine(s); };
    p.stdout.on('data', push); p.stderr.on('data', push);
    p.on('error', (e) => { push('error: ' + e.message); resolve({ code: -1, output: lines.join('') }); });
    p.on('close', (code) => resolve({ code, output: lines.join('') }));
  });
}

module.exports = { status, reapply, available, RL_DIR, TARGET };
