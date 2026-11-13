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
