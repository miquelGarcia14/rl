'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);
const ALLOWED_EVENTS = new Set(['mmr:event', 'swap:progress', 'launcher:progress', 'updater:status', 'state:changed', 'stats:live', 'matches:changed', 'color:progress']);

contextBridge.exposeInMainWorld('rlpanel', {
  version: () => invoke('app:version'),
  state: () => invoke('state:get'),
  launch: (mode) => invoke('launcher:launch', mode),
  detect: () => invoke('launcher:detect'),
  setRate: (rate) => invoke('statsini:set', rate),
  history: () => invoke('mmr:history'),
  rescan: () => invoke('mmr:rescan'),
  setCalib: (calib) => invoke('mmr:setCalib', calib),
  addPoint: (playlist, real) => invoke('mmr:addPoint', playlist, real),
  clearPoints: () => invoke('mmr:clearPoints'),
  matches: () => invoke('matches:get'),
  setMe: (id) => invoke('matches:setMe', id),
  clearMatches: () => invoke('matches:clear'),
  swapReapply: () => invoke('swap:reapply'),
  swapSetBaseline: () => invoke('swap:baseline'),
  colorEstado: () => invoke('color:estado'),
  colorSet: (i, parametro, valor) => invoke('color:set', i, parametro, valor),
  colorAplicar: () => invoke('color:aplicar'),
  colorRestaurar: () => invoke('color:restaurar'),
  overlayToggle: (force) => invoke('overlay:toggle', force),
  overlayEdit: (on) => invoke('overlay:edit', on),
  overlayPaths: () => invoke('overlay:paths'),
  setShortcut: (acc) => invoke('shortcuts:set', acc),
  config: (key) => invoke('config:get', key),
  setConfig: (key, value) => invoke('config:set', key, value),
  copy: (text) => invoke('clipboard:write', text),
  openPath: (p) => invoke('shell:openPath', p),
  openExternal: (url) => invoke('shell:openExternal', url),
  checkUpdates: () => invoke('updater:check'),
  on: (channel, cb) => {
    if (!ALLOWED_EVENTS.has(channel)) return () => {};
    const handler = (_e, data) => cb(data);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
