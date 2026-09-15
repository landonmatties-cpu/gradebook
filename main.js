/*
 * main.js — Electron main process.
 *
 * Creates the application window and provides file-based persistence. Data is
 * stored as a single JSON file in the OS user-data directory, so the app is
 * fully offline and self-contained. The teacher can also export/import the
 * data file for backups or moving between computers.
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { buildWorkbook } = require('./src/xlsx');

const DATA_FILE = () => path.join(app.getPath('userData'), 'gradebook-data.json');
const ATTACH_DIR = () => path.join(app.getPath('userData'), 'attachments');

function isValidAttachId(id) { return typeof id === 'string' && /^[a-f0-9]{24}$/.test(id); }

function readData() {
  try {
    const file = DATA_FILE();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to read data file:', err);
    return null;
  }
}

function writeData(data) {
  try {
    const file = DATA_FILE();
    // Write to a temp file first, then rename, to avoid corrupting the store
    // if the app is closed mid-write.
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true };
  } catch (err) {
    console.error('Failed to write data file:', err);
    return { ok: false, error: String(err) };
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'BC Gradebook',
    backgroundColor: '#f4f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.removeMenu();
}

ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_evt, data) => writeData(data));

ipcMain.handle('data:export', async (_evt, data) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export gradebook backup',
    defaultPath: 'gradebook-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('data:exportXlsx', async (_evt, payload) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export grades to Excel',
    defaultPath: (payload && payload.defaultName) || 'grades.xlsx',
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    const buf = buildWorkbook((payload && payload.sheets) || []);
    fs.writeFileSync(filePath, buf);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('data:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import gradebook backup',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };
  try {
    const raw = fs.readFileSync(filePaths[0], 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ---- attachments (rubrics, handouts): stored as files beside the data ----
ipcMain.handle('attachment:save', (_evt, payload) => {
  try {
    const dir = ATTACH_DIR();
    fs.mkdirSync(dir, { recursive: true });
    const id = crypto.randomBytes(12).toString('hex');
    const buf = Buffer.from((payload && payload.dataBase64) || '', 'base64');
    const meta = {
      name: String((payload && payload.name) || 'file'),
      type: String((payload && payload.type) || 'application/octet-stream'),
      size: buf.length
    };
    fs.writeFileSync(path.join(dir, id), buf);
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify(meta), 'utf8');
    return Object.assign({ ok: true, id }, meta);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('attachment:open', (_evt, id) => {
  try {
    if (!isValidAttachId(id)) return { ok: false, error: 'Bad id' };
    const dir = ATTACH_DIR();
    const meta = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
    // Copy to a temp file carrying the real name so the OS opens it in the
    // right app (the stored file has no extension).
    const tmp = path.join(os.tmpdir(), 'bcgb-' + id + '-' + meta.name.replace(/[\\/:*?"<>|\r\n]/g, '_'));
    fs.copyFileSync(path.join(dir, id), tmp);
    shell.openPath(tmp);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

ipcMain.handle('attachment:delete', (_evt, id) => {
  try {
    if (!isValidAttachId(id)) return { ok: false, error: 'Bad id' };
    const dir = ATTACH_DIR();
    try { fs.unlinkSync(path.join(dir, id)); } catch (_) { /* ignore */ }
    try { fs.unlinkSync(path.join(dir, id + '.json')); } catch (_) { /* ignore */ }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
