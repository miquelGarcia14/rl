'use strict';
/* Capa PERSONAL: colores del coche.

   El panel no reimplementa nada: lee y escribe `recetas.json` (la configuracion) y lanza
   `reaplicar_todo.py`, que es el motor ya verificado. Una sola fuente de verdad, de modo que
   cambiar un color desde aqui y ejecutar el script a mano dan exactamente el mismo resultado.

   Que significa cada parametro de color (comprobado en el juego):
     ForcedTeamColors   el CUERPO. Es lo que normalmente seria azul/naranja segun tu equipo.
     ForcedCustomColor  el ACCESORIO (alerones, detalles).
     TrimColor          las MOLDURAS: paragolpes, pasos de rueda, faldones. Es el "item pintado".
*/
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PARAMETROS = {
  ForcedTeamColors: { etiqueta: 'Cuerpo', ayuda: 'lo que normalmente sería el color de equipo' },
  ForcedCustomColor: { etiqueta: 'Accesorio', ayuda: 'alerones y detalles' },
  TrimColor: { etiqueta: 'Molduras', ayuda: 'paragolpes, pasos de rueda, faldones' },
};

const leerJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

/** ¿Está el conjunto de herramientas completo? Sin esto la pestaña no se muestra. */
function disponible(cfg) {
  try {
    return ['reaplicar_todo.py', 'pintar_mic.py', 'recetas.json', 'paints.json', 'keys.txt']
      .every((f) => fs.existsSync(path.join(cfg.tools, f)));
  } catch (e) { return false; }
}

/** Paleta oficial del juego, extraída de TAGame.upk. */
function paleta(cfg) {
  try {
    const p = leerJson(path.join(cfg.tools, 'paints.json'));
    return p
      .filter((x) => !/Glow|Default__/.test(x.obj))
      .map((x) => ({ obj: x.obj, label: x.label, hex: x.hex, valor: x.base.map((v) => +v.toFixed(4)).join(',') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  } catch (e) { return []; }
}

function rutaRecetas(cfg) { return path.join(cfg.tools, 'recetas.json'); }

/** Estado de cada receta: sus colores y si el fichero instalado es el que generamos. */
function estado(cfg, rlDir = 'C:\\Program Files\\Epic Games\\rocketleague\\TAGame\\CookedPCConsole') {
  const out = { disponible: disponible(cfg), paleta: paleta(cfg), parametros: PARAMETROS, recetas: [] };
  if (!out.disponible) return out;
  let doc, registro = {};
  try { doc = leerJson(rutaRecetas(cfg)); } catch (e) { out.error = 'recetas.json ilegible: ' + e.message; return out; }
  try { registro = leerJson(path.join(cfg.backup, 'instalado.json')); } catch (e) { /* aún no hay nada instalado */ }

  const crypto = require('crypto');
  const sha = (f) => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch (e) { return null; } };

  out.recetas = (doc.recetas || []).map((r, i) => {
    const enJuego = sha(path.join(rlDir, r.pkg));
    const hayBackup = fs.existsSync(path.join(cfg.backup, r.pkg));
    return {
      i,
      nombre: r.nombre || r.pkg,
      pkg: r.pkg,
      target: r.target || null,
      donor: r.donor || null,
      nota: r.nota || null,
      colores: r.colores || {},
      instalada: !!(registro[r.pkg] && registro[r.pkg] === enJuego),
      hayBackup,
    };
  });
  return out;
}

/** Cambia un color de una receta y lo guarda en disco. No toca el juego. */
function setColor(cfg, indice, parametro, valor) {
  if (!PARAMETROS[parametro]) throw new Error('parámetro de color desconocido: ' + parametro);
  if (valor !== null && !/^(-?\d+(\.\d+)?,){3}-?\d+(\.\d+)?$/.test(String(valor))) throw new Error('color inválido: ' + valor);
  const f = rutaRecetas(cfg);
  const doc = leerJson(f);
  const r = (doc.recetas || [])[indice];
  if (!r) throw new Error('receta ' + indice + ' inexistente');
  r.colores = r.colores || {};
  if (valor === null) delete r.colores[parametro];
  else r.colores[parametro] = valor;
  fs.writeFileSync(f, JSON.stringify(doc, null, 2), 'utf8');
  return r.colores;
}

/** Ejecuta reaplicar_todo.py. `instalar` exige Rocket League cerrado. */
function ejecutar(cfg, { instalar = false, solo = 'decals' } = {}, onLine) {
  return new Promise((resolve) => {
    const args = [path.join(cfg.tools, 'reaplicar_todo.py')];
    if (instalar) args.push('--instalar');
    if (solo) args.push('--solo', solo);
    let p;
    try {
      p = spawn('python', args, { cwd: cfg.tools, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    } catch (e) {
      return resolve({ code: -1, output: 'No pude ejecutar python: ' + e.message });
    }
    const lineas = [];
    const push = (d) => { const s = d.toString('utf8'); lineas.push(s); if (onLine) onLine(s); };
    p.stdout.on('data', push);
    p.stderr.on('data', push);
    p.on('error', (e) => { push('error: ' + e.message); resolve({ code: -1, output: lineas.join('') }); });
    p.on('close', (code) => resolve({ code, output: lineas.join('') }));
  });
}

/** Devuelve el juego a los ficheros originales guardados como copia de seguridad. */
function restaurar(cfg, rlDir = 'C:\\Program Files\\Epic Games\\rocketleague\\TAGame\\CookedPCConsole') {
  const doc = leerJson(rutaRecetas(cfg));
  const hechos = [], fallos = [];
  for (const r of doc.recetas || []) {
    const origen = path.join(cfg.backup, r.pkg);
    if (!fs.existsSync(origen)) { fallos.push(`${r.pkg}: no hay copia del original`); continue; }
    try { fs.copyFileSync(origen, path.join(rlDir, r.pkg)); hechos.push(r.pkg); }
    catch (e) { fallos.push(`${r.pkg}: ${e.message}`); }
  }
  return { hechos, fallos };
}

module.exports = { disponible, paleta, estado, setColor, ejecutar, restaurar, PARAMETROS };
