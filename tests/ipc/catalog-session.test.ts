import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import {
  assetIdSchema,
  leaseIdSchema,
  sessionIdSchema,
  attemptIdSchema,
} from '../../src/contracts/catalog';
import { LeaseKind } from '../../src/contracts/operations';
import { SessionAuthority } from '../../src/main/ipc/authority';
import { CatalogSessionService } from '../../src/main/ipc/catalog-session';
import { validateAudio } from '../../src/main/storage/audio-metadata';
import { ManagedCatalog } from '../../src/main/library/managed-catalog';
import { createDesktopApi } from '../../src/preload/desktop-bridge';
import { registerDesktopIpc } from '../../src/main/ipc/desktop';
import type { SenderEvent } from '../../src/main/ipc/desktop';

it('runs a real copied catalog through the finite registered bridge and retains failed cleanup authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-'));
  const source = join(root, 'source.wav');
  const bytes = Buffer.alloc(44 + 192000);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(48000, 24);
  bytes.writeUInt32LE(192000, 28);
  bytes.writeUInt16LE(4, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(192000, 40);
  await writeFile(source, bytes);
  const authority = new SessionAuthority();
  let selected: string[] = [source];
  let cleanupFails = true;
  const catalog = new ManagedCatalog(join(root, 'managed'), {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => Promise.resolve(selected),
    validateAudio,
  });
  const service = new CatalogSessionService({
    authority,
    catalog,
    onPlaybackReleased: () =>
      cleanupFails ? Promise.reject(new Error('cleanup')) : Promise.resolve(),
  });
  const handlers = new Map<
    string,
    (event: SenderEvent, payload: unknown) => Promise<unknown>
  >();
  const sender = {};
  const mainFrame = {};
  let url = 'pad-app://app/index.html';
  registerDesktopIpc(
    {
      handle: (channel, handler) => {
        handlers.set(channel, handler);
      },
    },
    service,
    { sender, mainFrame, getURL: () => url, url },
  );
  const invoke = (channel: string, payload?: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) throw new Error('missing channel');
    return handler({ sender, senderFrame: mainFrame }, payload);
  };
  const api = createDesktopApi(invoke);
  try {
    const opened = await api.openSession(null);
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw new Error('open failed');
    const sessionId = opened.value;
    const attemptId = attemptIdSchema.parse(2);
    const acquired = await api.acquire({
      sessionId,
      attemptId,
      kind: LeaseKind.Edit,
    });
    if (!acquired.ok) throw new Error('acquire failed');
    const lease = { ...acquired.value, kind: LeaseKind.Edit };
    expect(
      await api.acquire({ sessionId, attemptId, kind: LeaseKind.Playback }),
    ).toMatchObject({ error: { code: 'busy' } });
    const imported = await api.importAudio({ lease, expectedRevision: 0 });
    if (!imported.ok) throw new Error('import failed');
    expect(imported.value.assets).toHaveLength(1);
    const pad = imported.value.pads.at(0);
    if (!pad) throw new Error('missing pad');
    const updated = await api.updatePad({
      lease,
      expectedRevision: 1,
      padId: pad.id,
      label: 'new',
      color: 'red',
    });
    if (!updated.ok) throw new Error('update failed');
    expect(updated.value.pads.at(0)?.label).toBe('new');
    const reordered = await api.reorderPads({
      lease,
      expectedRevision: 2,
      padIds: [pad.id],
    });
    if (!reordered.ok) throw new Error('reorder failed');
    expect(reordered.value.revision).toBe(3);
    selected = [];
    expect(await api.importAudio({ lease, expectedRevision: 3 })).toEqual(
      reordered,
    );
    expect(await api.importAudio({ lease, expectedRevision: 0 })).toMatchObject(
      { error: { code: 'stale-revision' } },
    );
    expect(await api.disposeSession({ sessionId })).toMatchObject({
      error: { code: 'busy' },
    });
    expect(await api.release(lease)).toEqual({ ok: true, value: null });
    const playing = await api.acquire({
      sessionId,
      attemptId,
      kind: LeaseKind.Playback,
    });
    if (!playing.ok) throw new Error('play failed');
    const asset = imported.value.assets.at(0);
    if (!asset) throw new Error('missing asset');
    expect(await readFile(join(root, 'managed', 'media', asset.id))).toEqual(
      bytes,
    );
    expect(await readFile(source)).toEqual(bytes);
    expect(asset.durationSeconds).toBe(1);
    await expect(
      service.authorizeMedia(asset.id, playing.value.leaseId),
    ).resolves.toBeUndefined();
    await expect(
      Promise.all([
        service.authorizeMedia(asset.id, playing.value.leaseId),
        service.authorizeMedia(asset.id, playing.value.leaseId),
      ]),
    ).resolves.toEqual([undefined, undefined]);
    const refresh = api.getCatalog({ sessionId });
    expect(await api.release(playing.value)).toMatchObject({
      error: { code: 'storage-failure' },
    });
    expect(
      await api.acquire({ sessionId, attemptId, kind: LeaseKind.Edit }),
    ).toMatchObject({ error: { code: 'busy' } });
    await expect(
      service.authorizeMedia(
        asset.id,
        leaseIdSchema.parse('00000000-0000-4000-8000-000000000001'),
      ),
    ).rejects.toThrow('unauthorized');
    await expect(
      service.authorizeMedia(
        assetIdSchema.parse('00000000-0000-4000-8000-000000000001'),
        playing.value.leaseId,
      ),
    ).rejects.toThrow('not-found');
    await refresh;
    cleanupFails = false;
    const finalRefresh = api.getCatalog({ sessionId });
    expect(await api.release(playing.value)).toEqual({ ok: true, value: null });
    await expect(
      service.authorizeMedia(asset.id, playing.value.leaseId),
    ).rejects.toThrow('unauthorized');
    await finalRefresh;
    const read = handlers.get('catalog:read');
    if (!read) throw new Error('missing handler');
    expect(
      await read({ sender: {}, senderFrame: mainFrame }, {}),
    ).toMatchObject({ error: { code: 'unauthorized' } });
    expect(await read({ sender, senderFrame: {} }, {})).toMatchObject({
      error: { code: 'unauthorized' },
    });
    expect(await read({ sender, senderFrame: mainFrame }, {})).toMatchObject({
      error: { code: 'invalid-request' },
    });
    expect(
      await api.getCatalog({
        sessionId: sessionIdSchema.parse(
          '00000000-0000-4000-8000-000000000001',
        ),
      }),
    ).toMatchObject({ error: { code: 'unauthorized' } });
    const deleting = await api.acquire({
      sessionId,
      attemptId,
      kind: LeaseKind.Edit,
    });
    if (!deleting.ok) throw new Error('delete lease failed');
    expect(
      await api.deletePad({
        lease: { ...deleting.value, kind: LeaseKind.Edit },
        expectedRevision: 3,
        padId: pad.id,
      }),
    ).toMatchObject({ ok: true, value: { pads: [], revision: 4 } });
    await api.release(deleting.value);
    url = 'https://forged';
    expect(await api.getCatalog({ sessionId })).toMatchObject({
      error: { code: 'unauthorized' },
    });
    url = 'pad-app://app/index.html';
    expect(await api.disposeSession({ sessionId })).toEqual({
      ok: true,
      value: null,
    });
    expect(await api.getCatalog({ sessionId })).toMatchObject({
      error: { code: 'unauthorized' },
    });
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('reserves before dialog and drains terminated pending import before replacement', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-drain-'));
  const authority = new SessionAuthority();
  let resolveDialog: (files: string[]) => void = () => {
    throw new Error('dialog not initialized');
  };
  const dialog = new Promise<string[]>((resolve) => {
    resolveDialog = resolve;
  });
  let dialogOpened = false;
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => {
      dialogOpened = true;
      return dialog;
    },
    validateAudio: () => Promise.resolve({ durationSeconds: 1 }),
  });
  const service = new CatalogSessionService({
    authority,
    catalog,
    onPlaybackReleased: () => Promise.resolve(),
  });
  try {
    const sessionId = await service.openSession();
    const lease = await service.acquire({
      sessionId,
      kind: LeaseKind.Edit,
      attemptId: attemptIdSchema.parse(1),
    });
    const editLease = { ...lease, kind: LeaseKind.Edit };
    const pending = service.importAudio({
      lease: editLease,
      expectedRevision: 0,
    });
    await Promise.resolve();
    expect(dialogOpened).toBe(true);
    await expect(service.getCatalog({ sessionId })).rejects.toThrow('busy');
    await expect(service.release(lease)).rejects.toThrow('busy');
    await expect(service.disposeSession({ sessionId })).rejects.toThrow('busy');
    const closing = service.closeAfterRendererTermination(sessionId);
    await expect(service.openSession()).rejects.toThrow('busy');
    await expect(service.getCatalog({ sessionId })).rejects.toThrow(
      'unauthorized',
    );
    resolveDialog([]);
    expect((await pending).revision).toBe(0);
    await closing;
    const next = await service.openSession();
    expect(next).not.toBe(sessionId);
    await expect(service.release(lease)).rejects.toThrow('unauthorized');
    await service.disposeSession({ sessionId: next });
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps terminated playback closed on cleanup failure and retries before reopening', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-close-'));
  const authority = new SessionAuthority();
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => Promise.resolve([]),
    validateAudio: () => Promise.resolve({ durationSeconds: 1 }),
  });
  let fail = true;
  const released: string[] = [];
  const service = new CatalogSessionService({
    authority,
    catalog,
    onPlaybackReleased: (id) => {
      released.push(id);
      return fail ? Promise.reject(new Error('cleanup')) : Promise.resolve();
    },
  });
  try {
    const sessionId = await service.openSession();
    const lease = await service.acquire({
      sessionId,
      kind: LeaseKind.Playback,
      attemptId: attemptIdSchema.parse(1),
    });
    await expect(
      service.authorizeMedia(
        assetIdSchema.parse('00000000-0000-4000-8000-000000000001'),
        lease.leaseId,
      ),
    ).rejects.toThrow('not-found');
    await expect(
      service.closeAfterRendererTermination(
        sessionIdSchema.parse('00000000-0000-4000-8000-000000000001'),
      ),
    ).rejects.toThrow('unauthorized');
    await expect(
      service.closeAfterRendererTermination(sessionId),
    ).rejects.toThrow('cleanup');
    await expect(service.openSession()).rejects.toThrow('busy');
    await expect(service.release(lease)).rejects.toThrow('unauthorized');
    fail = false;
    await service.closeAfterRendererTermination(sessionId);
    await expect(service.getCatalog({ sessionId })).rejects.toThrow(
      'unauthorized',
    );
    const empty = await service.openSession();
    await service.disposeSession({ sessionId: empty });
    expect(released).toEqual([lease.leaseId, lease.leaseId]);
    const next = await service.openSession();
    const edit = await service.acquire({
      sessionId: next,
      kind: LeaseKind.Edit,
      attemptId: attemptIdSchema.parse(2),
    });
    await expect(
      service.authorizeMedia(
        assetIdSchema.parse('00000000-0000-4000-8000-000000000001'),
        edit.leaseId,
      ),
    ).rejects.toThrow('unauthorized');
    await service.closeAfterRendererTermination(next);
    const idle = await service.openSession();
    await service.closeAfterRendererTermination(idle);
    await expect(service.getCatalog({ sessionId: idle })).rejects.toThrow(
      'unauthorized',
    );
    const replacement = await service.openSession();
    await service.disposeSession({ sessionId: replacement });
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('validates service responses before they leave main', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-output-'));
  const authority = new SessionAuthority();
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => Promise.resolve([]),
    validateAudio: () => Promise.resolve({ durationSeconds: 1 }),
  });
  const service = new CatalogSessionService({
    authority,
    catalog: {
      getCatalog: async () => ({
        ...(await catalog.getCatalog()),
        revision: -1,
      }),
      importAudio: catalog.importAudio,
      updatePad: catalog.updatePad,
      reorderPads: catalog.reorderPads,
      deletePad: catalog.deletePad,
      recover: (lease) => {
        catalog.recover(lease);
      },
    },
    onPlaybackReleased: () => Promise.resolve(),
  });
  const sender = {};
  const mainFrame = {};
  const handlers = new Map<
    string,
    (event: SenderEvent, payload: unknown) => Promise<unknown>
  >();
  registerDesktopIpc(
    {
      handle: (channel, handler) => {
        handlers.set(channel, handler);
      },
    },
    service,
    { sender, mainFrame, getURL: () => 'local', url: 'local' },
  );
  try {
    const sessionId = await service.openSession();
    const handler = handlers.get('catalog:read');
    if (!handler) throw new Error('missing read');
    expect(
      await handler({ sender, senderFrame: mainFrame }, { sessionId }),
    ).toEqual({ ok: false, error: { code: 'invalid-request' } });
    await service.disposeSession({ sessionId });
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects privileged catalog calls before invoking ports and gates acquisitions during pending reads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-ports-'));
  const authority = new SessionAuthority();
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => Promise.resolve([]),
    validateAudio: () => Promise.resolve({ durationSeconds: 1 }),
  });
  let cleanupCalls = 0;
  let editCalls = 0;
  let recoveryCalls = 0;
  let finishRead: () => void = () => {
    throw new Error('read not pending');
  };
  let delayRead = false;
  const service = new CatalogSessionService({
    authority,
    catalog: {
      getCatalog: async () => {
        if (delayRead)
          await new Promise<void>((resolve) => {
            finishRead = resolve;
          });
        return catalog.getCatalog();
      },
      importAudio: (request) => {
        editCalls++;
        return catalog.importAudio(request);
      },
      updatePad: catalog.updatePad,
      reorderPads: catalog.reorderPads,
      deletePad: catalog.deletePad,
      recover: (lease) => {
        recoveryCalls++;
        catalog.recover(lease);
      },
    },
    onPlaybackReleased: () => {
      cleanupCalls++;
      return Promise.resolve();
    },
  });
  try {
    const sessionId = await service.openSession();
    expect(recoveryCalls).toBe(1);
    const attemptId = attemptIdSchema.parse(1);
    const edit = {
      ...(await service.acquire({
        sessionId,
        kind: LeaseKind.Edit,
        attemptId,
      })),
      kind: LeaseKind.Edit,
    };
    const forged = {
      ...edit,
      leaseId: leaseIdSchema.parse('00000000-0000-4000-8000-000000000001'),
    };
    expect(() =>
      service.importAudio({ lease: forged, expectedRevision: 0 }),
    ).toThrow('unauthorized');
    expect(editCalls).toBe(0);
    await expect(
      service.release({ ...forged, kind: LeaseKind.Playback }),
    ).rejects.toThrow('unauthorized');
    expect(cleanupCalls).toBe(0);
    delayRead = true;
    const editRead = service.getCatalog({ sessionId });
    await Promise.resolve();
    expect(() =>
      service.importAudio({ lease: edit, expectedRevision: 0 }),
    ).toThrow('busy');
    finishRead();
    await editRead;
    await service.release(edit);
    delayRead = true;
    const read = service.getCatalog({ sessionId });
    await Promise.resolve();
    await expect(
      service.acquire({ sessionId, kind: LeaseKind.Edit, attemptId }),
    ).rejects.toThrow('busy');
    await expect(service.disposeSession({ sessionId })).rejects.toThrow('busy');
    finishRead();
    await read;
    delayRead = false;
    await service.disposeSession({ sessionId });
    const next = await service.openSession();
    const nextLease = {
      ...(await service.acquire({
        sessionId: next,
        kind: LeaseKind.Edit,
        attemptId,
      })),
      kind: LeaseKind.Edit,
    };
    const closing = service.closeAfterRendererTermination(next);
    const disposal = service.disposeSession({ sessionId: next });
    expect(() =>
      service.importAudio({ lease: nextLease, expectedRevision: 0 }),
    ).toThrow('unauthorized');
    await expect(
      service.acquire({ sessionId: next, kind: LeaseKind.Edit, attemptId }),
    ).rejects.toThrow('unauthorized');
    await expect(disposal).rejects.toThrow('unauthorized');
    await closing;
    const playingSession = await service.openSession();
    const playing = await service.acquire({
      sessionId: playingSession,
      kind: LeaseKind.Playback,
      attemptId,
    });
    delayRead = true;
    const media = service.authorizeMedia(
      assetIdSchema.parse('00000000-0000-4000-8000-000000000001'),
      playing.leaseId,
    );
    await Promise.resolve();
    const termination = service.closeAfterRendererTermination(playingSession);
    finishRead();
    await expect(media).rejects.toThrow('unauthorized');
    await termination;
    expect(cleanupCalls).toBe(1);
    expect(editCalls).toBe(0);
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('rejects read completion under released and replaced playback leases and drains reads on termination', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-stale-'));
  const authority = new SessionAuthority();
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => Promise.resolve([]),
    validateAudio: () => Promise.resolve({ durationSeconds: 1 }),
  });
  const assetId = assetIdSchema.parse('00000000-0000-4000-8000-000000000001');
  let finish: () => void = () => {
    throw new Error('read not started');
  };
  let membershipHeld = true;
  let reads = 0;
  let cleanupCalls = 0;
  const service = new CatalogSessionService({
    authority,
    catalog: {
      recover: (lease) => {
        catalog.recover(lease);
      },
      getCatalog: async () => {
        reads++;
        const snapshot = await catalog.getCatalog();
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        return {
          ...snapshot,
          get assets() {
            try {
              authority.assert(playing);
            } catch {
              membershipHeld = false;
            }
            return [{ id: assetId, name: 'track', durationSeconds: 1 }];
          },
        };
      },
      importAudio: catalog.importAudio,
      updatePad: catalog.updatePad,
      reorderPads: catalog.reorderPads,
      deletePad: catalog.deletePad,
    },
    onPlaybackReleased: () => {
      cleanupCalls++;
      return Promise.resolve();
    },
  });
  const sessionId = await service.openSession();
  const playing = await service.acquire({
    sessionId,
    kind: LeaseKind.Playback,
    attemptId: attemptIdSchema.parse(1),
  });
  try {
    const authorization = service.authorizeMedia(assetId, playing.leaseId);
    const rejected = authorization.catch((error: unknown) => error);
    await Promise.resolve();
    await Promise.resolve();
    await service.release(playing);
    expect(() => {
      authority.assert(playing);
    }).toThrow('unauthorized');
    finish();
    expect(await rejected).toMatchObject({ message: 'unauthorized' });
    expect(membershipHeld).toBe(false);
    const replacement = await service.acquire({
      sessionId,
      kind: LeaseKind.Playback,
      attemptId: attemptIdSchema.parse(2),
    });
    await expect(
      service.authorizeMedia(assetId, playing.leaseId),
    ).rejects.toThrow('unauthorized');
    const pending = service.authorizeMedia(assetId, replacement.leaseId);
    const stale = pending.catch((error: unknown) => error);
    await Promise.resolve();
    await Promise.resolve();
    const closing = service.closeAfterRendererTermination(sessionId);
    const readsBefore = reads;
    await expect(
      service.authorizeMedia(assetId, replacement.leaseId),
    ).rejects.toThrow('unauthorized');
    expect(reads).toBe(readsBefore);
    await expect(service.openSession()).rejects.toThrow('busy');
    expect(cleanupCalls).toBe(1);
    finish();
    expect(await stale).toMatchObject({ message: 'unauthorized' });
    await closing;
    expect(cleanupCalls).toBe(2);
    const next = await service.openSession();
    await expect(service.getCatalog({ sessionId })).rejects.toThrow(
      'unauthorized',
    );
    await service.disposeSession({ sessionId: next });
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});

it('keeps cleanup exclusive while draining ordinary reads after termination', async () => {
  const root = await mkdtemp(join(tmpdir(), 'j1-exclusive-'));
  const authority = new SessionAuthority();
  const catalog = new ManagedCatalog(root, {
    assertEditLease: (lease) => {
      authority.assert(lease);
    },
    selectFiles: () => Promise.resolve([]),
    validateAudio: () => Promise.resolve({ durationSeconds: 1 }),
  });
  let finishCleanup: () => void = () => {
    throw new Error('not cleaning');
  };
  let finishRead: () => void = () => {
    throw new Error('not reading');
  };
  let delayed = false;
  const service = new CatalogSessionService({
    authority,
    catalog: {
      recover: (lease) => {
        catalog.recover(lease);
      },
      getCatalog: async () => {
        if (delayed)
          await new Promise<void>((resolve) => {
            finishRead = resolve;
          });
        return catalog.getCatalog();
      },
      importAudio: catalog.importAudio,
      updatePad: catalog.updatePad,
      reorderPads: catalog.reorderPads,
      deletePad: catalog.deletePad,
    },
    onPlaybackReleased: () =>
      new Promise<void>((resolve) => {
        finishCleanup = resolve;
      }),
  });
  try {
    const sessionId = await service.openSession();
    const lease = await service.acquire({
      sessionId,
      kind: LeaseKind.Playback,
      attemptId: attemptIdSchema.parse(1),
    });
    const release = service.release(lease);
    await Promise.resolve();
    await expect(service.release(lease)).rejects.toThrow('busy');
    await expect(service.getCatalog({ sessionId })).rejects.toThrow('busy');
    await expect(
      service.authorizeMedia(
        assetIdSchema.parse('00000000-0000-4000-8000-000000000001'),
        lease.leaseId,
      ),
    ).rejects.toThrow('busy');
    finishCleanup();
    await release;
    delayed = true;
    const read = service
      .getCatalog({ sessionId })
      .catch((error: unknown) => error);
    await Promise.resolve();
    const close = service.closeAfterRendererTermination(sessionId);
    await expect(service.openSession()).rejects.toThrow('busy');
    finishRead();
    expect(await read).toMatchObject({ message: 'unauthorized' });
    await close;
    const next = await service.openSession();
    await service.disposeSession({ sessionId: next });
  } finally {
    catalog.close();
    await rm(root, { recursive: true, force: true });
  }
});
