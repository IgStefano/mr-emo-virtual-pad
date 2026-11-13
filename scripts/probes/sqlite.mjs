import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function probeSqlite() {
  const runtime = {
    platform: process.platform,
    arch: process.arch,
    versions: process.versions,
    executable: process.execPath,
    packaged: false,
  };
  const { DatabaseSync } = await import('node:sqlite');
  const directory = mkdtempSync(join(tmpdir(), 'pad-sqlite-probe-'));
  const path = join(directory, 'probe.sqlite');
  let db;
  try {
    db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON');
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    const version = db
      .prepare('SELECT sqlite_version() AS version')
      .get().version;
    db.exec(`BEGIN;
      CREATE TABLE asset (id INTEGER PRIMARY KEY);
      CREATE TABLE pad (id INTEGER PRIMARY KEY, asset_id INTEGER REFERENCES asset(id));
      INSERT INTO asset VALUES (1);
      INSERT INTO pad VALUES (1, 1);
      PRAGMA user_version = 1;
      COMMIT;`);
    assert.throws(
      () => db.exec('INSERT INTO pad VALUES (2, 999)'),
      /FOREIGN KEY/,
    );
    db.exec('BEGIN; INSERT INTO asset VALUES (2); ROLLBACK;');
    assert.equal(db.prepare('SELECT count(*) AS n FROM asset').get().n, 1);
    db.exec(
      'BEGIN; ALTER TABLE asset ADD COLUMN label TEXT; PRAGMA user_version = 2; ROLLBACK;',
    );
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 1);
    assert.throws(
      () => db.prepare('SELECT label FROM asset'),
      /no such column/,
    );
    db.exec(
      'BEGIN; ALTER TABLE asset ADD COLUMN label TEXT; PRAGMA user_version = 2; COMMIT;',
    );
    db.close();
    db = undefined;
    db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON');
    assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
    assert.equal(db.prepare('SELECT count(*) AS n FROM pad').get().n, 1);
    assert.equal(db.prepare('SELECT label FROM asset').get().label, null);
    assert.throws(
      () => db.exec('DELETE FROM asset WHERE id = 1'),
      /FOREIGN KEY/,
    );
    return {
      runtime,
      sqliteVersion: version,
      checks: [
        'create',
        'reopen',
        'rollback',
        'foreign-key',
        'migration-rollback',
        'migration-commit',
      ],
      status: 'PASS',
    };
  } finally {
    try {
      db?.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await probeSqlite(), null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
