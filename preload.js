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
  importData: () => ipcRenderer.invoke('data:import'),
  attachmentSave: (file) => new Promise((resolve) => {
    // Mirror the browser shim's signature: accept a File, send base64.
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      const b64 = comma >= 0 ? result.slice(comma + 1) : '';
      resolve(ipcRenderer.invoke('attachment:save', { name: file.name, type: file.type, dataBase64: b64 }));
    };
    reader.onerror = () => resolve({ ok: false, error: 'Could not read the file.' });
    reader.readAsDataURL(file);
  }),
  attachmentOpen: (id) => ipcRenderer.invoke('attachment:open', id),
  attachmentDelete: (id) => ipcRenderer.invoke('attachment:delete', id),
  attachmentRead: (id) => ipcRenderer.invoke('attachment:read', id),
  attachmentImport: (id, name, type, dataBase64) => ipcRenderer.invoke('attachment:import', { id, name, type, dataBase64 })
});
