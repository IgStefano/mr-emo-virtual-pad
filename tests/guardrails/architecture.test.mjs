import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const fixture = 'src/domain/__guardrail_fixture.ts';
function checkGraph() {
  return spawnSync(
    process.execPath,
    [
      'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs',
      'src',
      '--config',
      '.dependency-cruiser.cjs',
    ],
    { encoding: 'utf8' },
  );
}
for (const [name, code, rule] of [
  ['relative layer crossing', "import '../main/main';", 'architecture/domain'],
  ['alias layer crossing', "import '@main/main';", 'architecture/domain'],
  [
    'type-only crossing',
    "import type { AppInfo } from '../contracts/app-info'; export type Leaked = AppInfo;",
    'architecture/domain',
  ],
  ['node builtin', "import 'node:fs';", 'architecture/domain-is-pure'],
  ['bare builtin', "import 'fs';", 'architecture/domain-is-pure'],
]) {
  test(`graph rejects ${name}`, async () => {
    try {
      await writeFile(fixture, code);
      const result = checkGraph();
      assert.ok(
        result.status !== null && result.status > 0,
        result.stderr + result.stdout,
      );
      assert.match(result.stdout, new RegExp(rule));
    } finally {
      await rm(fixture, { force: true });
    }
  });
}
test('graph accepts the actual source', () => {
  const result = checkGraph();
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test('graph rejects metadata filesystem access outside storage', async () => {
  const adapter = 'src/main/__metadata_guardrail_fixture.ts';
  try {
    await writeFile(adapter, "export { parseFile } from 'music-metadata';");
    const result = checkGraph();
    assert.ok(
      result.status !== null && result.status > 0,
      result.stderr + result.stdout,
    );
    assert.match(result.stdout, /architecture\/storage-owns-metadata/);
  } finally {
    await rm(adapter, { force: true });
  }
});

for (const [file, code, rule] of [
  [
    'src/main/ipc/__boundary.ts',
    "import { ipcMain } from 'electron'; export const bypass = ipcMain;",
    'architecture/electron-entrypoints',
  ],
  [
    'src/main/ipc/__boundary.ts',
    "import { readFile } from 'node:fs/promises'; export const bypass = readFile;",
    'architecture/storage-owns-disk',
  ],
]) {
  test(`rejects privileged bypass ${rule}`, async () => {
    try {
      await writeFile(file, code);
      const result = checkGraph();
      assert.ok(result.status > 0, result.stdout + result.stderr);
      assert.ok(result.stdout.includes(rule), result.stdout);
    } finally {
      await rm(file, { force: true });
    }
  });
}
