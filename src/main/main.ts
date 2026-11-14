import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  protocol,
  dialog,
  Menu,
} from 'electron';
import type { MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { appInfoChannel, appInfoSchema } from '../contracts/app-info';

import { ApplicationProtocol } from './storage/application-protocol';
import { ManagedMediaProtocol } from './storage/media-protocol';
import { ManagedCatalog } from './library/managed-catalog';
import { validateAudio } from './storage/audio-metadata';
import { SessionAuthority } from './ipc/authority';
import { CatalogSessionService } from './ipc/catalog-session';
import { registerDesktopIpc } from './ipc/desktop';
import { desktopOperations } from '../contracts/desktop';
import { ErrorCode, LeaseKind } from '../contracts/operations';
import { CatalogFault } from './storage/catalog-store';
import { RendererLifetime } from './ipc/renderer-lifetime';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'pad-app',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
  {
    scheme: 'pad-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

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
  const target = MAIN_WINDOW_VITE_DEV_SERVER_URL ?? 'pad-app://app/index.html';
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
  const authority = new SessionAuthority();
  const root = path.join(app.getPath('userData'), 'library');
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
      if (lease.kind !== LeaseKind.Edit && lease.kind !== LeaseKind.Recovery)
        throw new CatalogFault(ErrorCode.Unauthorized);
    },
    selectFiles: async () => {
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'multiSelections'],
      });
      return result.canceled ? [] : result.filePaths;
    },
    validateAudio,
  });
  const service = new CatalogSessionService({
    authority,
    catalog,
    onPlaybackReleased: (leaseId) => {
      media.revoke(leaseId);
      return Promise.resolve();
    },
  });
  const media = new ManagedMediaProtocol({
    mediaRoot: path.join(root, 'media'),
    authorize: (assetId, leaseId) => service.authorizeMedia(assetId, leaseId),
  });
  const application = new ApplicationProtocol(path.dirname(entry));
  protocol.handle('pad-app', (request) => application.handle(request));
  protocol.handle('pad-media', (request) => media.handle(request));
  const lifetime = new RendererLifetime((id) =>
    service.closeAfterRendererTermination(id),
  );
  registerDesktopIpc(
    {
      handle: (channel, handler) => {
        ipcMain.handle(channel, (event, payload: unknown) =>
          lifetime.run(channel, () => handler(event, payload)),
        );
      },
    },
    service,
    {
      sender: window.webContents,
      mainFrame: window.webContents.mainFrame,
      getURL: () => window.webContents.getURL(),
      url: target,
    },
  );
  const terminate = async () => {
    await lifetime.terminate();
    media.dispose();
    catalog.close();
  };
  window.webContents.once('render-process-gone', () => {
    window.destroy();
  });
  window.webContents.once('destroyed', () => {
    void terminate().catch(console.error);
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
    for (const operation of Object.values(desktopOperations))
      ipcMain.removeHandler(operation.channel);
  });
  await window.loadURL(target);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app
    .whenReady()
    .then(async () => {
      const applicationMenu: MenuItemConstructorOptions[] = [
        { role: 'fileMenu' },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ];
      if (process.platform === 'darwin')
        applicationMenu.unshift({ role: 'appMenu' });
      Menu.setApplicationMenu(Menu.buildFromTemplate(applicationMenu));
      session.defaultSession.setPermissionRequestHandler(
        (_contents, _permission, callback) => {
          callback(false);
        },
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
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
