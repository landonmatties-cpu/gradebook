/*
 * server.js — browser mode (no Electron).
 *
 * Serves the exact same UI from src/ over a tiny local web server and stores
 * data in the same OS user-data folder the Electron app uses. Because it runs
 * under Node (which is Apple-notarized and trusted), it sidesteps the macOS
 * Gatekeeper warning that blocks the unsigned Electron binary. Nothing here
 * touches the network beyond localhost.
 *
 *   npm run web   ->   opens http://localhost:4173 in the default browser
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { buildWorkbook } = require('./src/xlsx');

// ---- data location (mirrors Electron's app.getPath('userData')) ----
function userDataDir() {
  const appName = 'BC Gradebook';
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  if (process.platform === 'win32') {
    const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(roaming, appName);
  }
  const config = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(config, appName);
}

const DATA_DIR = userDataDir();
const DATA_FILE = path.join(DATA_DIR, 'gradebook-data.json');

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) { /* ignore */ }
}

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to read data file:', err);
    return null;
  }
}

function writeData(data) {
  try {
    ensureDataDir();
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DATA_FILE);
    return { ok: true };
  } catch (err) {
    console.error('Failed to write data file:', err);
    return { ok: false, error: String(err) };
  }
}

// ---- static file serving (from src/) ----
const SRC_DIR = path.join(__dirname, 'src');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  // Keep the request inside src/ — no path traversal.
  const filePath = path.normalize(path.join(SRC_DIR, rel));
  if (!filePath.startsWith(SRC_DIR)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(filePath, function (err, buf) {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let body = '';
    req.on('data', function (c) {
      body += c;
      if (body.length > 100 * 1024 * 1024) { reject(new Error('Body too large')); req.destroy(); }
    });
    req.on('end', function () { resolve(body); });
    req.on('error', reject);
  });
}

function sendJson(res, obj, status) {
  res.writeHead(status || 200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async function (req, res) {
  try {
    const urlPath = req.url.split('?')[0];

    if (req.method === 'GET' && urlPath === '/api/load') {
      return sendJson(res, readData());
    }

    if (req.method === 'POST' && urlPath === '/api/save') {
      const body = await readBody(req);
      const data = body ? JSON.parse(body) : null;
      return sendJson(res, writeData(data));
    }

    if (req.method === 'POST' && urlPath === '/api/export-xlsx') {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      const buf = buildWorkbook((payload && payload.sheets) || []);
      const name = (payload && payload.defaultName) || 'grades.xlsx';
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="' + name.replace(/"/g, '') + '"'
      });
      return res.end(buf);
    }

    if (req.method === 'GET') {
      return serveStatic(res, urlPath);
    }

    res.writeHead(405).end('Method not allowed');
  } catch (err) {
    console.error(err);
    sendJson(res, { ok: false, error: String(err) }, 500);
  }
});

// ---- start, trying a few ports, then open the browser ----
function openBrowser(url) {
  try {
    if (process.platform === 'darwin') execFile('open', [url]);
    else if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url]);
    else execFile('xdg-open', [url]);
  } catch (_) { /* user can open it manually */ }
}

function listen(ports, i) {
  const port = ports[i];
  server.once('error', function (err) {
    if (err && err.code === 'EADDRINUSE' && i + 1 < ports.length) {
      listen(ports, i + 1);
    } else {
      console.error('Could not start the server:', err);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', function () {
    const url = 'http://localhost:' + port;
    ensureDataDir();
    console.log('\nBC Gradebook is running.');
    console.log('  Open this in your browser if it did not open automatically:');
    console.log('  ' + url + '\n');
    console.log('Your grades are saved in:\n  ' + DATA_DIR + '\n');
    console.log('Keep this window open while you use the gradebook. Close it to quit.\n');
    openBrowser(url);
  });
}

listen([4173, 4174, 4175, 4176, 4177], 0);
