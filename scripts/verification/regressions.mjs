import assert from 'node:assert/strict';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

await mkdir('reports/verification', { recursive: true });
const directory = await mkdtemp(
  path.resolve('reports/verification/regressions-'),
);
const variants = [
  {
    name: 'late-grant-starts-canceled-audio',
    before: 'if (!attempt.valid) return;',
    after: '',
  },
  {
    name: 'cleanup-unlocks-before-release',
    before: 'if (attempt.lease) await this.leases.release(attempt.lease);',
    after:
      'if (attempt.lease) this.leases.release(attempt.lease).catch(() => {});',
  },
];
const results = [];
for (const variant of [{ name: 'baseline' }, ...variants]) {
  const checkout = path.join(directory, variant.name);
  await mkdir(checkout);
  for (const entry of [
    'src',
    'tests/model',
    'package.json',
    'tsconfig.test.json',
    'tsconfig.base.json',
    'vitest.config.mjs',
  ]) {
    await cp(entry, path.join(checkout, entry), { recursive: true });
  }
  await symlink(
    path.resolve('node_modules'),
    path.join(checkout, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  if (variant.before) {
    const file = path.join(checkout, 'src/renderer/playback/controller.ts');
    const source = await readFile(file, 'utf8');
    assert.ok(source.includes(variant.before));
    await writeFile(file, source.replace(variant.before, variant.after));
  }
  const run = spawnSync(
    process.execPath,
    [path.resolve('node_modules/vitest/vitest.mjs'), 'run', 'tests/model'],
    { cwd: checkout, encoding: 'utf8' },
  );
  await writeFile(path.join(checkout, 'output.log'), run.stdout + run.stderr);
  if (variant.before) {
    assert.ok(
      run.stdout.includes('shrunk') || run.stderr.includes('shrunk'),
      'variant must produce a shrunk model counterexample',
    );
    assert.ok(
      (run.stdout + run.stderr).includes('AssertionError'),
      'variant must fail a product assertion',
    );
  }
  results.push({ name: variant.name, exitCode: run.status });
  assert.equal(
    run.status,
    variant.before ? 1 : 0,
    `${variant.name}: ${run.stdout}${run.stderr}`,
  );
}
await writeFile(
  path.join(directory, 'result.json'),
  JSON.stringify(
    {
      results,
      scope:
        'controlled controller cancellation/cleanup variants, not Stryker inventory',
    },
    null,
    2,
  ),
);
console.log(directory);
