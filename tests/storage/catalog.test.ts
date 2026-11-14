import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
  readdirSync,
  symlinkSync,
  readlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it } from 'vitest';
import { ManagedCatalog } from '../../src/main/library/managed-catalog';
import { editRequestSchema } from '../../src/contracts/operations';
import type { Lease } from '../../src/contracts/operations';
import { padIdSchema } from '../../src/contracts/catalog';
import { CatalogStore } from '../../src/main/storage/catalog-store';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'pad-'));
  roots.push(root);
  const source = join(root, 'original');
  writeFileSync(source, 'audio bytes');
  const lease = editRequestSchema.shape.lease.parse({
    sessionId: randomUUID(),
    leaseId: randomUUID(),
    attemptId: 1,
    kind: 'edit',
  });
  const dependencies = {
    assertEditLease: (given: Lease) => {
      if (given !== lease && given.leaseId !== lease.leaseId)
        throw new Error('unauthorized');
    },
    selectFiles: () => Promise.resolve([source]),
    validateAudio: () => Promise.resolve({ durationSeconds: 12 }),
  };
  return { root, source, lease, dependencies };
}

it('persists 31 pads, labels, colors, ordering and managed bytes across restart', async () => {
  const f = setup();
  f.dependencies.selectFiles = () =>
    Promise.resolve(Array<string>(31).fill(f.source));
  let library = new ManagedCatalog(f.root, f.dependencies);
  let catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  expect(catalog.pads).toHaveLength(31);
  const pad = catalog.pads.at(0);
  if (!pad) throw new Error('missing pad');
  catalog = await library.updatePad({
    lease: f.lease,
    expectedRevision: 1,
    padId: pad.id,
    label: 'Intro',
    color: 'red',
  });
  catalog = await library.reorderPads({
    lease: f.lease,
    expectedRevision: 2,
    padIds: [...catalog.repertoire.padIds].reverse(),
  });
  rmSync(f.source);
  library.close();
  library = new ManagedCatalog(f.root, f.dependencies);
  expect(await library.getCatalog()).toEqual(catalog);
  expect(readFileSync(join(f.root, 'media', pad.assetId), 'utf8')).toBe(
    'audio bytes',
  );
  library.recover(f.lease);
  library.close();
});

it('keeps deletion cleanup durable when unlink fails and retries on restart', async () => {
  const f = setup();
  let library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const pad = catalog.pads.at(0);
  if (!pad) throw new Error('missing pad');
  const path = join(f.root, 'media', pad.assetId);
  rmSync(path);
  mkdirSync(path);
  await expect(
    library.deletePad({ lease: f.lease, expectedRevision: 1, padId: pad.id }),
  ).rejects.toMatchObject({ code: 'cleanup-required' });
  expect((await library.getCatalog()).pads).toEqual([]);
  library.close();
  rmSync(path, { recursive: true });
  library = new ManagedCatalog(f.root, f.dependencies);
  library.recover(f.lease);
  expect(readFileSync(f.source, 'utf8')).toBe('audio bytes');
  const observer = new CatalogStore(join(f.root, 'catalog.sqlite'));
  expect(observer.pending()).toEqual([]);
  observer.close();
  library.close();
});

it('never publishes failed copies or invalid audio and recovers staged files', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  rmSync(f.source);
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow();
  writeFileSync(f.source, 'bad');
  f.dependencies.validateAudio = () => Promise.resolve({ durationSeconds: 0 });
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toMatchObject({ code: 'unsupported-format' });
  expect((await library.getCatalog()).revision).toBe(0);
  library.recover(f.lease);
  library.close();
});

it('reports missing media, corruption and future versions without reset', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  for (const asset of catalog.assets) rmSync(join(f.root, 'media', asset.id));
  expect(() => {
    library.recover(f.lease);
  }).toThrow('corrupt-catalog');
  library.close();
  const path = join(f.root, 'catalog.sqlite');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA user_version = 2');
  db.close();
  expect(() => new CatalogStore(path)).toThrow('future-schema');
  writeFileSync(path, 'invalid database');
  expect(() => new CatalogStore(path)).toThrow('corrupt-catalog');
  expect(readFileSync(path, 'utf8')).toBe('invalid database');
});

it('rolls back publication on SQL failure and removes promoted orphans on recovery', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  const db = new DatabaseSync(join(f.root, 'catalog.sqlite'));
  db.exec(
    "CREATE TRIGGER fail_commit BEFORE UPDATE ON catalog BEGIN SELECT RAISE(ABORT, 'disk failure'); END",
  );
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow();
  expect((await library.getCatalog()).assets).toEqual([]);
  library.recover(f.lease);
  db.close();
  library.close();
});

it('reserves edits across selection and rejects stale revisions and revoked leases', async () => {
  const f = setup();
  let finish: (files: string[]) => void = () => {
    throw new Error('not waiting');
  };
  f.dependencies.selectFiles = () =>
    new Promise<string[]>((resolve) => {
      finish = resolve;
    });
  const library = new ManagedCatalog(f.root, f.dependencies);
  const pending = library.importAudio({ lease: f.lease, expectedRevision: 0 });
  expect(() => {
    library.recover(f.lease);
  }).toThrow('busy');
  expect(() => {
    library.close();
  }).toThrow('busy');
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toMatchObject({ code: 'busy' });
  f.dependencies.assertEditLease = () => {
    throw new Error('revoked');
  };
  finish([f.source]);
  await expect(pending).rejects.toThrow('revoked');
  f.dependencies.assertEditLease = () => undefined;
  expect((await library.getCatalog()).revision).toBe(0);
  await expect(
    library.reorderPads({ lease: f.lease, expectedRevision: 10, padIds: [] }),
  ).rejects.toMatchObject({ code: 'stale-revision' });
  library.close();
});

it('leaves a cancelled selection unchanged', async () => {
  const f = setup();
  f.dependencies.selectFiles = () => Promise.resolve([]);
  const library = new ManagedCatalog(f.root, f.dependencies);
  const before = await library.getCatalog();
  expect(
    await library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).toEqual(before);
  library.close();
});

it('atomically rejects publication from an outdated second connection', () => {
  const f = setup();
  const first = new CatalogStore(join(f.root, 'catalog.sqlite'));
  const second = new CatalogStore(join(f.root, 'catalog.sqlite'));
  const initial = first.read();
  first.commit({ ...initial, revision: 1 });
  expect(() => {
    second.commit({ ...initial, revision: 1 });
  }).toThrow('stale-revision');
  expect(second.read().revision).toBe(1);
  first.close();
  second.close();
});

it('quarantines unknown and staged files without following symlinks', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  writeFileSync(join(f.root, 'staging', 'partial'), 'partial');
  symlinkSync(f.source, join(f.root, 'media', 'unknown'));
  library.recover(f.lease);
  expect(readdirSync(join(f.root, 'media'))).toEqual([]);
  expect(readdirSync(join(f.root, 'staging'))).toEqual([]);
  const names = readdirSync(join(f.root, 'quarantine'));
  expect(names).toHaveLength(2);
  expect(readFileSync(f.source, 'utf8')).toBe('audio bytes');
  expect((await library.getCatalog()).revision).toBe(0);
  library.close();
});

it('rejects managed directory symlinks and referenced symlinks', async () => {
  const f = setup();
  symlinkSync(f.root, join(f.root, 'media'));
  expect(() => new ManagedCatalog(f.root, f.dependencies)).toThrow();
  rmSync(join(f.root, 'media'));
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const asset = catalog.assets.at(0);
  if (!asset) throw new Error('missing asset');
  const path = join(f.root, 'media', asset.id);
  rmSync(path);
  symlinkSync(f.source, path);
  expect(() => {
    library.recover(f.lease);
  }).toThrow('corrupt-catalog');
  library.close();
});

it('rejects unknown pads and invalid reorder without saving', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  const before = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  await expect(
    library.reorderPads({ lease: f.lease, expectedRevision: 1, padIds: [] }),
  ).rejects.toMatchObject({ code: 'invalid-request' });
  await expect(
    library.deletePad({
      lease: f.lease,
      expectedRevision: 1,
      padId: padIdSchema.parse(randomUUID()),
    }),
  ).rejects.toMatchObject({ code: 'not-found' });
  await expect(
    library.updatePad({
      lease: f.lease,
      expectedRevision: 1,
      padId: padIdSchema.parse(randomUUID()),
      label: 'x',
      color: 'blue',
    }),
  ).rejects.toMatchObject({ code: 'not-found' });
  expect(await library.getCatalog()).toEqual(before);
  library.close();
});

it('keeps the last commit after a relational constraint fails', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const store = new CatalogStore(join(f.root, 'catalog.sqlite'));
  expect(() => {
    store.commit({ ...catalog, revision: 2, assets: [] });
  }).toThrow();
  expect(store.read()).toEqual(catalog);
  store.close();
  library.close();
});

it('preserves metadata and quarantine bytes after a failed batch', async () => {
  const f = setup();
  f.dependencies.selectFiles = () =>
    Promise.resolve([f.source, join(f.root, 'absent')]);
  const library = new ManagedCatalog(f.root, f.dependencies);
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow();
  expect((await library.getCatalog()).assets).toEqual([]);
  library.recover(f.lease);
  const names = readdirSync(join(f.root, 'quarantine'));
  expect(names).toHaveLength(1);
  const name = names.at(0);
  if (!name) throw new Error('missing quarantine file');
  expect(readFileSync(join(f.root, 'quarantine', name), 'utf8')).toBe(
    'audio bytes',
  );
  library.close();
});

it('detects broken foreign keys without resetting existing bytes', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  await library.importAudio({ lease: f.lease, expectedRevision: 0 });
  library.close();
  const db = new DatabaseSync(join(f.root, 'catalog.sqlite'));
  db.exec('PRAGMA foreign_keys = OFF; DELETE FROM assets');
  db.close();
  expect(() => new CatalogStore(join(f.root, 'catalog.sqlite'))).toThrow(
    'corrupt-catalog',
  );
});

it('retries a completed deletion without touching the original', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const pad = catalog.pads.at(0);
  if (!pad) throw new Error('missing pad');
  const deleted = await library.deletePad({
    lease: f.lease,
    expectedRevision: 1,
    padId: pad.id,
  });
  expect(deleted.revision).toBe(2);
  expect(deleted.assets).toEqual([]);
  expect(deleted.repertoire.padIds).toEqual([]);
  expect(readdirSync(join(f.root, 'media'))).toEqual([]);
  library.recover(f.lease);
  expect(readFileSync(f.source, 'utf8')).toBe('audio bytes');
  library.close();
});

it.each([NaN, Infinity, -1])(
  'rejects invalid duration %s without publication',
  async (durationSeconds) => {
    const f = setup();
    f.dependencies.validateAudio = () => Promise.resolve({ durationSeconds });
    const library = new ManagedCatalog(f.root, f.dependencies);
    await expect(
      library.importAudio({ lease: f.lease, expectedRevision: 0 }),
    ).rejects.toMatchObject({ code: 'unsupported-format' });
    expect((await library.getCatalog()).revision).toBe(0);
    library.close();
  },
);

it('does not publish when validation or promotion fails', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  f.dependencies.validateAudio = () =>
    Promise.reject(new Error('decoder failed'));
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow();
  f.dependencies.validateAudio = () => {
    rmSync(join(f.root, 'media'), { recursive: true });
    return Promise.resolve({ durationSeconds: 1 });
  };
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow();
  expect((await library.getCatalog()).assets).toEqual([]);
  library.close();
});

it('retains shared assets until their last pad is removed', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const pad = catalog.pads.at(0);
  if (!pad) throw new Error('missing pad');
  const second = { ...pad, id: padIdSchema.parse(randomUUID()) };
  const store = new CatalogStore(join(f.root, 'catalog.sqlite'));
  store.commit({
    ...catalog,
    revision: 2,
    pads: [pad, second],
    repertoire: { ...catalog.repertoire, padIds: [pad.id, second.id] },
  });
  const result = await library.deletePad({
    lease: f.lease,
    expectedRevision: 2,
    padId: pad.id,
  });
  expect(result.pads).toEqual([second]);
  expect(result.assets).toEqual(catalog.assets);
  expect(result.repertoire.padIds).toEqual([second.id]);
  expect(readFileSync(join(f.root, 'media', pad.assetId), 'utf8')).toBe(
    'audio bytes',
  );
  store.close();
  library.close();
  expect(() => {
    store.read();
  }).toThrow();
  await expect(library.getCatalog()).rejects.toThrow();
});

it('rejects a lease before selection and after asynchronous validation', async () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  f.dependencies.assertEditLease = () => {
    throw new Error('revoked');
  };
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow('revoked');
  expect(readdirSync(join(f.root, 'staging'))).toEqual([]);
  f.dependencies.assertEditLease = () => undefined;
  f.dependencies.validateAudio = () => {
    f.dependencies.assertEditLease = () => {
      throw new Error('revoked');
    };
    return Promise.resolve({ durationSeconds: 1 });
  };
  await expect(
    library.importAudio({ lease: f.lease, expectedRevision: 0 }),
  ).rejects.toThrow('revoked');
  expect(readdirSync(join(f.root, 'media'))).toEqual([]);
  library.close();
});

it('rejects duplicate and foreign pad orders', async () => {
  const f = setup();
  f.dependencies.selectFiles = () => Promise.resolve([f.source, f.source]);
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const first = catalog.repertoire.padIds.at(0);
  if (!first) throw new Error('missing pad');
  for (const padIds of [
    [first, first],
    [first, padIdSchema.parse(randomUUID())],
  ]) {
    await expect(
      library.reorderPads({ lease: f.lease, expectedRevision: 1, padIds }),
    ).rejects.toMatchObject({ code: 'invalid-request' });
  }
  expect(await library.getCatalog()).toEqual(catalog);
  library.close();
});

it('reports inaccessible database paths and failed migrations without resetting', () => {
  const f = setup();
  expect(
    () => new CatalogStore(join(f.root, 'absent', 'catalog.sqlite')),
  ).toThrow('corrupt-catalog');
  const path = join(f.root, 'broken.sqlite');
  const db = new DatabaseSync(path);
  db.exec(
    "CREATE TABLE assets (preserved TEXT); INSERT INTO assets VALUES ('keep')",
  );
  expect(() => new CatalogStore(path)).toThrow('corrupt-catalog');
  expect(db.prepare('PRAGMA user_version').get()).toMatchObject({
    user_version: 0,
  });
  expect(db.prepare('SELECT preserved FROM assets').all()).toEqual([
    { preserved: 'keep' },
  ]);
  db.exec('DROP TABLE assets');
  const repaired = new CatalogStore(path);
  expect(repaired.read().revision).toBe(0);
  repaired.close();
  db.close();
});

it('reports corruption introduced after open', () => {
  const f = setup();
  const path = join(f.root, 'catalog.sqlite');
  const store = new CatalogStore(path);
  const db = new DatabaseSync(path);
  db.exec('DELETE FROM catalog');
  expect(() => {
    store.read();
  }).toThrow('corrupt-catalog');
  store.close();
  db.close();
});

it('persists cleanup intent with deletion and acknowledges only completed work', () => {
  const f = setup();
  const store = new CatalogStore(join(f.root, 'catalog.sqlite'));
  const initial = store.read();
  const name = randomUUID();
  store.commit({ ...initial, revision: 1 }, [name]);
  expect(store.pending()).toEqual([name]);
  store.close();
  const reopened = new CatalogStore(join(f.root, 'catalog.sqlite'));
  expect(reopened.pending()).toEqual([name]);
  reopened.cleaned(name);
  expect(reopened.pending()).toEqual([]);
  reopened.close();
});

it('deletes one asset while retaining another', async () => {
  const f = setup();
  f.dependencies.selectFiles = () => Promise.resolve([f.source, f.source]);
  const library = new ManagedCatalog(f.root, f.dependencies);
  const catalog = await library.importAudio({
    lease: f.lease,
    expectedRevision: 0,
  });
  const first = catalog.pads.at(0);
  const second = catalog.pads.at(1);
  if (!first || !second) throw new Error('missing pads');
  const result = await library.deletePad({
    lease: f.lease,
    expectedRevision: 1,
    padId: first.id,
  });
  expect(result.assets.map((asset) => asset.id)).toEqual([second.assetId]);
  expect(result.pads).toEqual([second]);
  const observer = new CatalogStore(join(f.root, 'catalog.sqlite'));
  expect(observer.pending()).toEqual([]);
  observer.close();
  library.close();
});

it('refuses recovery with a revoked lease', () => {
  const f = setup();
  const library = new ManagedCatalog(f.root, f.dependencies);
  writeFileSync(join(f.root, 'staging', 'partial'), 'keep');
  f.dependencies.assertEditLease = () => {
    throw new Error('revoked');
  };
  expect(() => {
    library.recover(f.lease);
  }).toThrow('revoked');
  expect(readFileSync(join(f.root, 'staging', 'partial'), 'utf8')).toBe('keep');
  library.close();
});

it.skipIf(process.platform !== 'linux')(
  'releases the database descriptor after initialization failure',
  () => {
    const f = setup();
    const path = join(f.root, 'catalog.sqlite');
    const db = new DatabaseSync(path);
    db.exec('PRAGMA user_version = 2');
    db.close();
    expect(() => new CatalogStore(path)).toThrow('future-schema');
    const opened = readdirSync('/proc/self/fd').flatMap((name) => {
      try {
        return [readlinkSync(join('/proc/self/fd', name))];
      } catch {
        return [];
      }
    });
    expect(opened).not.toContain(path);
  },
);
