import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fixtures } from '../../scripts/verification/fixtures.mjs';

test('redistributable PCM fixture has isolated left and right intervals', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'pad-fixture-test-'));
  try {
    const manifest = await fixtures(directory);
    const bytes = await readFile(path.join(directory, 'stereo.wav'));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(bytes.readUInt16LE(22), 2);
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal(bytes.readUInt32LE(40), 192000);
    assert.equal(bytes.length, 192044);
    for (let frame = 0; frame < 48000; frame++) {
      const left = bytes.readInt16LE(44 + frame * 4);
      const right = bytes.readInt16LE(46 + frame * 4);
      assert.equal(Math.abs(left), frame < 24000 ? 8192 : 0);
      assert.equal(Math.abs(right), frame < 24000 ? 0 : 4096);
    }
    assert.equal(manifest.license, 'CC0-1.0');
    assert.deepEqual(
      JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')),
      manifest,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
