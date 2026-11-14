/* global document */
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
  observations.push(runtime);
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Importar áudio' }).waitFor();
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
    .getByRole('button', { name: manifest.file, exact: true })
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
  await page.getByRole('button', { name: manifest.file, exact: true }).click();
  await page.waitForFunction(
    () => Number(document.querySelector('output')?.textContent) > 0,
  );
  observations.push({
    progress: await page.getByLabel('Posição').innerText(),
    media,
  });
  assert.ok(
    media.some(
      (response) => response.status === 200 || response.status === 206,
    ),
  );
  assert.equal(
    await page.getByText('Reproduzindo', { exact: true }).innerText(),
    'Reproduzindo',
  );
  await page.getByRole('button', { name: 'STOP', exact: true }).click();
  await page
    .getByRole('button', { name: 'Importar áudio' })
    .waitFor({ state: 'visible' });
  assert.equal(
    await page.getByText('Parado', { exact: true }).innerText(),
    'Parado',
  );
  await page.getByRole('button', { name: manifest.file, exact: true }).click();
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
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: `Excluir ${manifest.file}`, exact: true })
    .click();
  await page.getByText('O repertório está vazio.').waitFor();
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
