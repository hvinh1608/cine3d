const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const START_URL = process.env.CINE3D_DESKTOP_URL || 'https://cine3d.id.vn';
const ALLOWED_HOSTS = new Set([
  'cine3d.id.vn',
  'www.cine3d.id.vn',
  'api.cine3d.id.vn',
]);

/** @type {BrowserWindow | null} */
let mainWindow = null;

function isAllowedNavigation(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    if (ALLOWED_HOSTS.has(url.hostname)) return true;
    // Allow Google / Facebook OAuth redirects inside the window, then return to site.
    if (
      url.hostname.endsWith('google.com')
      || url.hostname.endsWith('googleapis.com')
      || url.hostname.endsWith('facebook.com')
      || url.hostname.endsWith('fb.com')
      || url.hostname.endsWith('accounts.google.com')
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#191a22',
    title: 'CINE3D',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      return { action: 'allow' };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Keep media playback working in background / minimized.
  mainWindow.webContents.setBackgroundThrottling(false);

  void mainWindow.loadURL(START_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
