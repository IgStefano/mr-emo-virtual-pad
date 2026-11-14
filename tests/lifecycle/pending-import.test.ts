import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { attemptIdSchema } from '../../src/contracts/catalog';
import { LeaseKind } from '../../src/contracts/operations';
import { SessionAuthority } from '../../src/main/ipc/authority';
import { CatalogSessionService } from '../../src/main/ipc/catalog-session';
import { RendererLifetime } from '../../src/main/ipc/renderer-lifetime';
import { ManagedCatalog } from '../../src/main/library/managed-catalog';

it('finishes an in-flight managed copy before releasing its session and closing SQLite', async () => {
  const root = await mkdtemp(join(tmpdir(), 'a2-import-'));
  const source = join(root, 'original');
  await writeFile(source, 'original audio');
  const authority = new SessionAuthority();
  let finish: () => void = () => {};
  let staged: () => void = () => {};
  const validation = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    staged = resolve;
  });
  const dependencies = {
    assertEditLease: authority.assert.bind(authority),
    selectFiles: () => Promise.resolve([source]),
    validateAudio: async () => {
      staged();
      await validation;
      return { durationSeconds: 12 };
    },
  };
  let catalog = new ManagedCatalog(join(root, 'library'), dependencies);
  const service = new CatalogSessionService({
    authority,
    catalog,
    onPlaybackReleased: () => Promise.resolve(),
  });
  const lifetime = new RendererLifetime(
    service.closeAfterRendererTermination.bind(service),
  );
  try {
    const sessionId = await service.openSession();
    await lifetime.run('catalog:open', () =>
      Promise.resolve({ ok: true, value: sessionId }),
    );
    const lease = await service.acquire({
      sessionId,
      kind: LeaseKind.Edit,
      attemptId: attemptIdSchema.parse(1),
    });
    const importing = lifetime.run('catalog:import', () =>
      service.importAudio({
        lease: { ...lease, kind: LeaseKind.Edit },
        expectedRevision: 0,
      }),
    );
    await ready;
    let closed = false;
    const shutdown = lifetime.terminate().then(() => {
      catalog.close();
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    finish();
    await importing;
    await shutdown;
    expect(closed).toBe(true);
    catalog = new ManagedCatalog(join(root, 'library'), dependencies);
    const reopened = await catalog.getCatalog();
    expect(reopened.pads).toHaveLength(1);
    const asset = reopened.assets.at(0);
    if (!asset) throw new Error('missing imported asset');
    expect(
      await readFile(join(root, 'library', 'media', asset.id), 'utf8'),
    ).toBe('original audio');
    expect(await readFile(source, 'utf8')).toBe('original audio');
    const next = await authority.open(() => Promise.resolve());
    authority.close(next);
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});
