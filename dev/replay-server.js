// Servidor de repeticion para desarrollo: re-emite una captura real (capture_*.jsonl de stats_probe.py)
// por WebSocket como si fuera el juego, respetando los tiempos originales. Uso:
//   node dev/replay-server.js [captura.jsonl] [puerto=49124] [velocidad=1]
'use strict';
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const file = process.argv[2] || latestCapture();
const port = Number(process.argv[3] || 49124);
const speed = Number(process.argv[4] || 1);

function latestCapture() {
  const dir = path.join(__dirname, '..', '..', 'dev');
  const files = fs.readdirSync(dir).filter((f) => /^capture_.*\.jsonl$/.test(f)).map((f) => path.join(dir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!files.length) throw new Error('No hay capturas en ' + dir);
  return files[0];
}

const frames = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => r.kind === 'ws_text').map((r) => ({ t: new Date(r.t).getTime(), data: r.data }));
if (!frames.length) throw new Error('La captura no tiene frames ws_text');
const t0 = frames[0].t;
console.log(`replay: ${path.basename(file)} · ${frames.length} frames · ${((frames[frames.length - 1].t - t0) / 1000).toFixed(1)} s · ws://127.0.0.1:${port} · x${speed}`);

const wss = new WebSocket.Server({ port, host: '127.0.0.1' });
wss.on('connection', (ws) => {
  console.log('cliente conectado');
  let i = 0; let start = Date.now(); let loop = 0;
  const tick = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const now = (Date.now() - start) * speed;
    while (i < frames.length && frames[i].t - t0 <= now) { ws.send(frames[i].data); i++; }
    if (i >= frames.length) { i = 0; start = Date.now(); loop++; console.log('bucle', loop); }
    setTimeout(tick, 20);
  };
  tick();
  ws.on('close', () => console.log('cliente desconectado'));
});
