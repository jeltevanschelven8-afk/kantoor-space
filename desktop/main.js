/* =========================================================
   Kantoor Space — desktopprogramma voor Linux (Electron), gemaakt door JJ van Schelven.
   Hetzelfde bestand voor Inkt, Cel en Doek; welke app het is staat in app.json (geschreven door build.js).
   Start de ingebouwde deelserver (server.js) en toont de app in een eigen venster, zonder adresbalk.
   ========================================================= */
'use strict';

const { app, BrowserWindow, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const cfg = require('./app.json');            // { name: 'Inkt', id: 'inkt', port: 8080 }
const WEB = path.join(__dirname, 'web');      // de app zelf (index.html, js, css …)

app.setName(cfg.name);
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win = null;
let origin = null;

/* ---------- vensterpositie onthouden ---------- */
const boundsFile = () => path.join(app.getPath('userData'), 'venster.json');
const loadBounds = () => { try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')); } catch { return null; } };
const saveBounds = () => {
  if (!win || win.isDestroyed()) return;
  try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch { /* niet erg */ }
};

/* ---------- ingebouwde server (voor Delen via een koppeling) ---------- */
const startServer = () => new Promise((resolve) => {
  process.env.KANTOOR_EMBEDDED = '1';
  process.env.PORT = String(cfg.port);
  process.env.KANTOOR_SHARE_DIR = path.join(app.getPath('userData'), 'gedeeld');
  process.once('kantoor-server', (port) => resolve(port));
  require(path.join(WEB, 'server.js'));
});

/* ---------- koppelingen buiten de app openen in de gewone browser ---------- */
const isOwn = (url) => origin && (url === origin || url.startsWith(origin + '/'));
const openOutside = (url) => { if (/^(https?:|mailto:|tel:)/i.test(url)) shell.openExternal(url); };

const createWindow = (url) => {
  const b = loadBounds() || { width: 1280, height: 820 };
  const w = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height, minWidth: 640, minHeight: 420,
    title: cfg.name,
    icon: nativeImage.createFromPath(path.join(WEB, 'icons', 'icon-512.png')),
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  if (b.max) w.maximize();
  w.once('ready-to-show', () => w.show());
  w.webContents.setWindowOpenHandler(({ url: u }) => {
    if (isOwn(u)) { createWindow(u); return { action: 'deny' }; }   // bijv. Beeld › Nieuw venster
    openOutside(u);
    return { action: 'deny' };
  });
  w.webContents.on('will-navigate', (e, u) => { if (!isOwn(u)) { e.preventDefault(); openOutside(u); } });
  w.loadURL(url);
  return w;
};

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const port = await startServer();
  origin = `http://localhost:${port}`;
  win = createWindow(origin + '/index.html');
  win.on('close', saveBounds);
});
