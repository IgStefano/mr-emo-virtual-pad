import { basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { assetIdSchema, padIdSchema, PadColor } from '../../contracts/catalog';
import type { Catalog } from '../../contracts/catalog';
import {
  deletePadSchema,
  editRequestSchema,
  ErrorCode,
  reorderPadsSchema,
  updatePadSchema,
} from '../../contracts/operations';
import type { CatalogOperations, Lease } from '../../contracts/operations';
import { CatalogFault, CatalogStore } from '../storage/catalog-store';
import { ManagedFiles } from '../storage/managed-files';

type EditRequest = Parameters<CatalogOperations['importAudio']>[0];
export interface LibraryDependencies {
  assertEditLease: (lease: Lease) => void;
  selectFiles: () => Promise<string[]>;
  validateAudio: (path: string) => Promise<{ durationSeconds: number }>;
}

export class ManagedCatalog implements CatalogOperations {
  private readonly store: CatalogStore;
  private busy = false;
  private readonly files: ManagedFiles;
  constructor(
    root: string,
    private readonly dependencies: LibraryDependencies,
  ) {
    this.files = new ManagedFiles(root);
    this.store = new CatalogStore(this.files.databasePath);
  }

  getCatalog = (): Promise<Catalog> =>
    Promise.resolve().then(() => this.store.read());

  private async edit(
    request: EditRequest,
    action: (catalog: Catalog) => Promise<Catalog>,
  ): Promise<Catalog> {
    this.dependencies.assertEditLease(request.lease);
    if (this.busy) throw new CatalogFault(ErrorCode.Busy);
    this.busy = true;
    try {
      const catalog = this.store.read();
      if (catalog.revision !== request.expectedRevision)
        throw new CatalogFault(ErrorCode.StaleRevision);
      return await action(catalog);
    } finally {
      this.busy = false;
    }
  }

  importAudio = async (input: EditRequest): Promise<Catalog> => {
    const request = editRequestSchema.parse(input);
    return this.edit(request, async (catalog) => {
      const files = await this.dependencies.selectFiles();
      if (files.length === 0) return catalog;
      for (const source of files) {
        const id = assetIdSchema.parse(randomUUID());
        const staged = await this.files.stage(source, id);
        const audio = await this.dependencies.validateAudio(staged);
        if (
          !Number.isFinite(audio.durationSeconds) ||
          audio.durationSeconds <= 0
        )
          throw new CatalogFault(ErrorCode.UnsupportedFormat);
        this.dependencies.assertEditLease(request.lease);
        this.files.promote(id);
        const padId = padIdSchema.parse(randomUUID());
        catalog.assets.push({
          id,
          name: basename(source),
          durationSeconds: audio.durationSeconds,
        });
        catalog.pads.push({
          id: padId,
          assetId: id,
          label: basename(source),
          color: PadColor.Slate,
        });
        catalog.repertoire.padIds.push(padId);
      }
      catalog.revision++;
      this.store.commit(catalog);
      return catalog;
    });
  };

  updatePad: CatalogOperations['updatePad'] = async (input) => {
    const request = updatePadSchema.parse(input);
    return this.edit(request, (catalog) => {
      const pad = catalog.pads.find((item) => item.id === request.padId);
      if (!pad) throw new CatalogFault(ErrorCode.NotFound);
      pad.label = request.label;
      pad.color = request.color;
      catalog.revision++;
      this.store.commit(catalog);
      return Promise.resolve(catalog);
    });
  };

  reorderPads: CatalogOperations['reorderPads'] = async (input) => {
    const request = reorderPadsSchema.parse(input);
    return this.edit(request, (catalog) => {
      if (
        [...request.padIds].sort().join() !==
        catalog.pads
          .map((pad) => pad.id)
          .sort()
          .join()
      )
        throw new CatalogFault(ErrorCode.InvalidRequest);
      catalog.repertoire.padIds = request.padIds;
      catalog.revision++;
      this.store.commit(catalog);
      return Promise.resolve(catalog);
    });
  };

  deletePad: CatalogOperations['deletePad'] = async (input) => {
    const request = deletePadSchema.parse(input);
    return this.edit(request, (catalog) => {
      const pad = catalog.pads.find((item) => item.id === request.padId);
      if (!pad) throw new CatalogFault(ErrorCode.NotFound);
      catalog.pads = catalog.pads.filter((item) => item.id !== pad.id);
      catalog.repertoire.padIds = catalog.repertoire.padIds.filter(
        (id) => id !== pad.id,
      );
      const unused = !catalog.pads.some((item) => item.assetId === pad.assetId);
      if (unused)
        catalog.assets = catalog.assets.filter(
          (asset) => asset.id !== pad.assetId,
        );
      catalog.revision++;
      this.store.commit(catalog, unused ? [pad.assetId] : []);
      this.cleanup();
      return Promise.resolve(catalog);
    });
  };

  private cleanup(): void {
    try {
      for (const name of this.store.pending()) {
        this.files.remove(name);
        this.store.cleaned(name);
      }
    } catch {
      throw new CatalogFault(ErrorCode.CleanupRequired);
    }
  }

  recover(lease: Lease): void {
    this.dependencies.assertEditLease(lease);
    if (this.busy) throw new CatalogFault(ErrorCode.Busy);
    this.cleanup();
    const catalog = this.store.read();
    this.files.recover(catalog.assets.map((asset) => asset.id));
  }

  close(): void {
    if (this.busy) throw new CatalogFault(ErrorCode.Busy);
    this.store.close();
  }
}
