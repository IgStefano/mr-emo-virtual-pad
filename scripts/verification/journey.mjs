/* global document, requestAnimationFrame */
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';
import { _electron } from 'playwright';
import { fixtures } from './fixtures.mjs';

await mkdir(path.resolve('reports/verification'), { recursive: true });
const directory = await mkdtemp(path.resolve('reports/verification/journey-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'pad-journey-'));
const manifest = await fixtures(directory);
const source = path.join(directory, manifest.file);
let application;
const observations = [];
async function launch() {
  application = await _electron.launch({
    executablePath: electron,
    chromiumSandbox: true,
    args: [process.cwd()],
    env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile },
  });
  const runtime = await application.evaluate(({ app, BrowserWindow }) => ({
    profile: app.getPath('userData'),
    packaged: app.isPackaged,
    preferences:
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  }));
  assert.equal(runtime.profile, profile);
  assert.equal(runtime.packaged, false);
  assert.equal(runtime.preferences.sandbox, true);
  assert.equal(runtime.preferences.contextIsolation, true);
  assert.equal(runtime.preferences.nodeIntegration, false);
  const roles = await application.evaluate(({ Menu }) => {
    const roles = [];
    function visit(menu) {
      for (const item of menu?.items ?? []) {
        roles.push(String(item.role).toLowerCase());
        visit(item.submenu);
      }
    }
    visit(Menu.getApplicationMenu());
    return roles;
  });
  assert.ok(!roles.includes('reload'));
  assert.ok(!roles.includes('forcereload'));
  assert.ok(roles.includes('filemenu'));
  assert.ok(roles.includes('editmenu'));
  observations.push(runtime);
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Editar repertório' }).waitFor();
  await page.evaluate(() => {
    document.documentElement.dataset.reloadProbe = 'retained';
  });
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+r' : 'Control+r',
  );
  await page.keyboard.press('F5');
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.reloadProbe),
    'retained',
  );
  return page;
}
try {
  let page = await launch();
  await application.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, source);
  await page.getByRole('button', { name: 'Importar áudio' }).click();
  await page
    .getByRole('button', { name: `1 ${manifest.file}`, exact: true })
    .waitFor();
  const files = await readdir(path.join(profile, 'library/media'));
  assert.equal(files.length, 1);
  assert.deepEqual(
    await readFile(path.join(profile, 'library/media', files[0])),
    await readFile(source),
  );
  await application.close();
  application = undefined;
  await rm(source);
  page = await launch();
  const media = [];
  page.on('response', (response) => {
    if (response.url().startsWith('pad-media:'))
      media.push({ url: response.url(), status: response.status() });
  });
  await page
    .getByRole('button', { name: `1 ${manifest.file}`, exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Number(
        document
          .querySelector('[role="progressbar"]')
          ?.getAttribute('aria-valuenow'),
      ) > 0,
  );
  observations.push({
    progress: await page
      .getByRole('progressbar', { name: 'Progresso' })
      .getAttribute('aria-valuenow'),
    media,
  });
  assert.ok(
    media.some(
      (response) => response.status === 200 || response.status === 206,
    ),
  );
  assert.equal(
    await page
      .getByRole('status')
      .filter({ hasText: 'Reproduzindo' })
      .innerText(),
    'Reproduzindo',
  );
  await page.getByRole('button', { name: 'STOP', exact: true }).click();
  await page
    .getByRole('button', { name: 'Editar repertório' })
    .click({ trial: true });
  assert.equal(
    await page.getByText('Parado', { exact: true }).innerText(),
    'Parado',
  );
  await page
    .getByRole('button', { name: `1 ${manifest.file}`, exact: true })
    .click();
  const rendererClosed = application.waitForEvent('close');
  await application.evaluate(({ BrowserWindow }) => {
    process.kill(
      BrowserWindow.getAllWindows()[0].webContents.getOSProcessId(),
      'SIGKILL',
    );
  });
  await rendererClosed;
  application = undefined;
  page = await launch();
  assert.equal(
    await page.getByText('Parado', { exact: true }).innerText(),
    'Parado',
  );
  observations.push({ crashRestartStopped: true });
  await page.getByRole('button', { name: 'Editar repertório' }).click();
  await page
    .getByRole('button', { name: `Excluir ${manifest.file}`, exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar exclusão' }).click();
  await page.getByText('Seu repertório está vazio').waitFor();
  assert.deepEqual(await readdir(path.join(profile, 'library/media')), []);
  await page.screenshot({ path: path.join(directory, 'journey.png') });
  await writeFile(
    path.join(directory, 'result.json'),
    JSON.stringify(
      { status: 'PASS', mode: 'unpackaged', observations },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    path.join(directory, 'result.json'),
    JSON.stringify(
      { status: 'ISSUES', error: error.stack, observations },
      null,
      2,
    ),
  );
  throw error;
} finally {
  if (application) await application.close();
  await rm(profile, { recursive: true, force: true });
  console.log(directory);
}
