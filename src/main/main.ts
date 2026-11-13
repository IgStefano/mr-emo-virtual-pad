import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appInfoChannel, appInfoSchema } from '../contracts/app-info';

const verificationDirectory = process.env.PAD_VERIFICATION_DATA_DIR;
if (verificationDirectory !== undefined) {
  if (!path.isAbsolute(verificationDirectory)) {
    throw new Error(
      'PAD_VERIFICATION_DATA_DIR must be an existing absolute directory',
    );
  }
  app.setPath('userData', verificationDirectory);
}

async function openWindow(): Promise<void> {
  const entry = path.join(
    __dirname,
    `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
  );
  const target = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? pathToFileURL(entry).href;
  const window = new BrowserWindow({
    title: 'Mr. Emo Virtual Pad',
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  ipcMain.handle(appInfoChannel, (event) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== target
    ) {
      throw new Error('Unauthorized IPC sender');
    }
    return appInfoSchema.parse({ version: app.getVersion() });
  });
  window.on('closed', () => {
    ipcMain.removeHandler(appInfoChannel);
  });
  await window.loadURL(target);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(async () => {
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => {
          callback(false);
        },
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      if (app.isPackaged) {
        session.defaultSession.webRequest.onHeadersReceived(
          (details, callback) => {
            callback({
              responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'",
                ],
              },
            });
          },
        );
      }
      await openWindow();
    })
    .catch((error: unknown) => {
      console.error(error);
      app.quit();
    });
  app.on('window-all-closed', () => {
    app.quit();
  });
}
