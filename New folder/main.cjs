const { app, BrowserWindow, ipcMain, screen, session } = require('electron');
const path = require('path');

let mainWindow;
let previousBounds = { x: 0, y: 0, width: 1200, height: 800 };

function createWindow() {
  // 1. THE ULTIMATE API BYPASS: Spoof all outgoing headers
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    details.requestHeaders['Origin'] = 'https://www.jiosaavn.com';
    details.requestHeaders['Referer'] = 'https://www.jiosaavn.com/';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  // 2. Strip incoming CORS restrictions from the API response
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['*'],
        'Access-Control-Allow-Headers': ['*']
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Disables strict same-origin policy
    },
  });

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:8080/');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  setTimeout(createWindow, 300);
});

ipcMain.on('minimize-to-notch', () => {
  previousBounds = mainWindow.getBounds();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;
  
  const notchWidth = 400; 
  const notchHeight = 65; 
  
  const x = Math.round((width / 2) - (notchWidth / 2));
  const y = 15; 
  
  mainWindow.setBounds({ x, y, width: notchWidth, height: notchHeight }, true);
  mainWindow.setResizable(false);
  mainWindow.setAlwaysOnTop(true);
});

ipcMain.on('restore-window', () => {
  mainWindow.setResizable(true);
  mainWindow.setBounds(previousBounds, true);
  mainWindow.setAlwaysOnTop(false);
});

ipcMain.on('minimize-window', () => mainWindow.minimize());
ipcMain.on('maximize-window', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('close-window', () => mainWindow.close());