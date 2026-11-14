/* global setImmediate */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';
import { _electron } from 'playwright';
import { fixtures } from '../../../../scripts/verification/fixtures.mjs';

const profile = await mkdtemp(path.join(os.tmpdir(), 'a2-runtime-'));
const directory = path.resolve('reports/a2-native-lifecycle');
const manifest = await fixtures(profile);
const source = path.join(profile, manifest.file);
let application;
const observations = [];
async function launch() {
  application = await _electron.launch({
    executablePath: electron,
    chromiumSandbox: true,
    args: [process.cwd()],
    env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile },
  });
  application.process().stderr.on('data', (data) => { process.stderr.write(data); });
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Editar repertório' }).waitFor();
  return page;
}
try {
  let page = await launch();
  console.log('launched');
  await application.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = () => new Promise((resolve) => {
      process.once('a2-finish-import', () => resolve({ canceled: false, filePaths: [file] }));
      process.emit('a2-dialog-ready');
    });
  }, source);
  await page.getByRole('button', { name: 'Importar áudio' }).click();
  console.log('import clicked');
  await application.evaluate(() => new Promise((resolve) => {
    if (process.listenerCount('a2-finish-import') === 1) resolve();
    else process.once('a2-dialog-ready', resolve);
  }));
  console.log('pending verified');
  await application.evaluate(({ BrowserWindow }) => new Promise((resolve) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.once('closed', () => { setImmediate(resolve); });
    window.close();
  }));
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 0);
  console.log('window closed');
  observations.push('main remains alive with no window while import awaits selection');
  const exited = application.waitForEvent('close');
  await application.evaluate(() => { process.emit('a2-finish-import'); });
  console.log('selection delivered');
  await exited;
  console.log('exited');
  application = undefined;
  const files = await readdir(path.join(profile, 'library/media'));
  assert.equal(files.length, 1);
  assert.deepEqual(await readFile(path.join(profile, 'library/media', files[0])), await readFile(source));
  observations.push('shutdown completed only after managed bytes were published');
  page = await launch();
  await page.getByRole('button', { name: `1 ${manifest.file}`, exact: true }).waitFor();
  await page.getByRole('button', { name: `1 ${manifest.file}`, exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Reproduzindo' }).waitFor();
  await application.evaluate(({ dialog, BrowserWindow }) => {
    dialog.showMessageBoxSync = () => 0;
    BrowserWindow.getAllWindows()[0].close();
  });
  assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  observations.push('canceling close retains active window');
  const suspended = application.waitForEvent('close');
  await application.evaluate(({ powerMonitor }) => { powerMonitor.emit('suspend'); });
  await suspended;
  application = undefined;
  page = await launch();
  await page.getByText('Parado', { exact: true }).waitFor();
  observations.push('synthetic suspend exits and restart is stopped');
  await page.getByRole('button', { name: `1 ${manifest.file}`, exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Reproduzindo' }).waitFor();
  const accepted = application.waitForEvent('close');
  await application.evaluate(({ dialog, BrowserWindow }) => {
    dialog.showMessageBoxSync = () => 1;
    BrowserWindow.getAllWindows()[0].close();
  }).catch(() => undefined);
  await accepted;
  application = undefined;
  page = await launch();
  await page.getByText('Parado', { exact: true }).waitFor();
  observations.push('confirmed playback close exits and restart is stopped');

  await application.close();
  application = undefined;
  await writeFile(path.join(directory, 'runtime.json'), JSON.stringify({ platform: process.platform, observations, physicalPowerEvent: false, physicalAudioOutput: false }, null, 2) + '\n');
} finally {
  await application?.evaluate(() => { process.emit('a2-finish-import'); }).catch(() => undefined);
  await application?.close();
  await rm(profile, { recursive: true, force: true });
}
