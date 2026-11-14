import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import electron from 'electron';
import { _electron } from 'playwright';
import { setTimeout, clearTimeout } from 'node:timers';
await mkdir('reports/verification', { recursive: true });
const directory = await mkdtemp(path.resolve('reports/verification/shutdown-retry-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'pad-shutdown-retry-'));
let application;
let child;
let stdout = '';
let stderr = '';
let timer;
try {
  application = await _electron.launch({ executablePath: electron, chromiumSandbox: true, args: [process.cwd()], env: { ...process.env, PAD_VERIFICATION_DATA_DIR: profile } });
  child = application.process();
  child.stdout.on('data', data => { stdout += String(data); });
  child.stderr.on('data', data => { stderr += String(data); });
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Editar repertório' }).waitFor();
  const settings = await application.evaluate(({ app, BrowserWindow }) => ({ profile: app.getPath('userData'), sandbox: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox }));
  assert.equal(settings.profile, profile);
  assert.equal(settings.sandbox, true);
  await application.evaluate(({ app }) => {
    app.on('before-quit', event => process.stdout.write('BEFORE_QUIT_PREVENTED=' + event.defaultPrevented + '\n'));
    app.once('will-quit', () => process.stdout.write('APP_QUIT_CONFIRMED\n'));
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const original = DatabaseSync.prototype.close;
    let attempts = 0;
    DatabaseSync.prototype.close = function () {
      attempts++;
      process.stdout.write(`CLEANUP_ATTEMPT=${attempts}\n`);
      if (attempts === 1) { process.getBuiltinModule('node:timers').setTimeout(() => app.quit(), 100); throw new Error('Injected transient database close failure'); }
      return original.call(this);
    };
  });
  const quitObserved = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Application did not authorize quit')), 15000);
    child.stdout.on('data', () => { if (stdout.includes('APP_QUIT_CONFIRMED')) resolve(); });
  });
  await application.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].destroy(); });
  await quitObserved;
  assert.match(stdout, /CLEANUP_ATTEMPT=1/);
  assert.match(stdout, /CLEANUP_ATTEMPT=2/);
  assert.doesNotMatch(stdout, /CLEANUP_ATTEMPT=3/);
  await writeFile(path.join(directory, 'result.json'), JSON.stringify({ status: 'PASS', mode: 'sandboxed unpackaged Linux', controlledFailure: 'SQLite close throws once before closing', stdout, settings, quitObserved: true, debuggerChildCleanup: 'harness terminates its own child after observing app quit' }, null, 2));
  application = undefined;
} catch (error) {
  await writeFile(path.join(directory, 'failure.json'), JSON.stringify({ error: error.stack, stdout, stderr, exitCode: child?.exitCode }, null, 2));
  throw error;
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill('SIGKILL');
    await exited;
  }
  await rm(profile, { recursive: true, force: true });
  console.log(directory);
}
