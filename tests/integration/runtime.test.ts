import { cn } from '../../src/renderer/lib/utils';
import { afterEach, expect, it, vi } from 'vitest';
import { connectDesktop, unwrap } from '../../src/renderer/runtime/desktop';
import { createDesktopApi } from '../../src/preload/desktop-bridge';
import { catalogSchema, padIdSchema } from '../../src/contracts/catalog';

const sessionId = '00000000-0000-4000-8000-000000000001';
const leaseId = '00000000-0000-4000-8000-000000000002';
const padId = '00000000-0000-4000-8000-000000000003';
const assetId = '00000000-0000-4000-8000-000000000004';
const catalog = catalogSchema.parse({
  schemaVersion: 1,
  revision: 0,
  assets: [],
  pads: [],
  repertoire: {
    id: '00000000-0000-4000-8000-000000000005',
    name: 'Repertório',
    padIds: [],
  },
});
afterEach(() => {
  vi.unstubAllGlobals();
});
it('unwraps finite failures without manufacturing a value', () => {
  expect(unwrap({ ok: true, value: 42 })).toBe(42);
  expect(() => unwrap({ ok: false, error: { code: 'busy' } })).toThrow('busy');
});
it('imports, serializes editing, releases authority on failure and deletes at the current revision', async () => {
  const requests: { channel: string; payload: unknown }[] = [];
  let fail = false;
  const api = createDesktopApi(async (channel, payload) => {
    await Promise.resolve();
    requests.push({ channel, payload });
    if (channel === 'catalog:open') return { ok: true, value: sessionId };
    if (channel === 'catalog:acquire')
      return {
        ok: true,
        value: { sessionId, leaseId, kind: 'edit', attemptId: requests.length },
      };
    if (channel === 'catalog:release' || channel === 'catalog:dispose')
      return { ok: true, value: null };
    if (
      channel === 'catalog:import' ||
      channel === 'catalog:delete' ||
      channel === 'catalog:update' ||
      channel === 'catalog:reorder'
    ) {
      if (fail) return { ok: false, error: { code: 'storage-failure' } };
      return { ok: true, value: { ...catalog, revision: 1 } };
    }
    return { ok: true, value: catalog };
  });
  const runtime = await connectDesktop(api);
  expect(runtime.catalog).toEqual(catalog);
  const first = runtime.edit();
  await expect(runtime.edit()).rejects.toThrow('busy');
  expect((await first).revision).toBe(1);
  await runtime.edit(padIdSchema.parse(padId));
  expect(
    requests.find((request) => request.channel === 'catalog:delete')?.payload,
  ).toMatchObject({ expectedRevision: 1, padId });
  await runtime.update({
    id: padIdSchema.parse(padId),
    assetId: catalogSchema.shape.assets.element.shape.id.parse(assetId),
    label: 'Novo nome',
    color: 'blue',
  });
  await runtime.reorder([padIdSchema.parse(padId)]);
  expect(
    requests.find((request) => request.channel === 'catalog:update')?.payload,
  ).toMatchObject({
    expectedRevision: 1,
    padId,
    label: 'Novo nome',
    color: 'blue',
  });
  expect(
    requests.find((request) => request.channel === 'catalog:reorder')?.payload,
  ).toMatchObject({ expectedRevision: 1, padIds: [padId] });
  expect(runtime.catalog.revision).toBe(1);
  fail = true;
  await expect(runtime.edit()).rejects.toThrow('storage-failure');
  expect(requests.at(-1)?.channel).toBe('catalog:release');
  fail = false;
  await runtime.edit();
  expect(
    requests
      .filter((request) => request.channel === 'catalog:acquire')
      .map((request) => request.payload),
  ).toEqual([
    { sessionId, kind: 'edit', attemptId: 1 },
    { sessionId, kind: 'edit', attemptId: 2 },
    { sessionId, kind: 'edit', attemptId: 3 },
    { sessionId, kind: 'edit', attemptId: 4 },
    { sessionId, kind: 'edit', attemptId: 5 },
    { sessionId, kind: 'edit', attemptId: 6 },
  ]);
  await runtime.playback.dispose();
  expect(requests.at(-1)).toEqual({
    channel: 'catalog:dispose',
    payload: { sessionId },
  });
});
it('uses the restricted media URL and prevents editing until STOP acknowledges cleanup', async () => {
  const element = Object.assign(new EventTarget(), {
    autoplay: true,
    loop: true,
    src: '',
    currentTime: 0,
    duration: 1,
    play: () => Promise.resolve(),
    pause: () => {},
    load: () => {},
    removeAttribute: () => {},
  });
  vi.stubGlobal('document', { createElement: () => element });
  let releaseFails = true;
  const api = createDesktopApi(async (channel) => {
    await Promise.resolve();
    if (channel === 'catalog:release' && releaseFails)
      return { ok: false, error: { code: 'cleanup-required' } };
    if (channel === 'catalog:open') return { ok: true, value: sessionId };
    if (channel === 'catalog:read' || channel === 'catalog:import')
      return { ok: true, value: catalog };
    if (channel === 'catalog:acquire')
      return {
        ok: true,
        value: { sessionId, leaseId, kind: 'playback', attemptId: 1 },
      };
    return { ok: true, value: null };
  });
  const runtime = await connectDesktop(api);
  await runtime.playback.play(
    catalogSchema.shape.pads.element.shape.id.parse(padId),
    catalogSchema.shape.assets.element.shape.id.parse(assetId),
  );
  expect(element.src).toBe(`pad-media://media/${assetId}?lease=${leaseId}`);
  await expect(runtime.edit()).rejects.toThrow('busy');
  await runtime.playback.stop();
  expect(runtime.playback.snapshot().busy).toBe(true);
  await expect(runtime.edit()).rejects.toThrow('busy');
  releaseFails = false;
  await runtime.playback.stop();
  expect(runtime.playback.snapshot().busy).toBe(false);
});

it('composes conditional UI classes and resolves conflicting utilities', () => {
  expect(
    cn('button', undefined, false, { active: true, hidden: false }, [
      'px-2',
      'px-4',
    ]),
  ).toBe('button active px-4');
});
