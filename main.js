/*
 * main.js — Electron main process.
 *
 * Creates the application window and provides file-based persistence. Data is
 * stored as a single JSON file in the OS user-data directory, so the app is
 * fully offline and self-contained. The teacher can also export/import the
 * data file for backups or moving between computers.
 */
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = () => path.join(app.getPath('userData'), 'gradebook-data.json');

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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
