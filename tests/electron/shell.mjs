/* global window, document */
import assert from 'node:assert/strict';

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
  const unauthorized = await application.evaluate(async ({ BrowserWindow }) => {
    const primary = BrowserWindow.getAllWindows()[0];
    const probe = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: primary.webContents.getLastWebPreferences().preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    try {
      await probe.loadURL('data:text/html,<h1>Unauthorized sender</h1>');
      return await probe.webContents.executeJavaScript(
        `window.pad.getAppInfo().then(() => false, error => error.message.includes('Unauthorized IPC sender'))`,
      );
    } finally {
      probe.destroy();
    }
  });
  assert.equal(unauthorized, true, 'bridge must reject another window');
  const original = page.url();
  const navigation = application.evaluate(
    ({ BrowserWindow }) =>
      new Promise((resolve) => {
        BrowserWindow.getAllWindows()[0].webContents.once(
          'will-navigate',
          (event) => resolve(event.defaultPrevented),
        );
      }),
  );
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = 'https://example.invalid/';
    document.body.append(link);
    link.click();
  });
  assert.equal(await navigation, true, 'navigation must be prevented');
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
