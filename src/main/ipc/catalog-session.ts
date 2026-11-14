import type { AssetId, LeaseId, SessionId } from '../../contracts/catalog';
import type { desktopOperations } from '../../contracts/desktop';
import type { z } from 'zod';
import { ErrorCode, LeaseKind } from '../../contracts/operations';
import type { CatalogOperations, Lease } from '../../contracts/operations';
import { CatalogFault } from '../storage/catalog-store';
import type { SessionAuthority } from './authority';

type Request<K extends keyof typeof desktopOperations> = z.output<
  (typeof desktopOperations)[K]['request']
>;

type Dependencies = {
  authority: SessionAuthority;
  catalog: CatalogOperations & {
    recover: (lease: Lease) => void | Promise<void>;
  };
  onPlaybackReleased: (leaseId: LeaseId) => Promise<void>;
};
export class CatalogSessionService {
  private session: SessionId | null = null;
  private lease: Lease | null = null;
  private closing = false;
  private readonly pending = new Set<Promise<unknown>>();
  constructor(private readonly dependencies: Dependencies) {}
  private check(sessionId: SessionId): void {
    if (this.session !== sessionId || this.closing)
      throw new CatalogFault(ErrorCode.Unauthorized);
  }
  private track<T>(action: () => Promise<T>): Promise<T> {
    if (this.pending.size) throw new CatalogFault(ErrorCode.Busy);
    const work = Promise.resolve().then(action);
    this.pending.add(work);
    return work.finally(() => {
      this.pending.delete(work);
    });
  }
  openSession = async (): Promise<SessionId> => {
    return this.track(async () => {
      const session = await this.dependencies.authority.open(async (lease) => {
        await this.dependencies.catalog.recover(lease);
      });
      this.session = session;
      return session;
    });
  };
  getCatalog = async (request: Request<'getCatalog'>) => {
    this.check(request.sessionId);
    return this.track(() => this.dependencies.catalog.getCatalog());
  };
  acquire = async (request: Request<'acquire'>) => {
    this.check(request.sessionId);
    if (this.pending.size) throw new CatalogFault(ErrorCode.Busy);
    const lease = this.dependencies.authority.reserve(
      request.sessionId,
      request.kind,
      request.attemptId,
    );
    this.lease = lease;
    return await Promise.resolve({ ...lease, kind: request.kind });
  };
  release = async (lease: Request<'release'>) => {
    this.check(lease.sessionId);
    this.dependencies.authority.assert(lease);
    await this.track(async () => {
      if (lease.kind === LeaseKind.Playback)
        await this.dependencies.onPlaybackReleased(lease.leaseId);
      this.dependencies.authority.release(lease);
      this.lease = null;
    });
    return null;
  };
  disposeSession = async ({ sessionId }: Request<'disposeSession'>) => {
    this.check(sessionId);
    if (this.pending.size || this.lease) throw new CatalogFault(ErrorCode.Busy);
    this.dependencies.authority.close(sessionId);
    this.session = null;
    return await Promise.resolve(null);
  };
  private edit<T>(lease: Lease, action: () => Promise<T>): Promise<T> {
    this.check(lease.sessionId);
    this.dependencies.authority.assert(lease);
    return this.track(action);
  }
  importAudio = (request: Parameters<CatalogOperations['importAudio']>[0]) =>
    this.edit(request.lease, () =>
      this.dependencies.catalog.importAudio(request),
    );
  updatePad = (request: Parameters<CatalogOperations['updatePad']>[0]) =>
    this.edit(request.lease, () =>
      this.dependencies.catalog.updatePad(request),
    );
  reorderPads = (request: Parameters<CatalogOperations['reorderPads']>[0]) =>
    this.edit(request.lease, () =>
      this.dependencies.catalog.reorderPads(request),
    );
  deletePad = (request: Parameters<CatalogOperations['deletePad']>[0]) =>
    this.edit(request.lease, () =>
      this.dependencies.catalog.deletePad(request),
    );
  async authorizeMedia(assetId: AssetId, leaseId: LeaseId): Promise<void> {
    const lease = this.lease;
    if (
      !lease ||
      lease.kind !== LeaseKind.Playback ||
      lease.leaseId !== leaseId
    )
      throw new CatalogFault(ErrorCode.Unauthorized);
    const catalog = await this.getCatalog({ sessionId: lease.sessionId });
    this.check(lease.sessionId);
    if (!catalog.assets.some((asset) => asset.id === assetId))
      throw new CatalogFault(ErrorCode.NotFound);
  }
  async closeAfterRendererTermination(sessionId: SessionId): Promise<void> {
    if (sessionId !== this.session)
      throw new CatalogFault(ErrorCode.Unauthorized);
    this.closing = true;
    await Promise.allSettled(this.pending);
    const lease = this.lease;
    if (lease) {
      if (lease.kind === LeaseKind.Playback)
        await this.dependencies.onPlaybackReleased(lease.leaseId);
      this.lease = null;
    }
    this.dependencies.authority.close(sessionId);
    this.session = null;
    this.closing = false;
  }
}
