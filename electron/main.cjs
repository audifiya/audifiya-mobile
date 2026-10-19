'use strict';

const { app, BrowserWindow, ipcMain, net, protocol, screen, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// AUDIFIYA_PROD=1 lets you test the production build with `electron .` (no installer).
const IS_DEV = !app.isPackaged && process.env.AUDIFIYA_PROD !== '1';
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173';
const OPEN_DEVTOOLS = process.env.AUDIFIYA_DEVTOOLS === '1';

const APP_SCHEME = 'app';
const APP_URL = `${APP_SCHEME}://audifiya/`;
// Web build copied here by scripts/prepare-electron-web.mjs
const WEB_ROOT = path.join(__dirname, '..', 'app-web');
const INDEX_CANDIDATES = ['index.html', '_shell.html'];

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const MIN_WIDTH = 900;
const MIN_HEIGHT = 600;

const NOTCH_WIDTH = 400;
const NOTCH_HEIGHT = 65;
const NOTCH_TOP_OFFSET = 15;

const SPOOF_ORIGIN = 'https://www.jiosaavn.com';
const SPOOF_REFERER = 'https://www.jiosaavn.com/';
const SPOOF_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Must run before app is ready. A "standard" + "secure" scheme gives the page a
// real origin, so routing, localStorage, IndexedDB and fetch behave like a website.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
/** @type {BrowserWindow | null} */
let mainWindow = null;
let isNotchMode = false;
/** @type {Electron.Rectangle | null} */
let savedBounds = null;
let savedWasMaximized = false;

// ---------------------------------------------------------------------------
// Single instance lock
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

// ---------------------------------------------------------------------------
// app:// protocol (serves the production web build with SPA fallback)
// ---------------------------------------------------------------------------
function findIndexFile() {
  for (const name of INDEX_CANDIDATES) {
    if (fs.existsSync(path.join(WEB_ROOT, name))) return path.join(WEB_ROOT, name);
  }
  return null;
}

function registerAppProtocol() {
  const indexFile = findIndexFile();

  protocol.handle(APP_SCHEME, (request) => {
    if (!indexFile) {
      return new Response('AudiFiya web build not found in: ' + WEB_ROOT, { status: 500 });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const resolved = path.normalize(path.join(WEB_ROOT, pathname));
    if (resolved !== WEB_ROOT && !resolved.startsWith(WEB_ROOT + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    let isFile = false;
    try {
      isFile = fs.statSync(resolved).isFile();
    } catch {
      isFile = false;
    }

    if (isFile) return net.fetch(pathToFileURL(resolved).toString());

    // Missing asset (has an extension): real 404, don't return HTML for a .js file.
    if (path.extname(pathname)) return new Response('Not found', { status: 404 });

    // Client-side route: hand the SPA shell to the router.
    return net.fetch(pathToFileURL(indexFile).toString());
  });
}

// ---------------------------------------------------------------------------
// Network: header spoofing + CORS bypass
// ---------------------------------------------------------------------------
function isLocalUrl(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

/** Remove a header regardless of its casing. */
function deleteHeader(headers, name) {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) delete headers[key];
  }
}

function setupNetworkInterceptors() {
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  const ses = session.defaultSession;

  // Spoof User-Agent, Origin and Referer on outgoing requests.
  ses.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    // Leave the local dev server (Vite, HMR, etc.) untouched.
    if (isLocalUrl(details.url)) {
      callback({ requestHeaders: details.requestHeaders });
      return;
    }

    const headers = { ...details.requestHeaders };
    deleteHeader(headers, 'User-Agent');
    deleteHeader(headers, 'Origin');
    deleteHeader(headers, 'Referer');

    headers['User-Agent'] = SPOOF_USER_AGENT;
    headers['Origin'] = SPOOF_ORIGIN;
    headers['Referer'] = SPOOF_REFERER;

    callback({ requestHeaders: headers });
  });

  // Force permissive CORS on incoming responses.
  ses.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (isLocalUrl(details.url)) {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }

    const headers = { ...details.responseHeaders };
    deleteHeader(headers, 'Access-Control-Allow-Origin');
    deleteHeader(headers, 'Access-Control-Allow-Methods');
    deleteHeader(headers, 'Access-Control-Allow-Headers');
    deleteHeader(headers, 'Access-Control-Expose-Headers');
    deleteHeader(headers, 'Access-Control-Allow-Credentials');

    headers['Access-Control-Allow-Origin'] = ['*'];
    headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'];
    headers['Access-Control-Allow-Headers'] = ['*'];
    headers['Access-Control-Expose-Headers'] = ['*'];

    const result = { responseHeaders: headers };

    // Make sure CORS preflights succeed even if the server rejects OPTIONS.
    if (details.method === 'OPTIONS') {
      result.statusLine = 'HTTP/1.1 200 OK';
    }

    callback(result);
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function errorPage(message) {
  const html =
    '<body style="margin:0;background:#111;color:#fff;font:14px Segoe UI,sans-serif;padding:24px">' +
    '<h3>AudiFiya could not start</h3><pre style="white-space:pre-wrap;color:#f87171">' +
    String(message).replace(/</g, '&lt;') +
    '</pre></body>';
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    resizable: true,
    show: false,
    title: 'AudiFiya',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Never leave an invisible transparent window if loading fails.
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    console.error('did-fail-load:', code, desc, url);
    if (isMainFrame && mainWindow) {
      mainWindow.show();
      mainWindow.loadURL(errorPage(`Failed to load ${url}\n${desc} (${code})`));
    }
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('render-process-gone:', details);
  });
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`);
  });
  // Safety net: show the window even if ready-to-show never fires.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) mainWindow.show();
  }, 5000);

  // Open external links in the default browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Block in-window navigation away from the app.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (url !== current) event.preventDefault();
  });

  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else if (!findIndexFile()) {
    mainWindow.loadURL(
      errorPage(
        'Web build not found.\nExpected index.html or _shell.html in:\n' +
          WEB_ROOT +
          '\n\nRun: npm run electron:build'
      )
    );
  } else {
    mainWindow.loadURL(APP_URL);
  }

  if (OPEN_DEVTOOLS) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', () => {
    mainWindow = null;
    isNotchMode = false;
    savedBounds = null;
    savedWasMaximized = false;
  });
}

// ---------------------------------------------------------------------------
// IPC: notch mode
// ---------------------------------------------------------------------------
function isTrustedSender(event) {
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}

function centeredOrigin(width, height) {
  const { x, y, width: dw, height: dh } = screen.getPrimaryDisplay().workArea;
  return {
    x: Math.round(x + (dw - width) / 2),
    y: Math.round(y + (dh - height) / 2),
  };
}

function enterNotchMode() {
  if (!mainWindow || mainWindow.isDestroyed() || isNotchMode) return;

  savedWasMaximized = mainWindow.isMaximized();
  // getNormalBounds returns the un-maximized bounds if currently maximized.
  savedBounds = mainWindow.getNormalBounds();

  if (savedWasMaximized) mainWindow.unmaximize();

  const { x: areaX, y: areaY, width: areaWidth } = screen.getPrimaryDisplay().bounds;
  const x = Math.round(areaX + (areaWidth - NOTCH_WIDTH) / 2);
  const y = areaY + NOTCH_TOP_OFFSET;

  // Lift size constraints so the window can shrink to notch size.
  mainWindow.setMinimumSize(1, 1);
  mainWindow.setResizable(true); // needed on Windows for reliable setBounds
  mainWindow.setBounds({ x, y, width: NOTCH_WIDTH, height: NOTCH_HEIGHT });
  mainWindow.setResizable(false);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  isNotchMode = true;
}

function exitNotchMode() {
  if (!mainWindow || mainWindow.isDestroyed() || !isNotchMode) return;

  mainWindow.setAlwaysOnTop(false);
  mainWindow.setResizable(true);
  mainWindow.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);

  const bounds = savedBounds || {
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    ...centeredOrigin(DEFAULT_WIDTH, DEFAULT_HEIGHT),
  };
  mainWindow.setBounds(bounds);

  if (savedWasMaximized) mainWindow.maximize();

  savedBounds = null;
  savedWasMaximized = false;
  isNotchMode = false;
}

ipcMain.on('minimize-to-notch', (event) => {
  if (!isTrustedSender(event)) return;
  enterNotchMode();
});

ipcMain.on('restore-window', (event) => {
  if (!isTrustedSender(event)) return;
  exitNotchMode();
});

// ---------------------------------------------------------------------------
// IPC: standard window controls
// ---------------------------------------------------------------------------
ipcMain.on('minimize-window', (event) => {
  if (!isTrustedSender(event)) return;
  mainWindow.minimize();
});

ipcMain.on('maximize-window', (event) => {
  if (!isTrustedSender(event)) return;
  if (isNotchMode) return; // ignore while docked as a notch
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('close-window', (event) => {
  if (!isTrustedSender(event)) return;
  mainWindow.close();
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  if (!IS_DEV) registerAppProtocol();
  setupNetworkInterceptors();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
