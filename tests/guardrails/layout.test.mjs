import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
test('new source folders cannot escape the layer matrix', async () => {
  try {
    await mkdir('src/__unclassified');
    const result = spawnSync(process.execPath, ['scripts/check-layout.mjs'], {
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ARCH000/);
  } finally {
    await rm('src/__unclassified', { recursive: true, force: true });
  }
});
