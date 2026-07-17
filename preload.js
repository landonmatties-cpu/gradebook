/*
 * preload.js — safe bridge between the renderer and the main process.
 * Only these narrow data functions are exposed to the UI.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  exportData: (data) => ipcRenderer.invoke('data:export', data),
  exportXlsx: (payload) => ipcRenderer.invoke('data:exportXlsx', payload),
  importData: () => ipcRenderer.invoke('data:import')
});
