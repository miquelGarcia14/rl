// Importa al store del panel las colas de un CSV generado por dev/mmr_history.py (semana previa a la app).
// uso: node dev/import_csv.js <mmr_history.csv> <mmr_history.json del panel>
'use strict';
const fs = require('fs');
const { PLAYLISTS, TIERS } = require('../main/logwatch');

const [csvFile, storeFile] = process.argv.slice(2);
if (!csvFile || !storeFile) { console.error('uso: node dev/import_csv.js <csv> <store.json>'); process.exit(2); }
const nameToPl = Object.fromEntries(Object.entries(PLAYLISTS).map(([id, n]) => [n, +id]));
const tierIdx = Object.fromEntries(TIERS.map((n, i) => [n, i]));
let store = { events: {} };
try { store = JSON.parse(fs.readFileSync(storeFile, 'utf8')); } catch (e) { /* nuevo */ }
const existing = Object.values(store.events).filter((e) => e.kind === 'cola');
const lines = fs.readFileSync(csvFile, 'utf8').split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(',');
const col = (row, name) => row[header.indexOf(name)];
let added = 0, skipped = 0;
for (const line of lines) {
  const row = line.split(',');
  const time = new Date(col(row, 'time')); // ISO local sin zona -> hora local
  if (isNaN(time)) { skipped++; continue; }
  const playlist = nameToPl[col(row, 'playlist')]; const tier = tierIdx[col(row, 'tier')];
  const mmrRaw = parseFloat(col(row, 'mmr_raw'));
  if (playlist === undefined || isNaN(mmrRaw)) { skipped++; continue; }
  const dup = existing.some((e) => e.playlist === playlist && Math.abs(new Date(e.time).getTime() - time.getTime()) < 5000);
  if (dup) { skipped++; continue; }
  const ev = { kind: 'cola', elapsed: 0, playlist, mmrRaw, tier: tier ?? 0, time: time.toISOString(), session: 'import-csv', key: `csv|${time.toISOString()}|cola` };
  store.events[ev.key] = ev; added++;
}
fs.writeFileSync(storeFile, JSON.stringify(store));
console.log(`importadas ${added} colas, omitidas ${skipped} (duplicadas o invalidas). Total en store: ${Object.keys(store.events).length}`);
