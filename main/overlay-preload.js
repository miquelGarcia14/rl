'use strict';
/* Puente minimo para la ventana del overlay dentro de Electron.
   En OBS el overlay se abre como fichero suelto y este objeto NO existe: overlay.js
   detecta su ausencia y funciona igual, calculando el marcador de sesion por su cuenta. */
const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = new Set(['overlay:config', 'overlay:record']);

contextBridge.exposeInMainWorld('rlOverlay', {
  on: (channel, cb) => {
    if (!CHANNELS.has(channel)) return () => {};
    const handler = (_e, data) => cb(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  ready: () => ipcRenderer.invoke('overlay:ready'),
  /** El contenido se ha medido: ajusta la ventana a su tamano real. */
  fit: (w, h) => ipcRenderer.invoke('overlay:fit', Math.round(w), Math.round(h)),
  /** Tamano del overlay desde el propio modo colocacion. */
  setScale: (v) => ipcRenderer.invoke('config:set', 'overlay.scale', Number(v) || 1),
  /** Salir del modo colocacion. */
  done: () => ipcRenderer.invoke('overlay:edit', false),
});
