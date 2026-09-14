// Siembra puntos de calibracion de MMR en el config.json del panel (ejecutar con la app CERRADA).
// uso: node dev/seed_points.js <config.json> '[{"playlist":11,"raw":69.15,"real":1495}, ...]'
'use strict';
const fs = require('fs');
const [file, json] = process.argv.slice(2);
if (!file || !json) { console.error('uso: node dev/seed_points.js <config.json> <json de puntos>'); process.exit(2); }
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* nuevo */ }
cfg.mmr = cfg.mmr || {};
const cur = Array.isArray(cfg.mmr.points) ? cfg.mmr.points : [];
let added = 0;
for (const p of JSON.parse(json)) {
  if (cur.some((q) => q.playlist === p.playlist && q.real === p.real)) continue;
  cur.push({ playlist: p.playlist, raw: p.raw, real: p.real, time: p.time || null, at: new Date().toISOString(), source: 'seed' }); added++;
}
cfg.mmr.points = cur;
fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
console.log(`puntos anadidos: ${added}; total: ${cur.length} -> ${file}`);
