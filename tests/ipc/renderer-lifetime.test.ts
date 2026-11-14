import { expect, it } from 'vitest';
import { RendererLifetime } from '../../src/main/ipc/renderer-lifetime';
const session = '00000000-0000-4000-8000-000000000001';
it('drains an open response lost during renderer termination and rejects further operations', async () => {
  let finish: (value: unknown) => void = () => {};
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const closed: string[] = [];
  const owner = new RendererLifetime((id) => {
    closed.push(id);
    return Promise.resolve();
  });
  const open = owner.run('catalog:open', () => pending);
  const terminate = owner.terminate();
  expect(closed).toEqual([]);
  await expect(
    owner.run('catalog:read', () => Promise.resolve(null)),
  ).rejects.toMatchObject({ code: 'unauthorized' });
  finish({ ok: true, value: session });
  expect(await open).toEqual({ ok: true, value: session });
  await terminate;
  expect(closed).toEqual([session]);
  await owner.terminate();
  expect(closed).toEqual([session]);
});
it('never closes a failed open or successfully disposed session', async () => {
  const closed: string[] = [];
  const owner = new RendererLifetime((id) => {
    closed.push(id);
    return Promise.resolve();
  });
  await owner.run('catalog:open', () =>
    Promise.resolve({ ok: false, error: { code: 'busy' } }),
  );
  await owner.terminate();
  expect(closed).toEqual([]);
  const other = new RendererLifetime((id) => {
    closed.push(id);
    return Promise.resolve();
  });
  await other.run('catalog:open', () =>
    Promise.resolve({ ok: true, value: session }),
  );
  await other.run('catalog:read', () => Promise.resolve({ catalog: true }));
  await other.run('catalog:dispose', () =>
    Promise.resolve({ ok: true, value: null }),
  );
  await other.terminate();
  expect(closed).toEqual([]);
});
it('retains ownership on failed dispose, drains rejection and preserves cleanup failure for retry', async () => {
  let fail = true;
  const closed: string[] = [];
  const owner = new RendererLifetime((id) => {
    if (fail) return Promise.reject(new Error('cleanup'));
    closed.push(id);
    return Promise.resolve();
  });
  await owner.run('catalog:open', () =>
    Promise.resolve({ ok: true, value: session }),
  );
  await owner.run('catalog:dispose', () =>
    Promise.resolve({ ok: false, error: { code: 'busy' } }),
  );
  await expect(
    owner.run('catalog:read', () => Promise.reject(new Error('read'))),
  ).rejects.toThrow('read');
  await expect(owner.terminate()).rejects.toThrow('cleanup');
  fail = false;
  await owner.terminate();
  expect(closed).toEqual([session]);
});

it('drains every concurrent request even when the latest request completed first', async () => {
  let finish: (value: unknown) => void = () => {};
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const closed: string[] = [];
  const owner = new RendererLifetime((id) => {
    closed.push(id);
    return Promise.resolve();
  });
  const open = owner.run('catalog:open', () => pending);
  await owner.run('catalog:read', () => Promise.resolve(null));
  const terminate = owner.terminate();
  await Promise.resolve();
  expect(closed).toEqual([]);
  finish({ ok: true, value: session });
  await open;
  await terminate;
  expect(closed).toEqual([session]);
});

it('shares concurrent termination and waits for a pending import before closing', async () => {
  let finish: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const closed: string[] = [];
  const owner = new RendererLifetime((id) => {
    closed.push(id);
    return Promise.resolve();
  });
  await owner.run('catalog:open', () =>
    Promise.resolve({ ok: true, value: session }),
  );
  const importing = owner.run('catalog:import', () => pending);
  const first = owner.terminate();
  const second = owner.terminate();
  await Promise.resolve();
  expect(closed).toEqual([]);
  finish();
  await importing;
  await Promise.all([first, second]);
  expect(closed).toEqual([session]);
});

it('keeps close confirmation active until playback release succeeds', async () => {
  const owner = new RendererLifetime(() => Promise.resolve());
  expect(owner.playing).toBe(false);
  await owner.run('catalog:acquire', () =>
    Promise.resolve({
      ok: true,
      value: {
        sessionId: session,
        leaseId: session,
        attemptId: 1,
        kind: 'playback',
      },
    }),
  );
  expect(owner.playing).toBe(true);
  await owner.run('catalog:release', () =>
    Promise.resolve({ ok: false, error: { code: 'busy' } }),
  );
  expect(owner.playing).toBe(true);
  await owner.run('catalog:release', () =>
    Promise.resolve({ ok: true, value: null }),
  );
  expect(owner.playing).toBe(false);
});

it('does not mark failed or edit acquisitions as playback and clears playback after termination', async () => {
  const owner = new RendererLifetime(() => Promise.resolve());
  await owner.run('catalog:acquire', () =>
    Promise.resolve({ ok: false, error: { code: 'busy' } }),
  );
  expect(owner.playing).toBe(false);
  await owner.run('catalog:acquire', () =>
    Promise.resolve({
      ok: true,
      value: {
        sessionId: session,
        leaseId: session,
        attemptId: 1,
        kind: 'edit',
      },
    }),
  );
  expect(owner.playing).toBe(false);
  await owner.run('catalog:acquire', () =>
    Promise.resolve({
      ok: true,
      value: {
        sessionId: session,
        leaseId: session,
        attemptId: 1,
        kind: 'playback',
      },
    }),
  );
  await owner.terminate();
  expect(owner.playing).toBe(false);
});

it('retains session ownership after failed termination and retries cleanup', async () => {
  let fail = true;
  const closed: string[] = [];
  const owner = new RendererLifetime((id) => {
    closed.push(id);
    return fail ? Promise.reject(new Error('cleanup')) : Promise.resolve();
  });
  await owner.run('catalog:open', () =>
    Promise.resolve({ ok: true, value: session }),
  );
  await expect(owner.terminate()).rejects.toThrow('cleanup');
  await expect(
    owner.run('catalog:open', () => Promise.resolve(null)),
  ).rejects.toThrow('unauthorized');
  fail = false;
  await owner.terminate();
  await owner.terminate();
  expect(closed).toEqual([session, session]);
});
