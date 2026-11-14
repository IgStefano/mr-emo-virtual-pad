/* global window */
import assert from 'node:assert/strict';
import { setTimeout, clearTimeout } from 'node:timers';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';

const profile = await mkdtemp(path.join(os.tmpdir(), 'pad-packaged-'));
const child = spawn(
  path.resolve('out/Mr. Emo Virtual Pad-linux-x64/Mr. Emo Virtual Pad'),
  ['--remote-debugging-port=0'],
  { env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile } },
);
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
  await page.getByRole('button', { name: 'Importar áudio' }).waitFor();
  assert.equal(page.url(), 'pad-app://app/index.html');
  assert.equal(
    await page.getByText('Parado', { exact: true }).innerText(),
    'Parado',
  );
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  const info = await page.evaluate(() => window.pad.getAppInfo());
  await writeFile(
    '.pstack/evidence/I1/composition-packaged-shell.json',
    JSON.stringify(
      {
        status: 'PASS',
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
} finally {
  if (browser) await browser.close();
  child.kill();
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(profile, { recursive: true, force: true });
}
