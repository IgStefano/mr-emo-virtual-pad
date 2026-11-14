import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { catalogSchema, repertoireIdSchema } from '../../contracts/catalog';
import type { Catalog } from '../../contracts/catalog';
import { ErrorCode } from '../../contracts/operations';

export class CatalogFault extends Error {
  constructor(readonly code: (typeof ErrorCode)[keyof typeof ErrorCode]) {
    super(code);
  }
}

export class CatalogStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    try {
      this.db = new DatabaseSync(path);
    } catch {
      throw new CatalogFault(ErrorCode.CorruptCatalog);
    }
    try {
      const version = z
        .object({ user_version: z.number() })
        .parse(this.db.prepare('PRAGMA user_version').get()).user_version;
      if (version > 1) throw new CatalogFault(ErrorCode.FutureSchema);
      if (version === 0) {
        this.db.exec('BEGIN IMMEDIATE');
        this.db.exec(`
            CREATE TABLE catalog (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision >= 0), repertoireId TEXT NOT NULL UNIQUE, name TEXT NOT NULL CHECK(length(name)>0));
            CREATE TABLE assets (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK(length(name)>0), durationSeconds REAL NOT NULL CHECK(durationSeconds>0));
            CREATE TABLE pads (id TEXT PRIMARY KEY NOT NULL, assetId TEXT NOT NULL REFERENCES assets(id), label TEXT NOT NULL CHECK(length(label)>0), color TEXT NOT NULL CHECK(color IN ('slate','red','blue','green','amber')), position INTEGER NOT NULL UNIQUE CHECK(position>=0));
            CREATE TABLE cleanup (name TEXT PRIMARY KEY NOT NULL);
            PRAGMA user_version = 1;
          `);
        this.db
          .prepare('INSERT INTO catalog VALUES (1, 0, ?, ?)')
          .run(repertoireIdSchema.parse(randomUUID()), 'Repertoire');
        this.db.exec('COMMIT');
      }
      this.read();
    } catch (error) {
      this.db.close();
      if (error instanceof CatalogFault) throw error;
      throw new CatalogFault(ErrorCode.CorruptCatalog);
    }
  }

  read(): Catalog {
    try {
      if (this.db.prepare('PRAGMA foreign_key_check').all().length !== 0)
        throw new CatalogFault(ErrorCode.CorruptCatalog);
      const row = z
        .object({
          revision: z.number(),
          repertoireId: z.string(),
          name: z.string(),
        })
        .parse(
          this.db
            .prepare(
              'SELECT revision, repertoireId, name FROM catalog WHERE id = 1',
            )
            .get(),
        );
      const pads = this.db
        .prepare('SELECT id, assetId, label, color FROM pads ORDER BY rowid')
        .all();
      const catalog = catalogSchema.parse({
        schemaVersion: 1,
        revision: row.revision,
        assets: this.db
          .prepare(
            'SELECT id, name, durationSeconds FROM assets ORDER BY rowid',
          )
          .all(),
        pads,
        repertoire: {
          id: row.repertoireId,
          name: row.name,
          padIds: this.db
            .prepare('SELECT id FROM pads ORDER BY position')
            .all()
            .map((pad) => pad.id),
        },
      });
      return catalog;
    } catch {
      throw new CatalogFault(ErrorCode.CorruptCatalog);
    }
  }

  commit(catalog: Catalog, cleanup: string[] = []): void {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const changed = this.db
        .prepare(
          'UPDATE catalog SET revision = ?, repertoireId = ?, name = ? WHERE id = 1 AND revision = ?',
        )
        .run(
          catalog.revision,
          catalog.repertoire.id,
          catalog.repertoire.name,
          catalog.revision - 1,
        );
      if (changed.changes !== 1)
        throw new CatalogFault(ErrorCode.StaleRevision);
      this.db.exec('DELETE FROM pads; DELETE FROM assets');
      for (const asset of catalog.assets)
        this.db
          .prepare('INSERT INTO assets VALUES (?, ?, ?)')
          .run(asset.id, asset.name, asset.durationSeconds);
      for (const pad of catalog.pads)
        this.db
          .prepare('INSERT INTO pads VALUES (?, ?, ?, ?, ?)')
          .run(
            pad.id,
            pad.assetId,
            pad.label,
            pad.color,
            catalog.repertoire.padIds.indexOf(pad.id),
          );
      for (const name of cleanup)
        this.db.prepare('INSERT OR IGNORE INTO cleanup VALUES (?)').run(name);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  pending(): string[] {
    return z
      .array(z.object({ name: z.uuid() }))
      .parse(this.db.prepare('SELECT name FROM cleanup').all())
      .map((row) => row.name);
  }

  cleaned(name: string): void {
    this.db.prepare('DELETE FROM cleanup WHERE name = ?').run(name);
  }
  close(): void {
    this.db.close();
  }
}
