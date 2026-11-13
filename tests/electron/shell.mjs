/* global window */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

export async function drive(application, profile, version, evidence) {
  const runtime = await application.evaluate(({ app, BrowserWindow }) => ({
    userData: app.getPath('userData'),
    version: app.getVersion(),
    packaged: app.isPackaged,
    versions: process.versions,
    windows: BrowserWindow.getAllWindows().map((window) =>
      window.webContents.getLastWebPreferences(),
    ),
  }));
  await evidence('runtime.json', runtime);
  assert.equal(
    runtime.userData,
    profile,
    'bootstrap must use disposable userData',
  );
  assert.equal(runtime.version, version);
  assert.equal(
    runtime.packaged,
    false,
    'this gate uses the unpackaged runtime',
  );
  assert.equal(runtime.windows.length, 1);
  assert.equal(runtime.windows[0].sandbox, true);
  assert.equal(runtime.windows[0].contextIsolation, true);
  assert.equal(runtime.windows[0].nodeIntegration, false);
  const page = await application.firstWindow();
  await page
    .getByRole('heading', { name: 'Seu repertório. Pronto para o palco.' })
    .waitFor();
  assert.equal((await page.getByRole('status').innerText()).trim(), 'Parado');
  assert.match(
    await page.getByRole('main').innerText(),
    /O repertório está vazio/,
  );
  assert.deepEqual(await page.evaluate(() => window.pad.getAppInfo()), {
    version,
  });
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  await page.screenshot({ path: evidence.directory + '/shell.png' });
  await evidence('accessibility.html', await page.content());
  const unauthorized = await application.evaluate(
    async ({ BrowserWindow }, preload) => {
      const primary = BrowserWindow.getAllWindows()[0];
      const probe = new BrowserWindow({
        show: false,
        webPreferences: {
          preload,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      try {
        await probe.loadURL(primary.webContents.getURL());
        return await probe.webContents.executeJavaScript(
          `typeof window.pad === 'undefined'
          ? { bridge: false, denied: false }
          : window.pad.getAppInfo().then(
              () => ({ bridge: true, denied: false }),
              error => ({ bridge: true, denied: error.message.includes('Unauthorized IPC sender'), error: error.message })
            )`,
        );
      } finally {
        probe.destroy();
      }
    },
    fileURLToPath(new URL('../../.vite/build/preload.cjs', import.meta.url)),
  );
  await evidence('unauthorized-sender.json', unauthorized);
  assert.equal(
    unauthorized.bridge,
    true,
    'probe window must load the real preload',
  );
  assert.equal(unauthorized.denied, true, 'bridge must reject another window');
  const original = page.url();
  const navigation = await application.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0].webContents;
    return new Promise((resolve, reject) => {
      const timeout = globalThis.setTimeout(
        () => reject(new Error('Navigation event timeout')),
        10000,
      );
      contents.once('will-navigate', (event) => {
        globalThis.clearTimeout(timeout);
        resolve(event.defaultPrevented);
      });
      contents
        .executeJavaScript(
          `(() => {
        const link = document.createElement('a');
        link.href = 'https://example.invalid/';
        document.body.append(link);
        link.click();
      })()`,
        )
        .catch(reject);
    });
  });
  assert.equal(navigation, true, 'navigation must be prevented');
  assert.equal(page.url(), original);
  assert.equal(
    await page.evaluate(() => window.open('https://example.invalid/')),
    null,
  );
  return {
    empty: true,
    stopped: true,
    bridge: true,
    unauthorizedSenderRejected: true,
    navigationRejected: true,
  };
}
