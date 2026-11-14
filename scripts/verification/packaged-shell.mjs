/* global window, document */
import assert from 'node:assert/strict';
import { setTimeout, clearTimeout } from 'node:timers';
import { spawn } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium, _electron } from 'playwright';
import electron from 'electron';
import { fixtures } from './fixtures.mjs';

await mkdir('reports/verification', { recursive: true });
const directory = await mkdtemp(path.resolve('reports/verification/packaged-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'pad-packaged-'));
const executable =
  process.env.PAD_PACKAGED_EXECUTABLE ??
  path.resolve(
    process.platform === 'darwin'
      ? 'out/Mr. Emo Virtual Pad-darwin-arm64/Mr. Emo Virtual Pad.app/Contents/MacOS/Mr. Emo Virtual Pad'
      : process.platform === 'win32'
        ? 'out/Mr. Emo Virtual Pad-win32-x64/Mr. Emo Virtual Pad.exe'
        : 'out/Mr. Emo Virtual Pad-linux-x64/Mr. Emo Virtual Pad',
  );
const playback = process.argv.includes('--playback');
let manifest;
if (playback) {
  manifest = await fixtures(directory);
  const source = path.join(directory, manifest.file);
  const seed = await _electron.launch({
    executablePath: electron,
    chromiumSandbox: true,
    args: [process.cwd()],
    env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile },
  });
  try {
    assert.equal(
      await seed.evaluate(({ app }) => app.getPath('userData')),
      profile,
    );
    await seed.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, source);
    const page = await seed.firstWindow();
    await page.getByRole('button', { name: 'Importar áudio' }).click();
    await page
      .getByRole('button', { name: `1 ${manifest.file}`, exact: true })
      .waitFor();
    const media = await readdir(path.join(profile, 'library/media'));
    assert.equal(media.length, 1);
    assert.deepEqual(
      await readFile(path.join(profile, 'library/media', media[0])),
      await readFile(source),
    );
  } finally {
    await seed.close();
  }
  await rm(source);
}
const child = spawn(executable, ['--remote-debugging-port=0'], {
  env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile },
});
let browser;
let stderr = '';
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('No renderer debugging endpoint')),
      15000,
    );
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Package exited ${code}: ${stderr}`));
    });
    child.stderr.on('data', (data) => {
      stderr += String(data);
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    });
  });
  browser = await chromium.connectOverCDP(endpoint);
  const page = browser.contexts()[0].pages()[0];
  await page.getByRole('button', { name: 'Editar repertório' }).waitFor();
  assert.equal(page.url(), 'pad-app://app/index.html');
  assert.equal(
    await page.getByText('Parado', { exact: true }).innerText(),
    'Parado',
  );
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const info = await page.evaluate(() => window.pad.getAppInfo());
  const media = [];
  if (manifest) {
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
    assert.equal(
      await page
        .getByRole('status')
        .filter({ hasText: 'Reproduzindo' })
        .innerText(),
      'Reproduzindo',
    );
    assert.ok(media.some((response) => response.status === 206));
    await page.getByRole('button', { name: 'STOP', exact: true }).click();
    await page.getByText('Parado', { exact: true }).waitFor();
    await page
      .getByRole('button', { name: 'Editar repertório' })
      .click({ trial: true });
    await page.screenshot({ path: path.join(directory, 'stopped.png') });
  }
  await writeFile(
    path.join(directory, 'result.json'),
    JSON.stringify(
      {
        status: 'PASS',
        scope: playback
          ? 'packaged decode/progress/STOP; catalog seeded by unpackaged native-dialog boundary control; NOT packaged import'
          : 'packaged shell',
        executable,
        platform: process.platform,
        media,
        route: 'renderer CDP; release main inspection fuse unchanged',
        info,
        profile,
        url: page.url(),
        stderr,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    path.join(directory, 'failure.json'),
    JSON.stringify({ status: 'ISSUES', error: error.stack, profile }, null, 2),
  );
  throw error;
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  assert.ok(child.exitCode !== null || child.signalCode !== null);
  await writeFile(path.join(directory, 'stderr.log'), stderr);
  console.log(JSON.stringify({ directory, profile, childExited: true }));
}
