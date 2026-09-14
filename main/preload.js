'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args);
const ALLOWED_EVENTS = new Set(['mmr:event', 'swap:progress', 'launcher:progress', 'updater:status', 'state:changed']);

contextBridge.exposeInMainWorld('rlpanel', {
  version: () => invoke('app:version'),
  state: () => invoke('state:get'),
  launch: (mode) => invoke('launcher:launch', mode),
  detect: () => invoke('launcher:detect'),
  setRate: (rate) => invoke('statsini:set', rate),
  history: () => invoke('mmr:history'),
  rescan: () => invoke('mmr:rescan'),
  setCalib: (calib) => invoke('mmr:setCalib', calib),
  swapReapply: () => invoke('swap:reapply'),
  swapSetBaseline: () => invoke('swap:baseline'),
  overlayToggle: (opts) => invoke('overlay:toggle', opts),
  overlayPaths: () => invoke('overlay:paths'),
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
