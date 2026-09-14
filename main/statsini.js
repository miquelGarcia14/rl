'use strict';
// Lee/escribe TAStatsAPI.ini (Stats API oficial de Psyonix). Solo un fichero de configuracion.
const fs = require('fs');
const path = require('path');
const os = require('os');

const INI = path.join(os.homedir(), 'Documents', 'My Games', 'Rocket League', 'TAGame', 'Config', 'TAStatsAPI.ini');

function read(file = INI) {
  const out = { file, exists: false, rate: 0, port: 49123, webPort: 49124 };
  try {
    const txt = fs.readFileSync(file, 'utf8');
    out.exists = true;
    const m = (re) => { const r = txt.match(re); return r ? r[1] : null; };
    out.rate = Number(m(/^PacketSendRate=([\d.]+)/m) ?? 0);
    out.port = Number(m(/^Port=(\d+)/m) ?? 49123);
    out.webPort = Number(m(/^WebPort=(\d+)/m) ?? 49124);
  } catch (e) { /* no existe: el juego lo crea al arrancar */ }
  return out;
}

function setRate(rate, file = INI) {
  rate = Math.max(0, Math.min(120, Math.round(Number(rate) || 0)));
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { /* crear */ }
  const eol = txt.includes('\r\n') ? '\r\n' : '\r\n';
  if (/^PacketSendRate=/m.test(txt)) {
    txt = txt.replace(/^PacketSendRate=.*$/m, `PacketSendRate=${rate}`);
  } else if (/^\[TAGame\.MatchStatsExporter_TA\]/m.test(txt)) {
    txt = txt.replace(/^\[TAGame\.MatchStatsExporter_TA\][^\n]*\n?/m, (s) => s + `PacketSendRate=${rate}${eol}`);
  } else {
    txt = `[TAGame.MatchStatsExporter_TA]${eol}Port=49123${eol}WebPort=49124${eol}PacketSendRate=${rate}${eol}${eol}` + txt;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, txt, 'utf8');
  return read(file);
}

module.exports = { read, setRate, INI };
