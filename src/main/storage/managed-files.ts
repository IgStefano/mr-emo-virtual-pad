import { copyFile } from 'node:fs/promises';
import { mkdirSync, readdirSync, renameSync, rmSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ErrorCode } from '../../contracts/operations';
import { CatalogFault } from './catalog-store';

export class ManagedFiles {
  readonly databasePath: string;
  constructor(private readonly root: string) {
    for (const directory of ['media', 'staging', 'quarantine']) {
      const path = join(root, directory);
      mkdirSync(path, { recursive: true });
      if (!lstatSync(path).isDirectory())
        throw new CatalogFault(ErrorCode.CorruptCatalog);
    }
    this.databasePath = join(root, 'catalog.sqlite');
  }
  async stage(source: string, id: string): Promise<string> {
    const path = join(this.root, 'staging', id);
    await copyFile(source, path);
    return path;
  }
  promote(id: string): void {
    renameSync(join(this.root, 'staging', id), join(this.root, 'media', id));
  }
  remove(id: string): void {
    rmSync(join(this.root, 'media', id), { force: true });
  }
  recover(ids: string[]): void {
    for (const name of readdirSync(join(this.root, 'staging')))
      this.quarantine('staging', name);
    for (const name of readdirSync(join(this.root, 'media'))) {
      if (!ids.includes(name)) this.quarantine('media', name);
    }
    for (const id of ids) {
      try {
        if (!lstatSync(join(this.root, 'media', id)).isFile())
          throw new CatalogFault(ErrorCode.CorruptCatalog);
      } catch {
        throw new CatalogFault(ErrorCode.CorruptCatalog);
      }
    }
  }
  private quarantine(directory: string, name: string): void {
    renameSync(
      join(this.root, directory, name),
      join(this.root, 'quarantine', randomUUID()),
    );
  }
}
