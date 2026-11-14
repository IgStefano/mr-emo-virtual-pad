/* global B1, document, HTMLAudioElement */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { _electron } from 'playwright';

const bundle = await build({
  configFile: false,
  logLevel: 'error',
  build: {
    write: false,
    lib: { entry: 'src/renderer/playback/dom-audio.ts', name: 'B1', formats: ['iife'] },
  },
});
const chunks = (Array.isArray(bundle) ? bundle : [bundle]).flatMap((item) => item.output);
const code = chunks.find((item) => item.type === 'chunk')?.code;
assert.ok(code);
const profile = await mkdtemp(path.join(os.tmpdir(), 'b1-native-'));
let app;
try {
  app = await _electron.launch({ args: ['.', `--user-data-dir=${profile}`] });
  const page = await app.firstWindow();
  await page.evaluate(code);
  const result = await page.evaluate(async () => {
    const elements = [];
    const create = document.createElement.bind(document);
    document.createElement = (...args) => {
      const element = create(...args);
      if (element instanceof HTMLAudioElement) elements.push(element);
      return element;
    };
    const audio = new B1.DomAudioExecutor(() => 'data:audio/wav;base64,');
    let rejected = false;
    try {
      await audio.start({ assetId: 'asset', leaseId: 'lease', attemptId: 1, offset: 0 });
    } catch {
      rejected = true;
    }
    await audio.stop(1);
    await audio.dispose();
    return { rejected, nativeElement: elements.length === 1, released: elements.every((element) => element.paused && !element.hasAttribute('src') && !element.autoplay && !element.loop) };
  });
  assert.deepEqual(result, { rejected: true, nativeElement: true, released: true });
  await writeFile('.pstack/evidence/B1/native-result.json', JSON.stringify({ ...result, scope: 'native factory and cleanup after rejected media; no successful media playback or physical output claim' }, null, 2) + '\n');
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
