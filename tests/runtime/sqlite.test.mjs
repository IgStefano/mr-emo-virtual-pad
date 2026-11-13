import assert from 'node:assert/strict';
import { test } from 'node:test';
import { probeSqlite } from '../../scripts/probes/sqlite.mjs';

test('SQLite persists committed schema and rows while rejecting invalid references', async () => {
  const result = await probeSqlite();
  assert.equal(result.status, 'PASS');
  assert.match(result.sqliteVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(result.runtime.packaged, false);
});
